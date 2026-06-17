import { Invoice } from "@/context/InvoicesContext";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

function fmtCurrency(n: number) {
  return "€" + n.toLocaleString("de-DE", { minimumFractionDigits: 2 });
}

function fmtDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function statusLabel(status: Invoice["status"]) {
  if (status === "paid") return "PAID";
  if (status === "overdue") return "OVERDUE";
  return "PENDING";
}

function statusColors(status: Invoice["status"]) {
  if (status === "paid") return { bg: "#E8F5F0", text: "#085041", border: "#1D9E75" };
  if (status === "overdue") return { bg: "#FEE2E2", text: "#991B1B", border: "#EF4444" };
  return { bg: "#FEF3C7", text: "#78350F", border: "#F59E0B" };
}

function buildHTML(inv: Invoice, issuerName: string, issuerEmail: string): string {
  const sc = statusColors(inv.status);
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const subtotal = inv.amount;
  const tax = 0;
  const total = subtotal + tax;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
    }

    /* HEADER */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 48px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-icon {
      width: 38px;
      height: 38px;
      background: #1D9E75;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.3px;
    }
    .brand-tagline {
      font-size: 11px;
      color: #6B7280;
      margin-top: 1px;
    }
    .status-badge {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.8px;
      background: ${sc.bg};
      color: ${sc.text};
      border: 1.5px solid ${sc.border};
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
    .invoice-dates {
      text-align: right;
    }
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
    .date-val {
      font-size: 12px;
      color: #111827;
      font-weight: 500;
    }

    /* PARTIES */
    .parties {
      display: flex;
      gap: 40px;
      margin-bottom: 36px;
    }
    .party {
      flex: 1;
    }
    .party-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #9CA3AF;
      margin-bottom: 8px;
    }
    .party-name {
      font-size: 15px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 2px;
    }
    .party-detail {
      font-size: 12px;
      color: #6B7280;
    }

    /* LINE ITEMS TABLE */
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .table thead tr {
      background: #F9FAFB;
      border-radius: 8px;
    }
    .table th {
      padding: 10px 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      color: #6B7280;
      text-align: left;
    }
    .table th:last-child { text-align: right; }
    .table td {
      padding: 14px 14px;
      font-size: 13px;
      color: #111827;
      border-bottom: 1px solid #F3F4F6;
    }
    .table td:last-child { text-align: right; font-weight: 600; }
    .table .desc {
      font-size: 11px;
      color: #6B7280;
      margin-top: 3px;
    }

    /* TOTALS */
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }
    .totals-box {
      width: 240px;
    }
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
    .totals-row.total .amount {
      font-size: 20px;
      font-weight: 700;
      color: #1D9E75;
    }

    /* NOTES */
    .notes {
      background: #F9FAFB;
      border-left: 3px solid #1D9E75;
      border-radius: 4px;
      padding: 14px 16px;
      margin-bottom: 40px;
    }
    .notes-title {
      font-size: 11px;
      font-weight: 700;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      margin-bottom: 4px;
    }
    .notes-text {
      font-size: 12px;
      color: #374151;
    }

    /* FOOTER */
    .footer {
      border-top: 1px solid #E5E7EB;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-brand {
      font-size: 13px;
      font-weight: 700;
      color: #1D9E75;
    }
    .footer-note {
      font-size: 11px;
      color: #9CA3AF;
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- HEADER -->
    <div class="header">
      <div class="brand">
        <div class="brand-icon">
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
            <path d="M11 5v12M7 9h8M7 13h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <div class="brand-name">Chaser</div>
          <div class="brand-tagline">Invoice & Payment Chaser</div>
        </div>
      </div>
      <div class="status-badge">${statusLabel(inv.status)}</div>
    </div>

    <!-- INVOICE NUMBER + DATES -->
    <div class="invoice-title-row">
      <div>
        <div class="invoice-label">Invoice</div>
        <div class="invoice-number">${inv.invnum}</div>
      </div>
      <div class="invoice-dates">
        <div class="date-row">
          <span class="date-key">Issued</span>
          <span class="date-val">${today}</span>
        </div>
        <div class="date-row">
          <span class="date-key">Due</span>
          <span class="date-val">${fmtDate(inv.due)}</span>
        </div>
      </div>
    </div>

    <!-- PARTIES -->
    <div class="parties">
      <div class="party">
        <div class="party-label">From</div>
        <div class="party-name">${issuerName || "Your Name"}</div>
        <div class="party-detail">${issuerEmail || "your@email.com"}</div>
      </div>
      <div class="party">
        <div class="party-label">Bill To</div>
        <div class="party-name">${inv.client}</div>
        <div class="party-detail">&nbsp;</div>
      </div>
    </div>

    <!-- LINE ITEMS -->
    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div>${inv.desc || "Services rendered"}</div>
          </td>
          <td>${fmtCurrency(subtotal)}</td>
        </tr>
      </tbody>
    </table>

    <!-- TOTALS -->
    <div class="totals">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${fmtCurrency(subtotal)}</span>
        </div>
        <div class="totals-row">
          <span>Tax (0%)</span>
          <span>${fmtCurrency(tax)}</span>
        </div>
        <div class="totals-row total">
          <span class="label">Total</span>
          <span class="amount">${fmtCurrency(total)}</span>
        </div>
      </div>
    </div>

    <!-- NOTES -->
    <div class="notes">
      <div class="notes-title">Payment Notes</div>
      <div class="notes-text">
        Please make payment by ${fmtDate(inv.due)}.
        Thank you for your business — it's a pleasure working with you.
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <span class="footer-brand">Chaser</span>
      <span class="footer-note">Generated ${today}</span>
    </div>

  </div>
</body>
</html>
  `.trim();
}

export async function exportInvoicePDF(
  inv: Invoice,
  issuerName = "",
  issuerEmail = ""
): Promise<void> {
  const html = buildHTML(inv, issuerName, issuerEmail);

  if (Platform.OS === "web") {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    }
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Invoice ${inv.invnum} — ${inv.client}`,
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ html });
  }
}
