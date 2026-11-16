import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type * as phone from "booklet-pdf";
import type * as web from "./pdf-module";

// metro.config.js serves pdf-module.ts for "booklet-pdf" on the web platform, so it has the phone module's exports. The web module is read as text:
// importing it would load react-native, which Vitest cannot parse.
function sameShape(_module: typeof phone): void {}
sameShape(null as unknown as typeof web);

function exportedFunctions(file: string): string[] {
  return [...readFileSync(new URL(file, import.meta.url), "utf8").matchAll(/^export (?:async )?function (\w+)/gm)].map((match) => match[1] ?? "").sort();
}

describe("the web booklet-pdf", () => {
  it("has the phone module's exported functions", () => {
    expect(exportedFunctions("./pdf-module.ts")).toEqual(exportedFunctions("../../../../modules/booklet-pdf/index.ts"));
  });
});
