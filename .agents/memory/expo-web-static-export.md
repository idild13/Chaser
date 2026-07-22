---
name: Expo web export to static hosts (Vercel)
description: Why Expo web exports 404 their fonts/icons on Vercel and how the sanitizer fixes it
---

# Expo web export → static host (Vercel) font/icon 404s

`expo export --platform web` emits font/icon `.ttf` assets under
`assets/__node_modules/.pnpm/...`. Expo renames `node_modules` → `__node_modules`
but leaves the `.pnpm` **dot-directory**. Vercel (and most static hosts) do not
serve dot-directories, so every `.ttf` 404s → vector icons render as boxes and
custom fonts silently fall back.

**Fix:** `artifacts/mobile/scripts/export-web.js` (npm script `export:web`).
It runs the export, then recursively renames dot-directories in the output
(`.pnpm` → `pnpm`), rewrites `/.pnpm/` URL references inside emitted text files
(js/css/html/json/webmanifest/txt/map), writes `vercel.json`
(`cleanUrls`/`trailingSlash:false`), and finally asserts the output is clean
(fails the build if any dot-directory or stale `/.pnpm/` ref remains).

**Why:** the broken reference is invisible at build time — export "succeeds" and
only 404s once deployed. The post-export assertion turns that silent deploy-time
failure into a loud build-time failure.

**How to apply:** never hand a raw `expo export` web build to a static host;
always go through `export:web`. The lone `_expo/.routes.json` dotfile that
remains is server-runtime metadata, unreferenced by client URLs and harmless for
static hosting. Keep `app.json` `web.output: "static"` (with `"single"`,
expo-router ignores `+html.tsx` and the PWA head tags vanish).

**Vercel now builds from source (July 2026):** the GitHub repo is connected to
the user's Vercel project, and a root `vercel.json` sets
`buildCommand: pnpm --filter @workspace/mobile run export:web` with
`outputDirectory: artifacts/mobile/static-build/web`; root `package.json` pins
`packageManager` so Vercel's corepack matches the workspace pnpm. Manual
ZIP/upload packaging is only a fallback — do not commit build output to the
repo. **Gotcha:** a dashboard-connected Vercel project that previously served
plain static files has no build step; pushing source without a root
`vercel.json` makes every production deploy fail while the old deployment
stays live.

**Env constraint when packaging the build:** this container has no
`zip`/`python3`/`bsdtar`/`7z`/`jar` — only `tar` + `node`. Build the deploy ZIP
with a short Node `zlib.deflateRawSync` + CRC32 + central-directory script
(deleted after use). Background/detached processes are killed when a bash call
returns, so the export must finish in one foreground call ≤120s; pipe its output
to a persistent logfile (not `| tail`, which buffers and is lost on kill).
