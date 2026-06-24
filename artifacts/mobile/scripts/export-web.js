#!/usr/bin/env node
/**
 * Export the Chaser web build for static hosting (e.g. Vercel) and make it
 * portable across hosts that refuse to serve dot-directories.
 *
 * Expo's web export emits font/icon assets under their source path, which for a
 * pnpm install looks like:
 *
 *   assets/__node_modules/.pnpm/<pkg>/node_modules/.../Feather.<hash>.ttf
 *
 * Expo already rewrites `node_modules` -> `__node_modules` (hosts ignore
 * `node_modules`), but it leaves the pnpm `.pnpm` *dot-directory*. Static hosts
 * such as Vercel and GitHub Pages do not serve files inside directories whose
 * name begins with a dot, so every `.ttf` 404s — vector icons render as boxes
 * and custom fonts fail to load.
 *
 * This script runs the export, renames any dot-directory in the output to a
 * non-dot name, rewrites every reference to it in the emitted text files, and
 * writes a Vercel config. Re-run it any time a fresh deployable build is needed.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "static-build", "web");

const TEXT_EXTS = new Set([
  ".js",
  ".css",
  ".html",
  ".json",
  ".webmanifest",
  ".txt",
  ".map",
]);

function exportWeb() {
  console.log("→ Exporting web build (expo export --platform web)…");
  const res = spawnSync(
    "pnpm",
    ["exec", "expo", "export", "--platform", "web", "--output-dir", "static-build/web"],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, BASE_PATH: "/" },
    }
  );
  if (res.status !== 0) {
    console.error("✗ expo export failed");
    process.exit(res.status ?? 1);
  }
}

/**
 * Recursively rename directories whose name starts with "." (e.g. ".pnpm").
 * Returns a de-duplicated list of [oldName, newName] segment pairs so callers
 * can rewrite URL references that contain them.
 */
function renameDotDirs(dir) {
  const renames = new Map();
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name.startsWith(".")) {
        let newName = name.replace(/^\.+/, "");
        if (!newName) newName = "dot";
        // Avoid colliding with an existing sibling directory.
        let candidate = newName;
        let n = 1;
        while (
          candidate !== name &&
          fs.existsSync(path.join(current, candidate))
        ) {
          candidate = `${newName}_${n++}`;
        }
        fs.renameSync(path.join(current, name), path.join(current, candidate));
        renames.set(name, candidate);
        walk(path.join(current, candidate));
      } else {
        walk(path.join(current, name));
      }
    }
  }
  walk(dir);
  return [...renames.entries()];
}

function rewriteRefs(dir, renames) {
  if (renames.length === 0) return 0;
  const replacements = renames.map(([from, to]) => ({
    re: new RegExp("/" + from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/", "g"),
    to: "/" + to + "/",
  }));
  let changed = 0;
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (TEXT_EXTS.has(path.extname(entry.name))) {
        const orig = fs.readFileSync(full, "utf8");
        let next = orig;
        for (const { re, to } of replacements) next = next.replace(re, to);
        if (next !== orig) {
          fs.writeFileSync(full, next);
          changed++;
        }
      }
    }
  }
  walk(dir);
  return changed;
}

/**
 * Self-verifying safety net: fail the build if any dot-directory remains in the
 * output, or if any emitted text file still references a renamed segment. This
 * guarantees a successful export is genuinely safe to deploy to a static host.
 */
function findDotDirs(dir) {
  const offenders = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(current, entry.name);
      if (entry.name.startsWith(".")) offenders.push(path.relative(dir, full));
      walk(full);
    }
  }
  walk(dir);
  return offenders;
}

function findStaleRefs(dir, renames) {
  if (renames.length === 0) return [];
  const patterns = renames.map(([from]) => ({
    from,
    re: new RegExp("/" + from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/"),
  }));
  const offenders = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (TEXT_EXTS.has(path.extname(entry.name))) {
        const txt = fs.readFileSync(full, "utf8");
        for (const { from, re } of patterns) {
          if (re.test(txt)) {
            offenders.push(`${path.relative(dir, full)} (contains /${from}/)`);
            break;
          }
        }
      }
    }
  }
  walk(dir);
  return offenders;
}

function writeVercelConfig() {
  const cfg = { cleanUrls: true, trailingSlash: false };
  fs.writeFileSync(
    path.join(OUT_DIR, "vercel.json"),
    JSON.stringify(cfg, null, 2) + "\n"
  );
}

function main() {
  exportWeb();

  if (!fs.existsSync(OUT_DIR)) {
    console.error(`✗ Expected output at ${OUT_DIR}, but it does not exist`);
    process.exit(1);
  }

  console.log("→ Sanitizing dot-directories for static hosting…");
  const renames = renameDotDirs(OUT_DIR);
  if (renames.length === 0) {
    console.log("  (no dot-directories found)");
  } else {
    for (const [from, to] of renames) console.log(`  renamed ${from} → ${to}`);
    const changed = rewriteRefs(OUT_DIR, renames);
    console.log(`  rewrote references in ${changed} file(s)`);
  }

  writeVercelConfig();
  console.log("→ Wrote vercel.json");

  console.log("→ Verifying output is safe for static hosting…");
  const dotDirs = findDotDirs(OUT_DIR);
  const staleRefs = findStaleRefs(OUT_DIR, renames);
  if (dotDirs.length || staleRefs.length) {
    console.error("✗ Static-host safety check FAILED:");
    for (const d of dotDirs) console.error(`  dot-directory remains: ${d}`);
    for (const r of staleRefs) console.error(`  stale reference: ${r}`);
    process.exit(1);
  }
  console.log("  ok — no dot-directories or stale references");

  console.log(`\n✓ Web build ready at ${path.relative(ROOT, OUT_DIR)}`);
}

main();
