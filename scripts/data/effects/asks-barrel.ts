import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { AnyScenarioData } from "../../../src/catalog/scenario-data.ts";

// The barrel of the asks files (src/play/words/asks/index.ts): the choice words a scenario keeps as data beside its records (src/play/words/asks.ts). Metro cannot glob, so pnpm data build lists them, by scenario id: a game reads only its own scenario's file (asks.ts), never a merge of them. A top-level file of
// src/play/words/asks/ that exports ASKS is named for the scenario whose records it words; a file named for no scenario fails the build.
export function asksFileNames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && entry.name !== "index.ts" && !entry.name.endsWith(".test.ts"))
    .filter((entry) => /export const ASKS\b/.test(readFileSync(path.join(dir, entry.name), "utf8")))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
}

export function checkAsksNames(names: readonly string[], scenarios: readonly Pick<AnyScenarioData, "id">[]): void {
  const known = new Set(scenarios.map((scenario) => scenario.id));
  const unknown = names.filter((name) => !known.has(name));
  if (unknown.length > 0) throw new Error(`src/play/words/asks/${unknown.join(".ts, ")}.ts is named for no scenario in data/: rename it to a scenario id`);
}

export function renderAsksBarrel(names: readonly string[]): string {
  const ident = (name: string) => name.toUpperCase().replaceAll("-", "_");
  return [
    `import type { Ask } from "../asks.ts";`,
    ...names.map((name) => `import { ASKS as ${ident(name)} } from "./${name}.ts";`),
    ``,
    `// Written by pnpm data build from src/play/words/asks/ (scripts/data/effects/asks-barrel.ts). Do not edit.`,
    `export const ASKS_BY_SCENARIO: Readonly<Record<string, Readonly<Record<string, Ask>>>> = {${names.map((name) => ` "${name}": ${ident(name)}`).join(",")}${names.length > 0 ? " " : ""}};`,
    ``,
  ].join("\n");
}
