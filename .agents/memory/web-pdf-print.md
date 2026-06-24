---
name: PDF export / print on web & standalone PWA
description: Why window.open + print traps PWA users and the hidden-iframe fix
---

# PDF export via print on web / standalone PWA

On web, `exportInvoicePDF` (utils/generateInvoicePDF.ts) cannot use the native
`expo-print` + share flow. The old approach was `window.open("", "_blank")` +
`win.print()` — but in a **standalone PWA** the new tab is chrome-less with no
back button, so the user gets trapped on the invoice screen and the bottom tabs
become unusable until they restart the app.

**Fix:** render the invoice HTML into a hidden, off-screen `<iframe>` appended to
the current document, then call `print()` on the iframe's window. The SPA (and
its tab bar) is never navigated away from.

**Cleanup must be driven by `onafterprint` + a long fallback timer, NOT by a
short timeout after `print()`.** Some browsers (notably mobile) return from
`print()` before the dialog is dismissed; removing the iframe too early blanks
the print preview. Guard cleanup with a `cleaned` flag and a `parentNode` check
so it is idempotent; clear the fallback timer inside cleanup.

**Why:** the symptom (trapped nav) only reproduces in installed/standalone PWA
mode, and the blank-print symptom only reproduces on browsers where `print()`
is non-blocking — both are easy to miss in a normal desktop tab.

**How to apply:** keep the `typeof document === "undefined"` guard for
SSR/static-render safety. Any future change to the web print path must preserve
the "never navigate the SPA away" property.
