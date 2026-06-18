/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with two special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 * - GET / without expo-platform → landing page HTML
 * Everything else falls through to static file serving from ./static-build/.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const WEB_ROOT = path.join(STATIC_ROOT, "web");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: `Manifest not found for platform: ${platform}` }),
    );
    return;
  }

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(content);
}

function resolveSafe(root, urlPath) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(root, safePath);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return null;
  }
  return filePath;
}

function sendFile(filePath, res, extraHeaders) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType, ...(extraHeaders || {}) });
  res.end(content);
}

function webBuildExists() {
  return fs.existsSync(path.join(WEB_ROOT, "index.html"));
}

// Serve native build artifacts (timestamped bundles/assets, ios/android
// manifest dirs) exactly as before. Returns true if it handled the request.
// The web/ subtree is intentionally excluded — that is serveWeb's job.
function serveNativeFileIfExists(pathname, res) {
  const filePath = resolveSafe(STATIC_ROOT, pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  if (filePath === WEB_ROOT || filePath.startsWith(WEB_ROOT + path.sep)) {
    return false;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(filePath, res);
    return true;
  }
  return false;
}

function webHeadersFor(filePath, rel) {
  const base = path.basename(filePath);
  if (base === "sw.js") {
    return { "cache-control": "no-cache", "service-worker-allowed": "/" };
  }
  if (base === "manifest.webmanifest" || base === "index.html") {
    return { "cache-control": "no-cache" };
  }
  if (rel.startsWith("/_expo/")) {
    return { "cache-control": "public, max-age=31536000, immutable" };
  }
  return {};
}

// Serve the web/PWA build with SPA fallback (extensionless routes -> index).
function serveWeb(pathname, res) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolveSafe(WEB_ROOT, rel);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return sendFile(filePath, res, webHeadersFor(filePath, rel));
  }

  // Extensionless route: prefer the matching pre-rendered static HTML, then
  // fall back to the app shell (index.html) so client-side routing can resolve.
  if (!path.extname(pathname)) {
    const htmlPath = resolveSafe(WEB_ROOT, `${rel}.html`);
    if (htmlPath && fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
      return sendFile(htmlPath, res, { "cache-control": "no-cache" });
    }
    const indexPath = path.join(WEB_ROOT, "index.html");
    if (fs.existsSync(indexPath)) {
      return sendFile(indexPath, res, { "cache-control": "no-cache" });
    }
  }

  res.writeHead(404);
  res.end("Not Found");
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
const appName = getAppName();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  // 1) Expo Go native manifest — MUST stay first so iOS/Android keep working.
  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      return serveManifest(platform, res);
    }
  }

  // 2) Native build artifacts (timestamped bundles/assets) — unchanged behavior.
  if (pathname !== "/" && serveNativeFileIfExists(pathname, res)) {
    return;
  }

  // 3) Web/PWA build for browsers — only when a web export is present.
  if (webBuildExists()) {
    return serveWeb(pathname, res);
  }

  // 4) Fallback: original landing page for browsers, else static 404.
  if (pathname === "/") {
    return serveLandingPage(req, res, landingPageTemplate, appName);
  }
  serveStaticFile(pathname, res);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving static Expo build on port ${port}`);
});
