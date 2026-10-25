const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push("sql");

for (const extension of ["wasm", "pdf"]) {
  if (!config.resolver.assetExts.includes(extension)) config.resolver.assetExts.push(extension);
}

// The booklet PDFs are not in git. `pnpm booklets:pack` writes them and a map that requires them to .cache/booklets;
// when that map exists, it is bundled in place of the empty stub in src/screens/booklets.
const bookletStub = path.join(__dirname, "src/screens/booklets/bundled-map.ts");
const bookletMap = path.join(__dirname, ".cache/booklets/bundled-map.ts");
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

module.exports = withNativeWind(config, { input: "./global.css" });
