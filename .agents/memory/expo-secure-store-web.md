---
name: expo-secure-store has no web implementation
description: Why secure storage in the Chaser mobile app (artifacts/mobile) must be platform-guarded, and the RN bottom-sheet scroll pattern.
---

# expo-secure-store on web + RN sheet scrolling

## expo-secure-store is native-only

`expo-secure-store` has NO web implementation. Importing it on web is fine, but
calling any method (e.g. `getItemAsync`) throws `ExpoSecureStore.default.
getValueWithKeyAsync is not a function` and crashes the whole app on load.

**Rule:** any secure-storage wrapper must branch on `Platform.OS === "web"` and fall
back to AsyncStorage (localStorage-backed) on web. The OS keychain isn't available on
web anyway, and pre-existing data already lived in AsyncStorage there, so the fallback
also preserves data. See `artifacts/mobile/utils/secureStore.ts`.

**Why:** Chaser is previewed and used on web (Expo web), not just native. A native-only
API in the persistence layer takes the entire app down on web. This was a real
regression — a security migration to SecureStore broke web load completely.

**How to apply:** before using ANY expo-* native module in this app, confirm it supports
web; if not, guard with `Platform.OS` and provide a web fallback. Verify with the
interactive (Playwright) test runner, which loads the app on web and catches these
crashes that typecheck cannot.

## RN bottom-sheet ScrollView must be height-bounded

A `ScrollView` only scrolls when an ancestor has a bounded height. For a bottom-sheet
modal (`overlay flex:1 justifyContent:flex-end` → `KeyboardAvoidingView` → sheet with
`maxHeight:"90%"` → ScrollView): the KeyboardAvoidingView needs `flex:1` (otherwise the
sheet's `maxHeight` percentage resolves against an unbounded parent and content just
overflows offscreen instead of scrolling), and the inner wrapper + ScrollView need
`flexShrink:1` so the ScrollView shrinks to the remaining space. Note RN's default
`flexShrink` is 0 (unlike web), so it must be set explicitly.
