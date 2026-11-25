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
// A card that leaves play loses the lasting effects of abilities it held, not what the engine remembers about the round under its id (the reading is docs/brief.md, Core round: `recommended`, no span states it).

const NAMES: ReadonlySet<string> = new Set(modifierStatSchema.options);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

// The stat names engine code writes into a modifier. Forms read, per file:
// - an object literal with a `sourceId:` key, over one line or several (a modifier written by hand), and a line that calls a modifier maker (`addModifier(`, `addClassModifier(`, `mark(`, `withModifier(`) with the name as a literal;
// - a stat held in a constant (`const X = "name"`, `export const`, indented) or in an object map (`const WATCH_STATS = { a: "watchA" }`) in a file that makes modifiers;
// - a literal at a call site of a function that takes a `stat: ModifierStat` parameter and builds a modifier from it.
// A name written any other way is not found, ENDS with its card (src/rules/core/lasting.ts), and must be a rule's own check: NOT_SCANNED lists the files that build a stat name at run time.
const NOT_SCANNED: Readonly<Record<string, string>> = {};
const MAKES = /(sourceId:|addModifier\(|addClassModifier\(|\bmark\(|withModifier\()/;
const READS = /(\.stat ===|\.stat !==|flagged\(|heldAmount\(|modifiedStat\(|gameReads\()/;

function literals(text: string): string[] {
  return [...text.matchAll(/"([A-Za-z]+)"/g)].map((match) => match[1]!).filter((name) => NAMES.has(name));
}

function madeByEngine(): Set<string> {
  const found = new Set<string>();
  const files = sources("src/rules").filter((file) => !(file in NOT_SCANNED));
  const texts = files.map((file) => readFileSync(file, "utf8"));
  // Functions that take a stat and build a modifier from it: `function f(..., stat: ModifierStat, ...) {` whose body names `sourceId`.
  const takers = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(/function (\w+)\([^)]*\bstat: ModifierStat[^)]*\)[^{]*\{([\s\S]*?)\n\}/g)) if (/sourceId|addModifier\(|withModifier\(/.test(match[2]!)) takers.add(match[1]!);
  }
  for (const text of texts) {
    for (const line of text.split("\n")) {
      if (!MAKES.test(line) || READS.test(line)) continue;
      literals(line).forEach((name) => found.add(name));
    }
    // An object literal with a `sourceId:` key, whatever its line breaks (no nested braces).
    for (const block of text.matchAll(/\{[^{}]*\bsourceId:[^{}]*\}/g)) literals(block[0]).forEach((name) => found.add(name));
    // A stat held in a constant or an object map, in a file that makes modifiers.
    if (MAKES.test(text)) {
      for (const match of text.matchAll(/^\s*(?:export )?const [A-Za-z_]+(?::[^=\n]+)? = ("[A-Za-z]+")(?: as const)?;/gm)) literals(match[1]!).forEach((name) => found.add(name));
      for (const match of text.matchAll(/^\s*(?:export )?const [A-Z_]+(?::[^=\n]+)? = \{([^{}]*)\}/gm)) literals(match[1]!).forEach((name) => found.add(name));
    }
    for (const fn of takers) for (const call of text.matchAll(new RegExp(`\\b${fn}\\(([^()]*)\\)`, "g"))) literals(call[1]!).forEach((name) => found.add(name));
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
    // A name an effect record makes is an effect by its verb (the third test below), so it needs no entry.
    const byRecords = namedByRecords();
    const unclassified = [...madeByEngine()].filter((name) => !ENGINE_MARKS.has(name as ModifierStat) && !ENGINE_MADE_EFFECTS.has(name as ModifierStat) && !byRecords.has(name));
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
