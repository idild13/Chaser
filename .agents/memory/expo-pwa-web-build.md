---
name: Expo PWA / web build for the mobile artifact
description: How Chaser's mobile artifact serves an installable web PWA without breaking the native Expo Go deploy, and the output:"static" requirement for +html.tsx.
---

# Expo PWA + native Expo Go coexistence (mobile artifact)

- **`web.output` must be `"static"` (not `"single"`) for a PWA.** With `output: "single"`, expo-router does NOT apply `app/+html.tsx`, so the exported `index.html` is the stock template with no manifest link / theme-color / service-worker registration. Only `output: "static"` applies `+html.tsx` to every route's HTML.
  **Why:** burned a chunk of a session assuming `+html.tsx` was being applied under `single`; the export quietly used the default template and PWA `<head>` tags were silently missing.
  **How to apply:** if PWA `<head>` tags or SW registration go missing from the web export, check `web.output` first.

- **The mobile artifact's DEPLOYED form is a native Expo Go build, not a web app.** `scripts/build.js` downloads ios/android bundles + Expo manifests into `static-build/`; `server/serve.js` serves the Expo manifest when the request carries an `expo-platform: ios|android` header, otherwise it serves web / landing content. Web/PWA support is purely additive.
  **Why:** the user's hard constraint was "make it an installable PWA without affecting the native build."
  **How to apply:** in `serve.js`, the `expo-platform` manifest branch and native static files MUST be matched BEFORE any web serving, or Expo Go clients break. Keep the web export best-effort in `build.js` (log a warning, never abort the native build on web-export failure).

- **SSR safety under `output: "static"`.** Static export renders every route in Node at export time. This local-only app (AsyncStorage touched in effects, not at module load) renders SSR-safe — all routes export without crashing. If a future change reads `window`/`document`/`localStorage` *during render* (not inside an effect), static export will crash.

- **Offline scope.** `sw.js` precaches only `/`, the manifest, and icons; hashed `/_expo/` JS/CSS enter the cache via stale-while-revalidate after the first successful load. So offline works after first load, but offline *immediately* after first install (before assets are fetched) is not guaranteed. Acceptable for "installable"; if true offline-first is ever required, inject the exported `/_expo/` asset list into the SW precache at build time.
