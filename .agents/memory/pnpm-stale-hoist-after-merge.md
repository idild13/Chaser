---
name: Stale pnpm node_modules after a dependency-version change
description: Why a merged dependency bump can leave node_modules broken even though `pnpm install` says "up to date" — and the worklets/@babel/generator symptom in the Expo app.
---

# Stale pnpm hoisting after a dependency-version merge

## Symptom

After a task that changes dependency versions merges (e.g. an override bump in
`pnpm-workspace.yaml` like `@babel/core`), the Expo (mobile) bundle fails with:

```
[BABEL] .../expo-router/entry.js: Cannot find module '@babel/generator'
  (require stack rooted in react-native-worklets/plugin/index.js)
```

The app may serve a 200 HTML shell but the JS bundle never compiles, so the
preview is blank / errors.

## Root cause

`react-native-worklets` does a bare `require('@babel/generator')` in its babel
plugin but does NOT declare `@babel/generator` in its `dependencies` or
`peerDependencies` (it only peers on `@babel/core`). It relies on
`@babel/generator` being **hoisted** to `node_modules/.pnpm/node_modules/@babel/generator`
(it comes transitively from `@babel/core`). When a version change re-resolves the
tree, node_modules can be left in a stale state where that hoist link is missing.

The trap: plain `pnpm install` reports **"Lockfile is up to date … Already up to
date"** and does NOT repair the missing hoist, because pnpm's bookkeeping thinks
the store is consistent.

## Fix

Run `pnpm install --force` to force a full relink of node_modules from the
lockfile. Verify the hoist is restored:

```
ls node_modules/.pnpm/node_modules/@babel/ | grep -ix generator   # must print "generator"
```

Then restart the `artifacts/mobile: expo` workflow and confirm Metro logs show
`Web Bundled … (NNNN modules)` with no `[BABEL]` error.

**Why this matters:** post-merge setup (drizzle push etc.) does NOT necessarily run
a full reinstall, so a merged dependency bump can ship a half-materialized
node_modules. When an app breaks right after a dependency task merges and a normal
`pnpm install` is a no-op, reach for `pnpm install --force` before changing any
versions or adding overrides — the lockfile is usually correct; only the on-disk
linking is stale.
