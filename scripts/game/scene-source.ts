// `pnpm game scene <scenario-id> '<layout>'`: a table built from a layout, as a card's test builds its moment (test/harness/layout.ts, `tableFromLayout`),
// read as a `pnpm game` source with no intents, so `show`'s `--legal` and `--send` try a card before a test is written. The layout is the test kit's
// `Layout` as JSON, inline or from a file (`@<path>`): `{"phase":"Combat","engaged":["01096"],"hand":["01020"]}`. The heroes are the kit's stand-ins; a
// player card the layout names that the scenario does not deal is loaded from data/cards for this table.
import { readFileSync } from "node:fs";
import path from "node:path";

import { printedIn, tableFromLayout, type Layout, type LayoutTable } from "../../test/harness/layout.ts";
import type { GameSource } from "./source.ts";

/** The layout an argument gives: JSON, or `@<file>` holding JSON, read from the folder pnpm was started in. */
export function layoutOf(text: string | undefined, cwd: string): Layout {
  if (text === undefined || text === "") return {};
  const json = text.startsWith("@") ? readFileSync(path.resolve(cwd, text.slice(1)), "utf8") : text;
  try {
    return JSON.parse(json) as Layout;
  } catch (error) {
    throw new Error(`the layout is not JSON (${error instanceof Error ? error.message : String(error)}): ${json.slice(0, 80)}`, { cause: error });
  }
}

// Every card code the layout names: a string that is a code, or the `code` of an entry. The scenario's own cards and the stand-ins are already on the table.
function codesOf(value: unknown, out: Set<string>): Set<string> {
  if (typeof value === "string" && /^\d{5,6}$/.test(value)) out.add(value);
  else if (Array.isArray(value)) for (const item of value) codesOf(item, out);
  else if (typeof value === "object" && value !== null) for (const item of Object.values(value)) codesOf(item, out);
  return out;
}

/** The table of a layout, with the cards of data/cards that the layout names and the scenario does not deal. */
export function sceneTable(scenarioId: string, layout: Layout): LayoutTable {
  const extra = [...codesOf(layout, new Set())].filter((code) => printedIn(scenarioId, code) === undefined);
  return tableFromLayout(scenarioId, layout, { extra });
}

export function sceneSource(scenarioId: string, layout: Layout): GameSource {
  const table = sceneTable(scenarioId, layout);
  return { label: `scene of ${scenarioId} ${JSON.stringify(layout)} (stand-in heroes ${table.hero}${table.hero2 ? `, ${table.hero2}` : ""})`, ctx: table.ctx, opening: table.state, intents: [] };
}
