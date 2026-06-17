# Threat Model

## Project Overview

Chaser is a local-first Expo / React Native app for freelancers to manage invoices and payment follow-up. Its primary production surface is the `artifacts/mobile` app, which persists invoice and business-profile data on-device with AsyncStorage, renders invoice PDFs from HTML, and hands data to OS-managed mail, browser, print, and share handlers. The repo also contains a minimal Express API artifact under `artifacts/api-server` that currently exposes only `/api/healthz`. There is no application database and no authenticated multi-user backend.

## Assets

- **Invoice records and client details** — invoice numbers, line items, payment status, client names, client email addresses, client postal addresses, PO numbers, and reminder text. Exposure would leak a freelancer's business records and client PII.
- **Business profile and payment details** — the user's business name, address, VAT/tax number, bank/payment details, Pay Now link, logo, and email. Exposure or tampering could misdirect payments or leak sensitive business information.
- **Generated invoice PDFs and shared exports** — PDF files assembled from app data and temporarily materialized for printing/sharing. These can contain the full invoice and payment details.
- **Outbound intents to external handlers** — `mailto:` links, browser-opened payment URLs, and OS share-sheet handoffs. These are trust-boundary crossings because the app passes user-controlled data to other applications.

## Trust Boundaries

- **User input to app state** — all invoice and profile fields are user-controlled and must be treated as untrusted when rendered, stored, or exported.
- **AsyncStorage to runtime** — persisted on-device state can be stale, corrupted, or intentionally modified on a compromised device. Load-time normalization must reject or constrain invalid values.
- **Runtime data to HTML/PDF renderer** — invoice/profile data is interpolated into HTML before printing or browser preview. This boundary must prevent HTML/script injection and unsafe URL schemes.
- **App to OS/external apps** — the mobile app launches mail clients, browsers, print dialogs, and share sheets. Only safe, intentional URIs and content should cross this boundary.
- **Public web/API surface** — if the mobile artifact is served as a web build, the browser runtime and `artifacts/mobile/server/serve.js` become public surfaces. The separate API artifact is also public if deployed, but currently only serves `/api/healthz`.
- **Production vs dev-only code** — `artifacts/mockup-sandbox` is a sandbox and must be treated as out of scope for production findings. `artifacts/mobile/scripts` is build-only and usually out of scope unless production reachability is demonstrated.

## Scan Anchors

- **Primary production entry points:** `artifacts/mobile/app/_layout.tsx`, `artifacts/mobile/app/(tabs)/*`, `artifacts/mobile/context/*`, `artifacts/mobile/utils/generateInvoicePDF.ts`, `artifacts/mobile/utils/sendEmailReminder.ts`, `artifacts/mobile/server/serve.js`.
- **Highest-risk areas:** AsyncStorage persistence in `context/InvoicesContext.tsx` and `context/BusinessProfileContext.tsx`; HTML/PDF export in `utils/generateInvoicePDF.ts`; external-link and mail launchers in `utils/sendEmailReminder.ts` and payment-link fields.
- **Public vs authenticated surfaces:** no in-app auth boundary; all local data belongs to the device user. The API artifact currently exposes only `/api/healthz` and no protected routes.
- **Usually ignore unless production reachability changes:** `artifacts/mockup-sandbox/**`, `artifacts/mobile/scripts/**`.

## Threat Categories

### Tampering

Because the application is local-first, all invoice and business-profile fields are untrusted at every boundary, including after they have been loaded back from AsyncStorage. The app must normalize persisted records before use, validate enum-like values at load boundaries, and avoid trusting client-computed state when deriving invoice totals or status. Payment links and image sources must be constrained to safe schemes before being embedded into exported content.

### Information Disclosure

The most important confidentiality risk is leakage of invoice, client, and payment data from on-device persistence, generated PDFs, and OS-level sharing flows. The app must avoid exposing this data through unsafe rendering, logs, unintended external handlers, or insecure storage choices that materially weaken the default mobile sandbox. Generated HTML must not execute attacker-controlled content in web preview or printed PDFs.

### Denial of Service

The app can be degraded by oversized or malformed locally supplied data, especially large persisted payloads, huge embedded images, or pathological invoice content that is rendered into PDF/print flows. Production-relevant checks here are bounded parsing and safe handling of malformed persisted state rather than network rate limiting, since the app has no application backend.

### Elevation of Privilege

Classic server-side privilege escalation does not apply because the product has no user roles or multi-user backend. In this project, the relevant privilege boundary is between local app data and more-privileged external handlers such as the browser, mail client, print engine, and share targets. The app must not allow user-controlled content to escape into those handlers in a way that enables script execution, arbitrary navigation, or unintended file/URI access.
