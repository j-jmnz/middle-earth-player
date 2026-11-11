import { describe, expect, it } from "vitest";

import type { Effect } from "../../../../src/catalog/boundary.ts";
import type { Card } from "../../../../src/catalog/card-facts.ts";
import type { Segment } from "../generate.ts";
import { renderAmount } from "./amounts.ts";
import { renderCard } from "./cards.ts";
import { renderCondition } from "./conditions.ts";
import { newCtx, type Obj } from "./kit.ts";
import { BARS } from "./bars.ts";
import { FAMILY_FLAGS } from "../../../../src/catalog/families/index.ts";
import { renderPick } from "./picks.ts";
import { renderRecord } from "./record.ts";
import { renderInstruction } from "./verbs.ts";

// The reading aid (scripts/data/effects/render.ts): a template per piece, JSON for a piece with none, and no field hidden.
describe("effects render templates", () => {
  it("renders a pick as a noun phrase", () => {
    const ctx = newCtx();
    expect(renderPick({ type: "enemy", control: "any", stagingOnly: true, names: ["Urdug"] }, ctx)).toBe('enemy (any player controls) in the staging area only, named "Urdug"');
    expect(ctx.tally).toEqual({ template: 1, json: 0 });
  });

  it("renders amounts, with times and plus", () => {
    const ctx = newCtx();
    expect(renderAmount({ players: true, times: 5, plus: -1 }, ctx, renderPick)).toBe("the number of players x 5 - 1");
    expect(renderAmount(3, ctx, renderPick)).toBe("3");
  });

  it("renders a condition and its negation", () => {
    const ctx = newCtx();
    expect(renderCondition({ kind: "not", condition: { kind: "namedFlag", name: "The Heroes' Defense", stat: "noResourcesPlaced" } }, ctx)).toBe(
      "not (the card in play titled \"The Heroes' Defense\" holds the flag noResourcesPlaced)",
    );
  });

  it("renders a Choose with its options indented", () => {
    const ctx = newCtx();
    const lines = renderInstruction({ verb: "Choose", who: "firstPlayer", options: [{ id: "a", instructions: [{ verb: "AdvanceStage" }] }, { id: "b", requires: { kind: "firstPlayer" }, instructions: [{ verb: "WinGame" }] }] }, ctx);
    expect(lines).toEqual([
      "- the first player chooses one of:",
      '  * option "a":',
      "    - advance to the next quest stage",
      '  * option "b" (only if the actor holds the first player token):',
      "    - the players win the game",
    ]);
  });

  it("prints a verb with no template as compact JSON and counts it", () => {
    const ctx = newCtx();
    expect(renderInstruction({ verb: "NoSuchVerb", n: 1 }, ctx)).toEqual(['- [json NoSuchVerb {"verb":"NoSuchVerb","n":1}]']);
    expect(ctx.tally.json).toBe(1);
  });

  it("shows a field a template does not read instead of dropping it", () => {
    const ctx = newCtx();
    expect(renderInstruction({ verb: "AdvanceStage", surprise: true }, ctx)).toEqual(['- advance to the next quest stage [also {"surprise":true}]']);
  });

  it("renders a record header, its condition and its instructions", () => {
    const ctx = newCtx();
    const record: Obj = { id: "1:response:1", cardCode: "1", lines: ["1:A:1"], timing: "response", trigger: "enemyDestroyed", limit: "oncePerRound", condition: { kind: "firstPlayer" }, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] };
    expect(renderRecord(record, ctx)).toEqual(["1:response:1: Response after an enemy is destroyed (limit once per round)", "  only if the actor holds the first player token", "  - place 1 resource tokens on this card"]);
  });

  it("lists a line no record names and a record naming no line", () => {
    const card = { code: "1", name: "Test Card" } as Card;
    const segment: Segment = { card, index: 0, side: "front", line: "Forced: do a thing.", lineId: "1:A:1" };
    const stray = { id: "1:forced:1", cardCode: "1", lines: ["1:A:9"], timing: "forced", instructions: [{ verb: "WinGame" }] } as Effect;
    const text = renderCard(card, [segment], [stray], new Set()).text;
    expect(text).toContain("NO RECORD NAMES THIS LINE");
    expect(text).toContain("RECORD NAMING NO LINE OF THIS CARD (1:A:9)");
  });

  it("names the moment a trigger fires and who an attack from the staging area targets", () => {
    const ctx = newCtx();
    expect(renderRecord({ id: "1:forced:1", cardCode: "1", lines: ["1:A:1"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "AttackFromStaging", who: "firstPlayer" }] }, ctx)[0]).toBe(
      "1:forced:1: Forced when this enemy attacks, before the defender is declared (heard about this card)",
    );
    expect(renderInstruction({ verb: "AttackFromStaging", who: "firstPlayer" }, ctx)).toEqual(["- the picked enemy attacks the first player now, from the staging area"]);
  });

  it("reads a later step's condition as checked when that step runs", () => {
    const ctx = newCtx();
    const lines = renderRecord({ id: "1:forced:1", cardCode: "1", lines: ["1:A:1"], timing: "forced", instructions: [{ verb: "ShuffleEncounterDeck" }, { verb: "AdvanceStage", when: { kind: "firstPlayer" } }] }, ctx);
    expect(lines.at(-1)).toContain("then, if the actor holds the first player token (checked when this step runs");
  });

  it("says whether a record is offered while a flag bars its whole effect", () => {
    const setter = { id: "2:constant:1", timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noResourcesPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "objective", control: "any", names: ["Defense"] } }] };
    const base = { id: "1:response:1", cardCode: "1", lines: ["1:A:1"], timing: "response", instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] };
    const open = renderRecord(base, newCtx({ effects: [setter, base], cardName: "Defense" })).join("\n");
    expect(open).toContain("NO condition on it: it IS OFFERED EVEN WHILE noResourcesPlaced BARS ITS EFFECT");
    const guarded = { ...base, condition: { kind: "flag", stat: "noResourcesPlaced", holder: "self", is: false } };
    expect(renderRecord(guarded, newCtx({ effects: [setter, guarded], cardName: "Defense" })).join("\n")).toContain("NOT offered while it bars");
  });

  it("lists only real flags in the barring table", () => {
    for (const flag of Object.keys(BARS)) expect(FAMILY_FLAGS).toContain(flag);
  });
});
