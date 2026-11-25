import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { Effect, ModifierStat } from "../../catalog/boundary.ts";
import { modifierStatSchema } from "../../catalog/effect-schema-stats.ts";
import { EFFECTS } from "../../effects/index.ts";
import { hero, table, treachery } from "../families/defense/table.ts";
import { noteTreacheryReveal } from "../families/wilderland/rounds.ts";
import { whenRevealedUncancelable } from "../families/wilderland/heath.ts";
import { flagged } from "./state.ts";
import { moveCard } from "./zones.ts";
import { ENGINE_MADE_EFFECTS, ENGINE_MARKS, endLastingOn } from "./lasting.ts";

// Rules: rr.in-play-and-out-of-play, rr.lasting-effects (data/rules/entries.json).
// A card that leaves play loses the lasting effects of abilities it held, not what the engine remembers about the round under its id.

const NAMES: ReadonlySet<string> = new Set(modifierStatSchema.options);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

// The stat names engine code writes into a modifier: a line that makes one (`sourceId:` of an object literal, `addModifier(`, `addClassModifier(`, `mark(`, `withModifier(`) and names a stat.
function madeByEngine(): Set<string> {
  const found = new Set<string>();
  for (const file of sources("src/rules")) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!/(sourceId:|addModifier\(|addClassModifier\(|\bmark\(|withModifier\()/.test(line)) continue;
      if (/(\.stat ===|\.stat !==|flagged\(|heldAmount\(|modifiedStat\(|gameReads\()/.test(line)) continue;
      for (const match of line.matchAll(/"([A-Za-z]+)"/g)) if (NAMES.has(match[1]!)) found.add(match[1]!);
    }
    // A stat held in a constant (`const CONTROLLED_BY = "controlSeat" as const`) that a modifier is then made with.
    for (const match of readFileSync(file, "utf8").matchAll(/^const [A-Z_]+ = "([A-Za-z]+)" as const;/gm)) if (NAMES.has(match[1]!)) found.add(match[1]!);
  }
  return found;
}

// The stats the verbs of the effect records make a modifier of (ModifyStat, SetStatUntil, ModifyStatVersus).
function namedByRecords(): Set<string> {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value == null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if ((record.verb === "ModifyStat" || record.verb === "SetStatUntil" || record.verb === "ModifyStatVersus") && typeof record.stat === "string") found.add(record.stat);
    Object.values(record).forEach(walk);
  };
  EFFECTS.forEach((effect: Effect) => walk(effect.instructions));
  return found;
}

describe("the modifiers that end when a card leaves play", () => {
  it("classifies every stat engine code writes into a modifier: a mark that stays or an effect that ends", () => {
    const unclassified = [...madeByEngine()].filter((name) => !ENGINE_MARKS.has(name as ModifierStat) && !ENGINE_MADE_EFFECTS.has(name as ModifierStat));
    expect(unclassified, "add each to ENGINE_MARKS (a rule reads it after the card left play) or ENGINE_MADE_EFFECTS (src/rules/core/lasting.ts)").toEqual([]);
  });

  it("has no name in both groups, and every name in a group is a modifier stat", () => {
    expect([...ENGINE_MARKS].filter((name) => ENGINE_MADE_EFFECTS.has(name))).toEqual([]);
    expect([...ENGINE_MARKS, ...ENGINE_MADE_EFFECTS].filter((name) => !NAMES.has(name))).toEqual([]);
  });

  it("never lets an effect record name a mark: what a record makes always ends", () => {
    expect([...namedByRecords()].filter((name) => ENGINE_MARKS.has(name as ModifierStat))).toEqual([]);
  });

  it("drops an effect of the card and keeps a mark, a constant effect and the modifiers of other holders", () => {
    const base = { sourceId: "x", amount: 1, until: "endOfRound" as const };
    const modifiers = [
      { ...base, instanceId: "c", stat: "doesNotReady" as const },
      { ...base, instanceId: "c", stat: "engagedThisRound" as const },
      { ...base, instanceId: "c", stat: "attack" as const, origin: "constant" },
      { ...base, instanceId: "d", stat: "doesNotReady" as const },
      { ...base, instanceId: "table", stat: "doesNotReady" as const },
    ];
    const after = endLastingOn({ ...table({ cards: [hero("h")], effects: [], heroes: [{ code: "h" }] }).state, modifiers }, "c");
    expect(after.modifiers.map((modifier) => `${modifier.instanceId}:${modifier.stat}`)).toEqual(["c:engagedThisRound", "c:attack", "d:doesNotReady", "table:doesNotReady"]);
  });
});

describe("a mark of the engine on a card that leaves play", () => {
  // "The first treachery revealed each round" (19137:B:1): the card the round marked first is the one its When Revealed effects cannot be canceled for, and it is in the discard pile when a Response asks.
  const CANCEL = { id: "shield:response:1", cardCode: "shield", lines: ["shield:A:1"], timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] } as unknown as Effect;
  const RULE: Effect = { id: "gate:constant:1", cardCode: "gate", lines: ["gate:A:1"], timing: "constant", instructions: [{ verb: "UncancelableWhenRevealed", firstRevealedEachRound: true }] };

  it("stays: the first treachery of the round is still the first one after it is discarded, and the second is not", () => {
    const built = table({ cards: [hero("gate"), treachery("t1"), treachery("t2")], effects: [RULE, CANCEL], heroes: [{ code: "gate" }], staging: [{ code: "t1" }, { code: "t2" }] });
    const first = built.ids.t1!;
    const second = built.ids.t2!;
    let state = noteTreacheryReveal(noteTreacheryReveal(built.state, first, built.ctx), second, built.ctx);
    expect(flagged(state, first, "firstTreachery")).toBe(true);
    state = moveCard(moveCard(state, first, { zone: "encounterDiscard" }), second, { zone: "encounterDiscard" });
    expect(flagged(state, first, "firstTreachery"), "the mark outlives the card's time in play").toBe(true);
    expect(whenRevealedUncancelable(state, { trigger: "whenRevealedPending", seat: 0, subject: first }, CANCEL, built.ctx)).toBe(true);
    expect(whenRevealedUncancelable(state, { trigger: "whenRevealedPending", seat: 0, subject: second }, CANCEL, built.ctx)).toBe(false);
  });
});
