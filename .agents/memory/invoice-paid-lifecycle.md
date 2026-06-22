---
name: Invoice paidAt lifecycle
description: Every code path that makes an invoice effectively paid must stamp paidAt, or the avg-days-to-pay metric silently drops it.
---

# Invoice paidAt lifecycle

Rule: any transition that leaves an invoice **effectively paid** (`balanceDue <= ~0.005`) must set `paidAt` to `existing ?? new Date().toISOString()`. Conversely, an edit that **re-opens** a balance must clear `paidAt` to `undefined`. "Effectively paid" is judged from `balanceDue`, never the raw stored `status`.

**Why:** the dashboard "avg. payment days" metric derives from `createdAt` → `paidAt` and only counts invoices that actually have a `paidAt`. If a path marks an invoice paid but forgets to stamp `paidAt`, the invoice renders as Paid yet is silently excluded from the metric, making avg-days subtly wrong. This gap was easy to introduce in the less-obvious paths and was only caught in review.

**How to apply:** mirror the `inv.paidAt ?? now` pattern already used in `markPaid` / `recordPayment`. The paths that must each handle it:
- full mark-paid and recording the final payment (already correct),
- creating an invoice directly with status "paid" (stamp `paidAt` at creation),
- editing a partially-paid invoice down until it settles (stamp `paidAt`),
- editing a paid invoice up so a balance reopens (set `paidAt: undefined`).
