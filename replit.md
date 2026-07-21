# Chaser

Chaser is a local-only mobile app (Expo / React Native) that helps freelancers track invoices and chase overdue payments. All data is stored on-device via AsyncStorage — there is no backend.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — run the Expo app (the "mobile" artifact, served at preview path `/`)
- `pnpm --filter @workspace/mobile run typecheck` — typecheck the mobile app
- `pnpm run typecheck` — full typecheck across all packages
- There is no backend or database for Chaser; all state is on-device (AsyncStorage).

## Stack

- Expo / React Native + expo-router (file-based routing under `artifacts/mobile/app`)
- TypeScript 5.9, pnpm workspaces, Node.js 24
- Local persistence: `@react-native-async-storage/async-storage`
- PDF: `expo-print` + `expo-sharing` (+ `expo-file-system` to rename the export before sharing); clipboard: `expo-clipboard`; logo upload: `expo-image-picker`

## Where things live (artifacts/mobile)

- `context/InvoicesContext.tsx` — **source of truth** for the invoice data model: `Invoice`/`LineItem` types (incl. `paidAt`, the ISO timestamp set when an invoice becomes fully paid, and per-line `billingType: "project" | "hour"` — a German Finanzamt requirement; legacy items default to `"project"` in `normalizeInvoice`), `normalizeInvoice` (legacy migration), `computeInvoiceTotals`, `getEffectiveStatus`, `isPastDue`, `daysToPay`, currency-scoped `metrics`/`clients` (avg-days-to-pay is derived from `createdAt`→`paidAt`), `primaryCurrency`, and mutations (`addInvoice`, `markPaid`, `recordPayment`, `updateInvoice`, `deleteInvoice`).
- `context/BusinessProfileContext.tsx` — reactive business profile (name, address, VAT, bank details, Pay Now link, logo, defaults, `invoiceNotes`). Migrates legacy `fp_issuer_profile`. `invoiceNotes` ("Business Notes" in My Info) pre-fills the notes field on every new invoice and is the PDF-notes fallback when an invoice has no notes of its own (e.g. §19 UStG notice).
- `utils/currency.ts` — `CURRENCIES`, `formatMoney(amount, code, numberFormat)`, `currencySymbol`, `isCurrencyCode` (currency validation at data boundaries).
- `utils/date.ts` — `formatDisplayDate` (stored ISO → DD/MM/YYYY for ALL user-facing dates: dashboard, invoice list, form, PDF, email reminders) and `parseDisplayDate` (DD/MM/YYYY input → stored YYYY-MM-DD, null when invalid). Storage stays ISO so sorting/`isPastDue` keep working.
- `utils/generateInvoicePDF.ts` — `exportInvoicePDF(invoice, businessProfile)` builds the invoice HTML and shares it as a PDF. Native export copies the temp file to a recognizable `Client_Invoice_DueDate.pdf` name (via `invoiceFileBaseName`, due date in DD-MM-YYYY) before sharing. Line items render as a five-column table: Description | Type (Per Project / Per Hour) | Qty/Hrs | Unit Price | Subtotal. Web export prints from a hidden iframe with `webPrint` CSS (`@page` + tightened `@media print` spacing so a normal invoice fits one page — native expo-print output keeps the on-screen padding and must not get this CSS) and temporarily swaps the TOP-LEVEL `document.title` to the file base during printing, because browsers name the saved PDF after the parent page title, not the iframe's.
- `utils/sendEmailReminder.ts` — prefilled mailto reminder using the invoice's client email + currency. Query is built with `encodeURIComponent` (NOT `URLSearchParams`, which would render spaces as literal "+"). On web the mailto is launched via a synthetic anchor click — frame navigation (`window.open(url, "_self")`) to external protocols is silently blocked inside embedded iframes like the Replit preview. Whether a mail app actually opens still depends on the browser/OS having a mailto handler.
- `components/AddInvoiceModal.tsx` — full invoice creation form (line items, currency, tax, discount, terms, addresses).
- `app/(tabs)/` — `index.tsx` (Dashboard), `invoices.tsx`, `clients.tsx`, `myinfo.tsx` (business profile), `_layout.tsx` (tab bar).

## Architecture decisions

