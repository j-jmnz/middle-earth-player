// Rules: rr.in-play-and-out-of-play (data/rules/entries.json). Every engine function that sets a card aside, or draws with the game's seed in a file that reads the set-aside cards, is listed
// in ASIDE_SITES under its file, and every file that hides a card names verbs with a declaration in their family. What this holds and what it cannot is in set-aside-sites.ts.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ASIDE_SECRETS, ASIDE_UNUSED } from "../../src/catalog/boundary.ts";
import { CATALOG_FAMILIES } from "../../src/catalog/families/index.ts";
import type { CatalogFamily } from "../../src/catalog/family-manifest.ts";
import { ASIDE_SITES } from "./set-aside-sites.ts";

const RULES = path.resolve(import.meta.dirname, "..", "..", "src", "rules");

// A destination in the set-aside zone written on one line (`{ zone: "setAside" }`, a ternary that ends there, `leaves: "setAside"`); and a draw with the game's seed in a file that reads the set-aside cards.
const WRITES = /zone:[^,}\n]*"setAside"|leaves\??:\s*"setAside"/;
const DRAWS = /\b(shuffleIds|nextUint)\(/;
// The zone's own definition and its bookkeeping: no verb.
const ENGINE = new Set(["core/zones.ts", "core/state-types.ts", "core/state.ts", "engine/state-version.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

const FUNCTION = /^(?:export )?(?:async )?function (\w+)/;

// The top-level functions of a file that hold a site, by the function a line stands in; "(module)" before the first one.
function functionsWithSite(text: string): string[] {
  const reads = text.includes("setAside");
  const found = new Set<string>();
  let current = "(module)";
  for (const line of text.split("\n")) {
    current = FUNCTION.exec(line)?.[1] ?? current;
    if (WRITES.test(line) || (reads && DRAWS.test(line))) found.add(current);
  }
  return [...found].sort();
}

const found = new Map(
  sourceFiles(RULES)
    .map((file) => [path.relative(RULES, file).split(path.sep).join("/"), functionsWithSite(readFileSync(file, "utf8"))] as const)
    .filter(([file, functions]) => functions.length > 0 && !ENGINE.has(file)),
);
const sites = [...found.keys()].sort();

describe("the engine's set-aside sites", () => {
  it("are each sorted into public, secret or not listed, and no entry names a file without one", () => {
    expect(sites.filter((file) => !(file in ASIDE_SITES)), "sort each new file in scripts/checks/set-aside-sites.ts: does it leave a card set aside that the players must not see?").toEqual([]);
    expect(Object.keys(ASIDE_SITES).filter((file) => !sites.includes(file)), "stale entries").toEqual([]);
  });

  it("list, for each file, exactly the functions that hold a site, so a new one is read before it passes", () => {
    for (const file of sites) expect(ASIDE_SITES[file]?.functions, `${file}: sort the new function in scripts/checks/set-aside-sites.ts (does it leave a card set aside that the players must not see?)`).toEqual(found.get(file));
  });

  it("name, for each file that hides a card, verbs that declare it in their family", () => {
    const declared = new Set(ASIDE_SECRETS.map((secret) => secret.verb));
    for (const [file, site] of Object.entries(ASIDE_SITES)) {
      if (site.group !== "secret") {
        expect(site.verbs, `${file} is not secret`).toBeUndefined();
        continue;
      }
      expect(site.verbs?.length ?? 0, `${file} hides a set-aside card and names no verb`).toBeGreaterThan(0);
      for (const verb of site.verbs ?? []) expect(declared.has(verb), `${verb} (${file}) has no asideSecrets declaration in src/catalog/families`).toBe(true);
    }
    const named = new Set(Object.values(ASIDE_SITES).flatMap((site) => site.verbs ?? []));
    expect([...declared].filter((verb) => !named.has(verb)), "declared verbs no site names").toEqual([]);
  });

  it("declare only verbs of their own family, with fields the verb has and a way to find the cards", () => {
    const families: readonly CatalogFamily[] = CATALOG_FAMILIES;
    const shapeOf = (verb: string, among: readonly CatalogFamily[]) => among.flatMap((family) => family.verbs).find((schema) => schema.shape.verb.value === verb)?.shape as Record<string, unknown> | undefined;
    for (const secret of ASIDE_SECRETS) {
      const shape = shapeOf(secret.verb, families.filter((family) => family.name === secret.family));
      expect(shape, `${secret.family} has no verb ${secret.verb}`).toBeDefined();
      for (const field of [...(secret.codes ?? []), ...(secret.names ?? [])]) expect(shape && field in shape, `${secret.verb} has no field ${field}`).toBe(true);
      expect((secret.codes?.length ?? 0) + (secret.names?.length ?? 0) > 0 || secret.deck === true, `${secret.verb} says no card to hide`).toBe(true);
      if (secret.openSets) {
        const open = shapeOf(secret.openSets.verb, families);
        expect(open && secret.openSets.field in open, `${secret.openSets.verb} has no field ${secret.openSets.field}`).toBe(true);
      }
    }
    // The verbs that park unused cards name their encounter sets the same way.
    for (const unused of ASIDE_UNUSED) {
      const shape = shapeOf(unused.verb, families.filter((family) => family.name === unused.family));
      expect(unused.sets.length).toBeGreaterThan(0);
      for (const field of unused.sets) expect(shape && field in shape, `${unused.verb} has no field ${field}`).toBe(true);
    }
  });
});
