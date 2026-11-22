import { describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS, AUTHORED_REPLACES } from "../../src/effects/index.ts";
import { withPool } from "../data/printed/pool.ts";
import { loadCards } from "../data/load-cards.ts";
import { generateEffects } from "../data/effects/generate.ts";
import { loadCampaign, loadScenarios } from "../data/load-scenarios.ts";
import { loadLedger } from "../data/printed/ledger.ts";

// The migration check (docs/agents/effect-authoring.md, Templates and copied lines). A template that comes to read a line an authored
// record owns writes a record of its own. Three outcomes:
//   - same id, deep-equal: the authored record is redundant. Delete it.
//   - same id, different: the generated record is the one the template writes and the authored one overrides it. That
//     is only allowed where AUTHORED_REPLACES lists the id (with the reason beside it); otherwise narrow the template
//     so it does not read this line, or settle the authored record to the generated one and delete it.
//   - different id, same line: both would run on one printed line. Delete the authored record if it is the same
//     effect, or narrow the template (a constant line takes the next free `constant` number, so a new constant
//     template can take an authored record's id).
const cards = loadCards();
const scenarios = loadScenarios();
const campaign = loadCampaign();
const lines = withPool(loadLedger(), cards);
const generated = generateEffects(cards, scenarios, campaign, lines).effects;

type Row = { id: string; kind: "equal" | "differs" | "other-id"; lines: string[]; generatedId?: string };

function rows(): Row[] {
  const byId = new Map(generated.map((effect) => [effect.id, effect]));
  const byLine = new Map<string, string[]>();
  for (const effect of generated) for (const line of effect.lines) byLine.set(line, [...(byLine.get(line) ?? []), effect.id]);
  const out: Row[] = [];
  for (const authored of AUTHORED_EFFECTS) {
    const twin = byId.get(authored.id);
    if (twin) {
      const same = JSON.stringify(sortKeys(twin)) === JSON.stringify(sortKeys(authored));
      out.push({ id: authored.id, kind: same ? "equal" : "differs", lines: authored.lines });
      continue;
    }
    const others = authored.lines.flatMap((line) => byLine.get(line) ?? []);
    if (others.length > 0) out.push({ id: authored.id, kind: "other-id", lines: authored.lines, generatedId: others.join(",") });
  }
  return out;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]));
  return value;
}

describe("authored records a template now writes", () => {
  const found = rows();
  const show = (list: Row[]): string => list.map((row) => `${row.id} (${row.lines.join(" ")})${row.generatedId ? ` vs generated ${row.generatedId}` : ""}`).join("\n  ");

  it("has none that a generated record equals: delete them", () => {
    const equal = found.filter((row) => row.kind === "equal");
    expect(equal.length, `generated and authored records are deep-equal; delete the authored ones:\n  ${show(equal)}`).toBe(0);
  });

  it("has no id the generated record shares and the authored record changes, unless AUTHORED_REPLACES lists it", () => {
    const unlisted = found.filter((row) => row.kind === "differs" && !AUTHORED_REPLACES.includes(row.id));
    expect(unlisted.length, `authored records differ from the generated one of the same id:\n  ${show(unlisted)}`).toBe(0);
  });

  it("has no authored record on a line a generated record with another id writes", () => {
    const doubled = found.filter((row) => row.kind === "other-id");
    expect(doubled.length, `a line has an authored and a generated record:\n  ${show(doubled)}`).toBe(0);
  });
});
