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
- PDF: `expo-print` + `expo-sharing`; clipboard: `expo-clipboard`; logo upload: `expo-image-picker`

## Where things live (artifacts/mobile)

- `context/InvoicesContext.tsx` — **source of truth** for the invoice data model: `Invoice`/`LineItem` types, `normalizeInvoice` (legacy migration), `computeInvoiceTotals`, `getEffectiveStatus`, `isPastDue`, currency-scoped `metrics`/`clients`, `primaryCurrency`, and mutations (`addInvoice`, `markPaid`, `recordPayment`, `updateInvoice`, `deleteInvoice`).
- `context/BusinessProfileContext.tsx` — reactive business profile (name, address, VAT, bank details, Pay Now link, logo, defaults). Migrates legacy `fp_issuer_profile`.
- `utils/currency.ts` — `CURRENCIES`, `formatMoney(amount, code, numberFormat)`, `currencySymbol`, `isCurrencyCode` (currency validation at data boundaries).
- `utils/generateInvoicePDF.ts` — `exportInvoicePDF(invoice, businessProfile)` builds the invoice HTML and shares it as a PDF.
- `utils/sendEmailReminder.ts` — prefilled mailto reminder using the invoice's client email + currency.
- `components/AddInvoiceModal.tsx` — full invoice creation form (line items, currency, tax, discount, terms, addresses).
- `app/(tabs)/` — `index.tsx` (Dashboard), `invoices.tsx`, `clients.tsx`, `myinfo.tsx` (business profile), `_layout.tsx` (tab bar).

## Architecture decisions

- **Local-only by design.** No server/DB. The "unique hosted invoice URL a client opens in a browser" feature is intentionally deferred because it would require a backend. "Pay Now" is a freelancer-provided payment link (PayPal.me / Stripe Payment Link / custom), not a hosted checkout.
- **Money is always computed, never stored as a single `amount`.** Every screen derives amounts from `computeInvoiceTotals(invoice)` and renders via `formatMoney(value, invoice.currency, profile.numberFormat)`. Legacy `desc`/`amount` fields exist only for migration and must not be a source of truth.
- **Status is effective, not stored.** Badges/buckets/filters use `getEffectiveStatus(invoice)` (paid only when `balanceDue <= 0.005`; overdue when past due and unpaid; else pending), never the raw `invoice.status`.
- **No cross-currency summation.** Dashboard metrics and client rollups are scoped to `primaryCurrency`; amounts in different currencies are never added together.
- **PDF is rendered as web HTML**, so every user-controlled field is HTML-escaped and the Pay Now button only renders for `https://` / `mailto:` links.

## Product

- Dashboard with currency-scoped metrics (total earned, awaiting, overdue, avg. payment days) and a "Chase Priority" list with one-tap mark-paid / send-reminder / copy-reminder.
- Full invoice list with search, status filters, PDF export, and email reminders.
- Clients view rolling up billed / received / outstanding per client.
- My Info tab for the business profile (logo, address, VAT, bank details, Pay Now link, default currency / tax / terms, number format).
- Professional invoice schema: multiple line items, currency, tax rate, discount (percent/fixed), payment terms, notes, PO number, client email/address, and partial payments (`amountPaid` / `balanceDue`).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing the invoice schema, update `normalizeInvoice` so legacy/persisted invoices still load without data loss, and validate enum-like fields (e.g. currency via `isCurrencyCode`) at the load boundary.
- When adding any amount to the UI or PDF, decide deliberately between `total` (the invoice's value) and `balanceDue` (what's still owed). Chase/reminder surfaces use `balanceDue`; the invoice's headline value uses `total`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for mobile UI / native-permission patterns
