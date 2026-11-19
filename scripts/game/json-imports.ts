// Lets Node import the app's JSON modules as Metro and Vitest do, with no `with { type: "json" }` (src/campaign/fixtures.ts imports the fixture files
// that way, since Metro needs static imports). Loaded with `node --import` before the script (scripts/cli.ts, the game group): a static import inside
// the script would come too late, since every static import is loaded before any module runs. It changes nothing else.
import { registerHooks } from "node:module";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".json") && context.importAttributes.type !== "json") return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
    return nextLoad(url, context);
  },
});
