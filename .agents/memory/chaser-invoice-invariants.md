---
name: Chaser invoice money/status invariants
description: Non-obvious cross-cutting rules for the Chaser mobile invoice app (artifacts/mobile) that every screen/PDF/email must follow.
---

# Chaser invoice invariants

Chaser (artifacts/mobile) is a local-only Expo/RN invoice app. These rules are enforced
*everywhere* and are easy to break silently because the invoice still has legacy
`desc`/`amount` fields and a stored `status`.

## Rules

1. **Money is computed, never read raw.** Always derive amounts from
   `computeInvoiceTotals(invoice)` (subtotal/discount/tax/total/amountPaid/balanceDue)
   and render with `formatMoney(value, invoice.currency, profile.numberFormat)`.
   Legacy `desc`/`amount` exist only for `normalizeInvoice` migration — never a source of truth.
2. **Status is effective, not stored.** Use `getEffectiveStatus(invoice)` for all
   badges/buckets/filters: paid only when `balanceDue <= 0.005`; overdue when past due and
   unpaid; else pending. Do not branch on raw `invoice.status`.
3. **No cross-currency sums.** Dashboard metrics and client rollups scope to
   `primaryCurrency`. Never add amounts across currencies.
4. **`total` vs `balanceDue` is a deliberate choice.** Chase cards, copy-reminder, and email
   reminders show `balanceDue` (what's still owed). The invoice's headline value shows `total`.
5. **Validate enum-like fields at the data boundary.** `normalizeInvoice` and the business
   profile loader validate currency via `isCurrencyCode` (fallback EUR), because persisted/
   malformed values flow straight into formatting and the PDF.
6. **PDF is web HTML → escape everything.** `generateInvoicePDF.ts` HTML-escapes every
   user-controlled field (incl. `money(...)` output) and only renders the Pay Now button for
   `https://` / `mailto:` links.

**Why:** breaking #1–#3 produces wrong totals/badges that look plausible; breaking #5–#6 is a
real HTML-injection risk because the PDF preview renders as HTML. A code review caught both an
unescaped money-string path (via unvalidated currency) and chase cards showing `total` instead
of `balanceDue` for partially-paid invoices.

**How to apply:** when adding any screen, metric, PDF row, or reminder that shows an amount or a
status, route it through `computeInvoiceTotals` + `formatMoney` + `getEffectiveStatus`, decide
`total` vs `balanceDue`, and never sum across currencies.
