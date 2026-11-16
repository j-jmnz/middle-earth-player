const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push("sql");

for (const extension of ["wasm", "pdf"]) {
  if (!config.resolver.assetExts.includes(extension)) config.resolver.assetExts.push(extension);
}

// The booklet PDFs are not in git. `pnpm assets booklets` writes them and a map that requires them to assets/booklets
// (gitignored; not a dot directory, which iOS would copy into the app as a hidden folder);
// when that map exists, it is bundled in place of the empty stub in src/screens/booklets.
const bookletStub = path.join(__dirname, "src/screens/booklets/bundled-map.ts");
const bookletMap = path.join(__dirname, "assets/booklets/bundled-map.ts");
// Said once per Metro start, so a bundle without the books is never a surprise.
console.log(
  fs.existsSync(bookletMap)
    ? "booklets: bundling the packed PDFs from assets/booklets"
    : "booklets: not packed, so this bundle carries none. Run pnpm assets booklets, then restart Metro with --clear.",
);
// The web has no native module for the booklet reader: `booklet-pdf` resolves to the pdf.js reader on the web platform only
// (src/screens/booklets/web/pdf-module.ts), so the screens that import it need no web branch and the phone's bundle never sees it.
const webBookletPdf = path.join(__dirname, "src/screens/booklets/web/pdf-module.ts");
// The phone's files are never edited for the desktop (.claude/rules, phone-only files), and neither is a shared file's phone path. Where the web needs more than they
// do, the web platform serves `X.canvaskit.ts(x)` in place of `X.native.ts(x)` or `X.ts(x)`, from beside it or from a `web` folder beside it, and that file imports the
// phone's without the file extension (a request from the variant itself is not redirected; Metro keeps one answer for a specifier a folder asks twice, so the variant must
// ask in other words than the phone's own importers do).
const variants = new Map();
const canvaskitOf = (filePath) => {
  if (!variants.has(filePath)) {
    const name = path.basename(filePath).replace(/(\.native)?\.(tsx?)$/, ".canvaskit.$2");
    const found = name === path.basename(filePath) ? [] : [path.join(path.dirname(filePath), name), path.join(path.dirname(filePath), "web", name)];
    variants.set(filePath, found.find((file) => fs.existsSync(file)) ?? null);
  }
  return variants.get(filePath);
};
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "booklet-pdf") return { type: "sourceFile", filePath: webBookletPdf };
  const resolved = (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  if (platform === "web" && resolved.type === "sourceFile") {
    const web = canvaskitOf(resolved.filePath);
    if (web && web !== context.originModulePath) return { type: "sourceFile", filePath: web };
  }
  if (resolved.type === "sourceFile" && resolved.filePath === bookletStub && fs.existsSync(bookletMap)) {
    return { type: "sourceFile", filePath: bookletMap };
  }
  return resolved;
};

// The Electron shell (desktop/) is not part of the app's bundle, and its build folders hold a web export of about a gigabyte that Metro must not watch.
const desktopFolder = path.join(__dirname, "desktop").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const desktopFiles = new RegExp(`^${desktopFolder}[/\\\\].*`);
config.resolver.blockList = [...[config.resolver.blockList ?? []].flat(), desktopFiles];

const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const enhancedMiddleware = enhanceMiddleware
    ? enhanceMiddleware(middleware, metroServer)
    : middleware;
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    return enhancedMiddleware(req, res, next);
  };
};

module.exports = withNativeWind(config, { input: "./global.css", inlineRem: false });
