---
name: mailto query encoding
description: Why mailto: links must be built with encodeURIComponent, not URLSearchParams.
---

# mailto query encoding

Rule: build `mailto:` (and any `?subject=...&body=...`) query strings with `encodeURIComponent`, never with `URLSearchParams`/`URLSearchParams.toString()`.

**Why:** `URLSearchParams.toString()` uses `application/x-www-form-urlencoded` rules, which encode a space as `+`. In a `mailto:` URL the body/subject are NOT form-encoded, so many mail clients (confirmed: Apple Mail / iCloud) render those `+` characters literally — the email subject/body shows up as `Invoice+INV-001+—+Due...` and looks "coded/weird" to the user. `encodeURIComponent` encodes spaces as `%20` and newlines as `%0A`, which clients decode correctly.

**How to apply:** in `utils/sendEmailReminder.ts` the query is `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`. Keep it that way. If a future feature adds multiple recipients, note that `encodeURIComponent` on the whole recipient string would encode the comma separators too — split and encode per-address in that case.