- **New installs start empty.** No demo/seed invoices ship to users; every tab renders its first-run empty state until the user adds their own data. Storage is only written once the first invoice is created (legacy data is still normalized-on-load exactly once).
- **Local-only by design.** No server/DB. The "unique hosted invoice URL a client opens in a browser" feature is intentionally deferred because it would require a backend. "Pay Now" is a freelancer-provided payment link (PayPal.me / Stripe Payment Link / custom), not a hosted checkout.
- **Installable as a web PWA (additive — the native build is untouched).** `app.json` sets `web.output: "static"` so expo-router applies `app/+html.tsx`, which injects the PWA `<head>` (manifest link, `theme-color` #1D9E75, apple-touch-icon, `viewport-fit=cover`) and the service-worker registration into every exported route. `public/` holds `manifest.webmanifest`, `sw.js`, icons, and favicon. **The deployed mobile artifact is still a native Expo Go build:** `server/serve.js` serves the Expo manifest first when the request carries an `expo-platform: ios|android` header (and serves native static files next), only falling back to the web build / PWA for browsers. `scripts/build.js` runs `expo export --platform web` after the native build as a best-effort step (it warns but never aborts the native build on failure). `web.output` must stay `"static"` — with `"single"`, expo-router silently ignores `+html.tsx` and the PWA tags vanish.
- **Money is always computed, never stored as a single `amount`.** Every screen derives amounts from `computeInvoiceTotals(invoice)` and renders via `formatMoney(value, invoice.currency, profile.numberFormat)`. Legacy `desc`/`amount` fields exist only for migration and must not be a source of truth.
- **Status is effective, not stored.** Badges/buckets/filters use `getEffectiveStatus(invoice)` (paid only when `balanceDue <= 0.005`; overdue when past due and unpaid; else pending), never the raw `invoice.status`.
- **No cross-currency summation.** Dashboard metrics and client rollups are scoped to `primaryCurrency`; amounts in different currencies are never added together.
- **PDF is rendered as web HTML**, so every user-controlled field is HTML-escaped and the Pay Now button only renders for `https://` / `mailto:` links.

## Product

- Dashboard with currency-scoped metrics (total earned, awaiting, overdue, avg. payment days) and a "Chase Priority" list with one-tap mark-paid / send-reminder / copy-reminder.
- Full invoice list with search, status filters, PDF export, and email reminders. Record full or partial payments through a payment sheet (shows total / already-paid / balance due, prefilled to the balance); cards show a "X paid · Y due" note while a balance remains. Any invoice — including fully paid ones — can be edited (editing that re-opens a balance clears the stale `paidAt`).
- Clients view rolling up billed / received / outstanding per client.
- My Info tab for the business profile (logo, address, VAT, bank details, Pay Now link, default currency / tax / terms, number format), with inline validation (business name required; email must be valid when present).
- Professional invoice schema: multiple line items (each with a Per Project / Per Hour billing type; the form labels the number field "Qty" or "Hours" accordingly), currency, tax rate, discount (percent/fixed), payment terms, notes, PO number, client email/address, and partial payments (`amountPaid` / `balanceDue`).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing the invoice schema, update `normalizeInvoice` so legacy/persisted invoices still load without data loss, and validate enum-like fields (e.g. currency via `isCurrencyCode`) at the load boundary.
- Client address is structured (`clientStreet` / `clientPostcode` / `clientCity` / `clientCountry`, rendered postcode-before-city in the PDF). The legacy single-field `clientAddress` is display-fallback only: the edit form prefills it into the street field and saving writes the structured fields while clearing `clientAddress`.
- All user-facing dates render DD/MM/YYYY via `formatDisplayDate`; never display raw `inv.due`/`createdAt`. The Due Date input accepts DD/MM/YYYY and converts to ISO via `parseDisplayDate` on save — storage must stay YYYY-MM-DD.
- When adding any amount to the UI or PDF, decide deliberately between `total` (the invoice's value) and `balanceDue` (what's still owed). Chase/reminder surfaces use `balanceDue`; the invoice's headline value uses `total`.
- Any code path that leaves an invoice effectively paid (`balanceDue <= ~0.005`) must stamp `paidAt` (`existing ?? new Date().toISOString()`); a path that re-opens a balance must clear it (`paidAt: undefined`). The avg-payment-days metric counts only invoices with a `paidAt`, so a missed stamp silently drops a paid invoice from the metric.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for mobile UI / native-permission patterns
