---
name: Invoice currency vs amountPaid coupling
description: Why currency edits must be locked once a payment is recorded on an invoice
---

# Currency is locked once a payment exists

When editing an existing invoice, the currency selector must be disabled if
`amountPaid > 0` (i.e. any partial/full payment has been recorded).

**Why:** `amountPaid` (and the derived `balanceDue`) is a bare number with no
currency tag of its own — it is only meaningful relative to `invoice.currency`.
If currency is changed while a payment exists, the recorded payment is silently
re-denominated (e.g. €500 paid becomes $500 paid), corrupting client/dashboard
payment metrics. A partially paid invoice can still be Pending/Overdue (effective
status), so it IS editable through the normal Edit flow — that's exactly the case
that triggers this bug.

**How to apply:** In any invoice-edit surface, gate currency changes on
`amountPaid > 0`. Either disable the currency control (current approach: greyed
chips + a "Currency is locked because a payment has been recorded." hint) or
require an explicit conversion/reset flow before allowing the change. The same
principle applies to any future field that stores a money amount without an
attached currency.
