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
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  if (resolved.type === "sourceFile" && resolved.filePath === bookletStub && fs.existsSync(bookletMap)) {
    return { type: "sourceFile", filePath: bookletMap };
  }
  return resolved;
};

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
