import {
  Invoice,
  computeInvoiceTotals,
  getEffectiveStatus,
} from "@/context/InvoicesContext";
import {
  BusinessProfile,
  DEFAULT_PROFILE,
} from "@/context/BusinessProfileContext";
import { formatMoney } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

// ---- Security helpers ------------------------------------------------------
// The PDF is also previewed as raw web HTML, so EVERY user-controlled field
// must be escaped before interpolation to avoid HTML/script injection.

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escMultiline(s: unknown): string {
  return esc(s).replace(/\r?\n/g, "<br/>");
}

// Only allow safe schemes for the "Pay Now" link.
function safeLink(url: string | undefined): string | null {
  const u = (url ?? "").trim();
  if (u.startsWith("https://")) return u;
  return null;
}

// Only allow inline data images or https for the logo.
function safeImageSrc(uri: string | undefined): string | null {
  const u = (uri ?? "").trim();
  if (u.startsWith("data:image/") || u.startsWith("https://")) return u;
  return null;
}

// ---- Formatting helpers ----------------------------------------------------

function fmtDate(dateStr: string): string {
  try {
    return formatDisplayDate(dateStr);
  } catch {
    return dateStr;
  }
}

// Build a recognizable, filesystem-safe base name like
// "Brightwave_Media_Group_INV-001_2026-07-22" from the client, invoice number,
// and due date. Used for both the exported file name and the HTML <title>
// (browsers use the document title as the default "Save as PDF" file name).
function invoiceFileBaseName(inv: Invoice): string {
  const sanitize = (s: unknown) =>
    String(s ?? "")
      .replace(/[^a-zA-Z0-9-]+/g, "_")
      .replace(/^_+|_+$/g, "");
  // Due date in DD-MM-YYYY (display convention, dash-separated so the
  // sanitizer keeps it intact in the file name).
  const dueForName = formatDisplayDate(inv.due).replace(/\//g, "-");
  const parts = [inv.client, inv.invnum, dueForName]
    .map(sanitize)
    .filter((p) => p.length > 0);
  const base = parts.join("_").slice(0, 100);
  return base || `invoice_${sanitize(inv.invnum) || "export"}`;
}

// ---- HTML builder ----------------------------------------------------------

// Print-dialog CSS, used only for the web "Save as PDF" path. The browser
// adds its own @page margins, so the on-screen page padding and the roomy
// vertical gaps would otherwise push the footer onto a second page. Native
// expo-print output is untouched (it relies on the on-screen padding).
const WEB_PRINT_CSS = `
    @page { size: A4; margin: 10mm 11mm; }
    @media print {
      html, body { width: auto; height: auto; }
      body { font-size: 12px; line-height: 1.35; }
      .page {
        max-width: none;
        width: 100%;
        margin: 0;
        padding: 0;
        break-after: avoid-page;
        page-break-after: avoid;
      }
      .header { min-height: 36px; margin-bottom: 20px; }
      .logo { max-height: 56px; }
      .invoice-title-row { padding-bottom: 12px; margin-bottom: 16px; }
      .parties { margin-bottom: 18px; }
      .table { margin-bottom: 14px; }
      .table th { padding: 7px 10px; }
      .table td { padding: 9px 10px; }
      .totals { margin-bottom: 16px; }
      .info-grid { margin-bottom: 12px; }
      .notes { padding: 10px 12px; margin-bottom: 10px; }
      .late-fee { margin-bottom: 12px; }
      .pay-now-wrap { margin-bottom: 14px; }
      .footer { padding-top: 12px; }
      .table tr { page-break-inside: avoid; }
      .totals, .notes, .footer { page-break-inside: avoid; }
    }
`;

export function buildInvoiceHTML(
  inv: Invoice,
  profile: BusinessProfile,
  opts: { webPrint?: boolean } = {}
): string {
  const totals = computeInvoiceTotals(inv);
  const money = (v: number) => esc(formatMoney(v, inv.currency, profile.numberFormat));

  const today = fmtDate(new Date().toISOString());
  const issued = fmtDate(inv.createdAt);
  const due = fmtDate(inv.due);
  const fileBase = invoiceFileBaseName(inv);

  const isOverdue = getEffectiveStatus(inv) === "overdue";

  // --- Logo / brand (top-left) ---
  const logoSrc = safeImageSrc(profile.logoUri);
  const brandBlock = logoSrc
    ? `<img class="logo" src="${esc(logoSrc)}" alt="Logo" />`
    : `<div class="brand-name">${esc(profile.name || "Invoice")}</div>`;

  // --- Overdue stamp ---
  const overdueStamp = isOverdue
    ? `<div class="stamp">OVERDUE</div>`
    : "";

  // --- Sender block (From) ---
  const senderLines: string[] = [];
  if (profile.name) senderLines.push(`<div class="party-name">${esc(profile.name)}</div>`);
  if (profile.address)
    senderLines.push(`<div class="party-detail">${escMultiline(profile.address)}</div>`);
  if (profile.vatNumber)
    senderLines.push(`<div class="party-detail">VAT: ${esc(profile.vatNumber)}</div>`);
  if (profile.email)
    senderLines.push(`<div class="party-detail">${esc(profile.email)}</div>`);
  if (senderLines.length === 0)
    senderLines.push(`<div class="party-name">Your Name</div>`);

  // --- Client block (Bill To) ---
  // Structured address (street / postcode city / country) is preferred; the
  // legacy single-field clientAddress is only rendered for old invoices that
  // were never re-saved with the structured fields.
  const clientLines: string[] = [];
  clientLines.push(`<div class="party-name">${esc(inv.client || "Client")}</div>`);
  const cityLine = [inv.clientPostcode, inv.clientCity]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .join(" ");
  const structuredAddress = [inv.clientStreet?.trim(), cityLine, inv.clientCountry?.trim()]
    .filter((p): p is string => !!p && p.length > 0);
  if (structuredAddress.length > 0) {
    for (const line of structuredAddress) {
      clientLines.push(`<div class="party-detail">${esc(line)}</div>`);
    }
  } else if (inv.clientAddress) {
    clientLines.push(`<div class="party-detail">${escMultiline(inv.clientAddress)}</div>`);
  }
  if (inv.clientEmail)
    clientLines.push(`<div class="party-detail">${esc(inv.clientEmail)}</div>`);

  // --- PO number ---
  const poRow = inv.poNumber
    ? `<div class="date-row">
         <span class="date-key">PO No.</span>
         <span class="date-val">${esc(inv.poNumber)}</span>
       </div>`
    : "";

  // --- Line items ---
  const lineItems = inv.lineItems ?? [];
  const lineRows = lineItems
    .map((li) => {
      const qty = Number(li.quantity) || 0;
      const unit = Number(li.unitPrice) || 0;
      const lineSubtotal = qty * unit;
      // Finanzamt requirement: state whether the line was billed hourly or
      // per project. Legacy items without a billingType default to project.
      const typeLabel = li.billingType === "hour" ? "Per Hour" : "Per Project";
      return `
        <tr>
          <td>${esc(li.description || "—")}</td>
          <td>${esc(typeLabel)}</td>
          <td class="num">${esc(qty)}</td>
          <td class="num">${money(unit)}</td>
          <td class="num">${money(lineSubtotal)}</td>
        </tr>`;
    })
    .join("");

  // --- Totals rows ---
  const discountLabel =
    inv.discountType === "percent" && inv.discountValue
      ? `Discount (${esc(inv.discountValue)}%)`
      : "Discount";
  const discountRow =
    totals.discount > 0
      ? `<div class="totals-row">
           <span>${discountLabel}</span>
           <span>-${money(totals.discount)}</span>
         </div>`
      : "";

  const taxRate = Number(inv.taxRate) || 0;
  const taxRow =
    taxRate > 0
      ? `<div class="totals-row">
           <span>Tax (${esc(taxRate)}%)</span>
           <span>${money(totals.tax)}</span>
         </div>`
      : "";

  const partialRows =
    totals.amountPaid > 0
      ? `<div class="totals-row">
           <span>Amount Paid</span>
           <span>-${money(totals.amountPaid)}</span>
         </div>
         <div class="totals-row total">
           <span class="label">Balance Due</span>
           <span class="amount">${money(totals.balanceDue)}</span>
         </div>`
      : `<div class="totals-row total">
           <span class="label">Total</span>
           <span class="amount">${money(totals.total)}</span>
         </div>`;

  // --- Payment terms ---
  const terms = inv.paymentTerms || profile.defaultPaymentTerms || "";
  const termsBlock = terms
    ? `<div class="info-block">
         <div class="info-title">Payment Terms</div>
         <div class="info-text">${esc(terms)}</div>
       </div>`
    : "";

  // --- Bank / payment details ---
  const bankBlock = profile.bankDetails
    ? `<div class="info-block">
         <div class="info-title">Payment Details</div>
         <div class="info-text">${escMultiline(profile.bankDetails)}</div>
       </div>`
    : "";

  // --- Notes (editable per-invoice; falls back to the business-wide notes so
  // legal notices like §19 UStG appear on every PDF, then to a default) ---
  const notesText =
    inv.paymentNotes && inv.paymentNotes.trim().length > 0
      ? escMultiline(inv.paymentNotes)
      : profile.invoiceNotes && profile.invoiceNotes.trim().length > 0
      ? escMultiline(profile.invoiceNotes)
      : `Please make payment by ${esc(due)}. Thank you for your business — it's a pleasure working with you.`;
  const notesBlock = `<div class="notes">
      <div class="notes-title">Notes</div>
      <div class="notes-text">${notesText}</div>
    </div>`;

  // --- Late-fee note ---
  const lateFeeNote = `<div class="late-fee">A late fee may be applied to balances unpaid after the due date.</div>`;

  // --- Pay Now button ---
  const link = safeLink(inv.payLink) ?? safeLink(profile.payLink);
  const payNowButton = link
    ? `<div class="pay-now-wrap">
         <a class="pay-now" href="${esc(link)}">Pay Now</a>
       </div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(fileBase)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #111827;
      font-size: 13px;
      line-height: 1.5;
    }

    .page {
      max-width: 680px;
      margin: 0 auto;
      padding: 48px 48px 64px;
      position: relative;
    }

    /* HEADER */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 48px;
      min-height: 44px;
    }
    .logo {
      max-width: 180px;
      max-height: 72px;
      object-fit: contain;
    }
    .brand-name {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.3px;
    }
    .stamp {
      border: 3px solid #EF4444;
      color: #EF4444;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 2px;
      padding: 6px 16px;
      border-radius: 8px;
      transform: rotate(8deg);
      opacity: 0.85;
    }

    /* INVOICE TITLE */
    .invoice-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 24px;
      border-bottom: 2px solid #F3F4F6;
      margin-bottom: 32px;
    }
    .invoice-label {
      font-size: 11px;
      font-weight: 600;
      color: #6B7280;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .invoice-number {
      font-size: 28px;
      font-weight: 700;
      color: #1D9E75;
      letter-spacing: -0.5px;
    }
    .invoice-dates { text-align: right; }
    .date-row {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-bottom: 4px;
    }
    .date-key {
      font-size: 11px;
      font-weight: 600;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      min-width: 70px;
      text-align: right;
    }
    .date-val { font-size: 12px; color: #111827; font-weight: 500; }

    /* PARTIES */
    .parties { display: flex; gap: 40px; margin-bottom: 36px; }
    .party { flex: 1; }
    .party-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #6B7280;
      margin-bottom: 8px;
    }
    .party-name {
      font-size: 15px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 2px;
    }
    .party-detail { font-size: 12px; color: #6B7280; }

    /* LINE ITEMS TABLE */
    .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .table thead tr { background: #F9FAFB; }
    .table th {
      padding: 10px 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      color: #6B7280;
      text-align: left;
    }
    .table th.num, .table td.num { text-align: right; }
    .table td {
      padding: 14px 14px;
      font-size: 13px;
      color: #111827;
      border-bottom: 1px solid #F3F4F6;
    }
    .table td.num { font-weight: 600; }

    /* TOTALS */
    .totals { display: flex; justify-content: flex-end; margin-bottom: 36px; }
    .totals-box { width: 260px; }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      color: #6B7280;
      border-bottom: 1px solid #F3F4F6;
    }
    .totals-row.total {
      padding: 12px 0 0;
      border: none;
      margin-top: 4px;
    }
    .totals-row.total .label { font-size: 14px; font-weight: 700; color: #111827; }
    .totals-row.total .amount { font-size: 20px; font-weight: 700; color: #1D9E75; }

    /* INFO BLOCKS */
    .info-grid { display: flex; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
    .info-block { flex: 1; min-width: 220px; }
    .info-title {
      font-size: 11px;
      font-weight: 700;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      margin-bottom: 4px;
    }
    .info-text { font-size: 12px; color: #374151; }

    /* NOTES */
    .notes {
      background: #F9FAFB;
      border-left: 3px solid #1D9E75;
      border-radius: 4px;
      padding: 14px 16px;
      margin-bottom: 16px;
    }
    .notes-title {
      font-size: 11px;
      font-weight: 700;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      margin-bottom: 4px;
    }
    .notes-text { font-size: 12px; color: #374151; }

    .late-fee { font-size: 11px; color: #6B7280; margin-bottom: 24px; }

    /* PAY NOW */
    .pay-now-wrap { text-align: center; margin-bottom: 36px; }
    .pay-now {
      display: inline-block;
      background: #1D9E75;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 8px;
      letter-spacing: 0.3px;
    }

    /* FOOTER */
    .footer {
      border-top: 1px solid #E5E7EB;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-brand { font-size: 13px; font-weight: 700; color: #1D9E75; }
    .footer-note { font-size: 11px; color: #6B7280; }
    ${opts.webPrint ? WEB_PRINT_CSS : ""}
  </style>
</head>
<body>
  <div class="page">

    <!-- HEADER -->
    <div class="header">
      <div>${brandBlock}</div>
      ${overdueStamp}
    </div>

    <!-- INVOICE NUMBER + DATES -->
    <div class="invoice-title-row">
      <div>
        <div class="invoice-label">Invoice</div>
        <div class="invoice-number">${esc(inv.invnum)}</div>
      </div>
      <div class="invoice-dates">
        <div class="date-row">
          <span class="date-key">Issued</span>
          <span class="date-val">${esc(issued)}</span>
        </div>
        <div class="date-row">
          <span class="date-key">Due</span>
          <span class="date-val">${esc(due)}</span>
        </div>
        ${poRow}
      </div>
    </div>

    <!-- PARTIES -->
    <div class="parties">
      <div class="party">
        <div class="party-label">From</div>
        ${senderLines.join("")}
      </div>
      <div class="party">
        <div class="party-label">Bill To</div>
        ${clientLines.join("")}
      </div>
    </div>

    <!-- LINE ITEMS -->
    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Type</th>
          <th class="num">Qty/Hrs</th>
          <th class="num">Unit Price</th>
          <th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows}
      </tbody>
    </table>

    <!-- TOTALS -->
    <div class="totals">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${money(totals.subtotal)}</span>
        </div>
        ${discountRow}
        ${taxRow}
        ${partialRows}
      </div>
    </div>

    <!-- INFO BLOCKS -->
    <div class="info-grid">
      ${termsBlock}
      ${bankBlock}
    </div>

    <!-- NOTES -->
    ${notesBlock}
    ${lateFeeNote}

    <!-- PAY NOW -->
    ${payNowButton}

    <!-- FOOTER -->
    <div class="footer">
      <span class="footer-brand">${esc(profile.name || "Chaser")}</span>
      <span class="footer-note">Generated ${esc(today)}</span>
    </div>

  </div>
</body>
</html>
  `.trim();
}

// ---- Public API ------------------------------------------------------------

function resolveProfile(
  profileOrName?: BusinessProfile | string,
  legacyEmail?: string
): BusinessProfile {
  if (profileOrName && typeof profileOrName === "object") {
    return { ...DEFAULT_PROFILE, ...profileOrName };
  }
  // Legacy (name, email) call shape — replaced by T005 callers.
  return {
    ...DEFAULT_PROFILE,
    name: typeof profileOrName === "string" ? profileOrName : "",
    email: legacyEmail ?? "",
  };
}

export async function exportInvoicePDF(
  inv: Invoice,
  businessProfile?: BusinessProfile
): Promise<void>;
// Legacy overload retained so existing callers typecheck until T005 wiring.
export async function exportInvoicePDF(
  inv: Invoice,
  issuerName?: string,
  issuerEmail?: string
): Promise<void>;
export async function exportInvoicePDF(
  inv: Invoice,
  profileOrName?: BusinessProfile | string,
  legacyEmail?: string
): Promise<void> {
  const profile = resolveProfile(profileOrName, legacyEmail);

  if (Platform.OS === "web") {
    // Render the invoice into a hidden, off-screen iframe and print from there.
    // The previous window.open() approach trapped standalone-PWA users on a
    // chrome-less tab with no way back to the app. An iframe keeps the SPA (and
    // the bottom tab bar) mounted, so after printing the user remains on the
    // invoices screen with navigation fully functional.
    if (typeof document === "undefined") return;

    const html = buildInvoiceHTML(inv, profile, { webPrint: true });

    // Browsers derive the suggested "Save as PDF" file name from the TOP-LEVEL
    // document title, not the printed iframe's title. Temporarily rename this
    // page to the invoice file base so the dialog suggests
    // "Client_Invoice_DueDate.pdf" instead of the app's tab title; cleanup
    // restores the original title.
    const prevTitle = document.title;
    document.title = invoiceFileBaseName(inv);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    let cleaned = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      document.title = prevTitle;
    };

    const frameWin = iframe.contentWindow;
    const doc = frameWin?.document;
    if (!frameWin || !doc) {
      iframe.remove();
      document.title = prevTitle;
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Remove the iframe only once printing is finished. Relying on onafterprint
    // (rather than removing shortly after print()) avoids blanking the print
    // preview on browsers where print() returns before the dialog is dismissed.
    // The long fallback guarantees the hidden iframe is never leaked if the
    // event never fires (e.g. print is unavailable).
    frameWin.onafterprint = cleanup;
    fallbackTimer = setTimeout(cleanup, 60000);

    // Give the iframe a tick to lay out before invoking the print dialog.
    setTimeout(() => {
      try {
        frameWin.focus();
        frameWin.print();
      } catch {
        cleanup();
      }
    }, 300);
    return;
  }

  const html = buildInvoiceHTML(inv, profile);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  // Print writes a UUID-named temp file; copy it to a recognizable name so the
  // share sheet / saved file reads "Client_Invoice_DueDate.pdf".
  let shareUri = uri;
  try {
    const dir = FileSystem.cacheDirectory;
    if (dir) {
      const dest = `${dir}${invoiceFileBaseName(inv)}.pdf`;
      await FileSystem.deleteAsync(dest, { idempotent: true });
      await FileSystem.copyAsync({ from: uri, to: dest });
      shareUri = dest;
    }
  } catch {
    // Fall back to the original temp file if the rename fails.
    shareUri = uri;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(shareUri, {
      mimeType: "application/pdf",
      dialogTitle: `Invoice ${inv.invnum} — ${inv.client}`,
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ html });
  }
}
