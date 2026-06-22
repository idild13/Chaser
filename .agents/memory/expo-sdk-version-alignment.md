---
name: Expo SDK version alignment
description: Native expo-* modules must match the installed Expo SDK; the web preview masks mismatches until you run on a device.
---

# Expo SDK version alignment

Rule: every `expo-*` package must be on the version line that matches the project's Expo SDK (check the `expo` version in `artifacts/mobile/package.json`). Do not trust arbitrary/high version numbers a previous install may have pinned (this app once had expo-clipboard/print/secure-store/sharing pinned to `^56.x` on SDK 54) — align to the versions the SDK expects.

**Why:** the mobile artifact runs in two modes — a web preview (browser; used by the canvas and by the Playwright e2e tests) and native Expo Go (used by real beta testers and production). The web build substitutes JS shims for native modules, so a native-module version mismatch is completely invisible on web: typecheck passes, Metro bundles, and e2e passes — yet the native module can fail to load in Expo Go and break features only on-device. For expo-secure-store that means the entire persistence layer silently breaks on real phones.

**How to apply:** before any on-device beta/publish, confirm the Expo compatibility check is clean. The expo dev server prints "The following packages should be updated for best compatibility with the installed expo version:" with the expected version next to each drifted package. Fix by setting each flagged package to the reported expected version, run `pnpm install`, restart the `artifacts/mobile: expo` workflow, and re-typecheck. Never certify native readiness from web e2e alone.
