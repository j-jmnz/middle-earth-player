// Rules: ats.cair-andros-location-damage, ats.cair-andros-remove-stage, ats.cair-andros-defense-carry-over, hon.battle, hon.siege, hon.archery, rr.cannot, rr.removed-from-game (data/rules/entries.json); ledger lines 05033:A:1, 05034:A:1, 05035:A:1, 05033:A:2, 05072:B:2, 05073:B:1, 05075:B:2, 05076:B:3, 05057:A:2, 05058:A:1.
// What the table says for The Siege of Cair Andros: the damage on each Battleground location against the number that removes it from the game, the lines of each stage, the stages the Responses removed, the Undefended choice naming the location, a hero whose resources cannot be spent and Orc Arbalesters' Archery X.
// The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../rules/core/state.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { heroCard, idOf, send, start, type Layout } from "../../../test/harness/scene-kit.ts";
import type { Run } from "../../../test/harness/scene.ts";
import { hurt, run as runInstruction, table } from "../../../test/scenarios/the-siege-of-cair-andros/table.ts";

import { cardKeywords } from "../cards/card-keywords.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { questTitle } from "../cards/table-preview.ts";
import { defenseSheet } from "../choice/combat-sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { playRequest } from "../choice/pay.ts";
import { questStatNow } from "../phases/quest-stat.ts";
import { advanceWords } from "../readouts/quest-advance.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { adjustWords, threatSourcesOf } from "../readouts/threat-sources.ts";

type Made = ReturnType<typeof table>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const say = (made: Made, state: ScenarioState, code: string) => dungeonDetail(state, made.ctx, idOf(state, code), (id) => made.cards.get(state.cards[id]?.code ?? id)?.name ?? id);
// A stage that was defeated keeps the progress that filled it, where the layout sets the earlier stages aside with none: `played` gives them what play would, but for the codes named (stages the Responses removed).
const played = (state: ScenarioState, ...removed: string[]): ScenarioState => state.setAside.reduce((now, id) => (removed.includes(now.cards[id]?.code ?? "") ? now : updateCard(now, id, { progress: 99 })), state);
const stage = (made: Made, state: ScenarioState) => questTitle(played(state), made.ctx, state.questStage ?? "", "Stage", () => null);
const dialsOf = (made: Made, state: ScenarioState) => scenarioDials(state, made.ctx, nameOf(made)).filter((dial) => dial.id.startsWith("battleground-"));


const BANKS = "05035";
const APPROACH = "05034";
const CITADEL = "05033";

describe("damage on a Battleground location against its limit (05033:A:1, 05034:A:1, 05035:A:1)", () => {
  it("each preview says how much damage it holds of the number that removes it from the game, and never calls it progress", () => {
    const made = table({ staging: [CITADEL, APPROACH], active: BANKS });
    let state = hurt(made, CITADEL, 5);
    state = hurt(made, APPROACH, 6, state);
    expect(say(made, state, CITADEL)).toBe("5 of 11 damage. At 11 The Citadel is removed from the game: it is not explored, its Response is not used and its victory points are not collected");
    expect(say(made, state, APPROACH)).toMatch(/^6 of 7 damage\. At 7 The Approach is removed from the game/);
    expect(say(made, state, BANKS)).toMatch(/^0 of 3 damage\. At 3 The Banks is removed from the game/);
    for (const code of [CITADEL, APPROACH, BANKS]) expect(say(made, state, code)).not.toMatch(/progress/i);
  });

  it("a dial shows each location that holds damage and warms one short of its limit: the Banks at 2 of 3, the Approach at 6 of 7, the Citadel at 10 of 11", () => {
    const made = table({ staging: [CITADEL, APPROACH, BANKS] });
    expect(dialsOf(made, made.state)).toEqual([]);
    const at = (code: string, damage: number) => dialsOf(made, hurt(made, code, damage)).find((dial) => dial.id === `battleground-${code}`);
    expect(at(BANKS, 1)).toMatchObject({ value: 1, limit: 3, warms: true });
    expect(at(BANKS, 1)?.warn).toBeUndefined();
    expect(at(BANKS, 2)?.warn?.words).toBe("The Banks holds 2 of 3 damage: 3 removes it from the game, with no victory points");
    expect(at(APPROACH, 5)?.warn).toBeUndefined();
    expect(at(APPROACH, 6)).toMatchObject({ value: 6, limit: 7, warn: { level: "near" } });
    expect(at(CITADEL, 9)?.warn).toBeUndefined();
    expect(at(CITADEL, 10)).toMatchObject({ value: 10, limit: 11, label: "Citadel", name: "Damage on The Citadel, in the staging area, 11 removes it from the game:" });
  });

  it("a location at its limit is gone from the game, so no dial and no preview line remain", () => {
    const made = table({ staging: [BANKS, APPROACH] });
    const state = hurt(made, BANKS, 3);
    expect(state.cards[idOf(state, BANKS)]?.zone).toBe("removed");
    expect(dialsOf(made, state)).toEqual([]);
    expect(say(made, state, BANKS)).toBeNull();
  });
});

describe("the stage's lines", () => {
  it("05072:B:2 stage 1B names the lowest Threat Battleground location, then says the quest advances when none is in play", () => {
    const made = table({ staging: [CITADEL, APPROACH, BANKS] });
    expect(stage(made, made.state)?.detail).toBe("An undefended attack deals all its damage to The Banks, the lowest Threat Battleground location in play, and none to a hero");
    const gone = hurt(made, BANKS, 3);
    expect(stage(made, gone)?.detail).toContain("to The Approach, the lowest Threat");
    const none = table({ staging: ["f0"] });
    expect(stage(none, none.state)?.detail).toBe("No Battleground location is in play: the quest advances to the next stage at once");
  });

  it("05073:B:1 and 05075:B:2 say the extra reveal and the 5 Threat while the stage is current, and no other stage does", () => {
    const two = table({ stage: "05073" });
    expect(stage(two, two.state)?.detail).toBe("Reveals 1 more encounter card in each staging step while it is the current stage");
    const four = table({ stage: "05075" });
    expect(stage(four, four.state)?.detail).toBe("Adds 5 Threat to the staging area while it is the current stage");
    const three = table({ stage: "05074" });
    expect(stage(three, three.state)?.detail).toBeUndefined();
  });

  it("05075:B:2 the staging area's total threat counts the 5", () => {
    const plain = table({ stage: "05074", staging: ["f3"] });
    const four = table({ stage: "05075", staging: ["f3"] });
    expect(threatSourcesOf(four.state, four.ctx).total - threatSourcesOf(plain.state, plain.ctx).total).toBe(5);
    expect(adjustWords(threatSourcesOf(four.state, four.ctx).adjust)).toBe("Other effects: +5 Threat");
  });

  it("05076:B:3 The Last Battle shows Siege and defense under 4 victory points, then Battle with Siege struck out and attack, counting toward 4", () => {
    const under = table({ stage: "05076", victory: [BANKS, APPROACH] });
    expect(questStatNow(under.state, under.ctx)).toBe("defense");
    expect(cardKeywords(under.state, under.ctx, under.state.questStage ?? "").map((chip) => `${chip.key}${chip.lost ? " lost" : ""}`)).toEqual(["siege"]);
    expect(stage(under, under.state)?.detail).toBe("3 of 4 victory points in the victory display. At 4 it has Battle and not Siege");
    const over = table({ stage: "05076", victory: [BANKS, CITADEL] });
    expect(questStatNow(over.state, over.ctx)).toBe("attack");
    expect(cardKeywords(over.state, over.ctx, over.state.questStage ?? "").map((chip) => `${chip.key}${chip.lost ? " lost" : ""}`)).toEqual(["battle", "siege lost"]);
    expect(stage(over, over.state)?.detail).toBe("4 of 4 victory points in the victory display: it has Battle and not Siege, so characters quest with Attack");
  });
});

describe("the stages the Responses removed (05033:A:2, 05034:A:2, 05035:A:2)", () => {
  it("a stage set aside ahead of the quest is told on the current stage, and the stage it goes to is the next one in the deck", () => {
    const made = table({ staging: [CITADEL] });
    const removed = runInstruction(made, made.state, { verb: "RemoveStage", code: "05075" });
    expect(questTitle(played(removed, "05075"), made.ctx, removed.questStage ?? "", "Stage", () => null)?.detail).toContain("Stage 4 was removed from the quest deck");
    expect(stage(made, made.state)?.detail).not.toContain("removed from the quest deck");
    expect(removed.questDeck.map((id) => removed.cards[id]?.code)).toEqual(["05073", "05074", "05076"]);
  });

  it("the advance screen names every stage that was removed, and no stage that was defeated", () => {
    const made = table({ stage: "05076" });
    const state = played(made.state, "05074", "05075");
    const words = advanceWords(state, made.ctx, state.questStage ?? "", "The Last Battle", () => null);
    expect(words.eyebrow).toBe("Stage 5 of 5");
    expect(words.detail).toContain("Stages 3 and 4 were removed from the quest deck");
    expect(words.detail).not.toContain("Stage 2");
  });
});

describe("the Undefended choice (05072:B:2)", () => {
  // Combat of the first seat: the enemy attacks, and the table stops at the defense window.
  function atDefense(layout: Layout): { made: Made; state: ScenarioState } {
    const made = table({ phase: "Encounter", engaged: [{ code: "f3", seat: 0 }], deck: ["f0", "f0", "f0"], ...layout });
    let run: Run = send(start(syncConstants(made.state, made.ctx)), { type: "DeclineEngage" }, made.ctx);
    for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass, made.ctx);
    }
    return { made, state: run.state };
  }
  const sheetOf = (made: Made, state: ScenarioState): PickSheet => {
    const names: SheetNames = { card: (id) => made.cards.get(state.cards[id]?.code ?? id)?.name ?? id, line: () => null };
    return defenseSheet(state, made.ctx, legalIntents(state, made.ctx), names) as PickSheet;
  };

  it("stage 1B names the location that takes the damage, how much it holds, and that no hero does", () => {
    const { made, state } = atDefense({ staging: [BANKS, APPROACH] });
    expect(state.window?.kind).toBe("defense");
    const sheet = sheetOf(made, state);
    expect(sheet.note).toContain("Undefended: The Banks takes all of it, and no hero does. It holds 0 of 3 damage.");
  });

  it("it says when the attack alone removes the location", () => {
    const { made, state } = atDefense({ staging: [BANKS, APPROACH] });
    expect(made.ctx.cards.get("f3")?.attack).toBe(1);
    expect(sheetOf(made, hurt(made, BANKS, 1, state)).note).toContain("It holds 1 of 3 damage.");
    expect(sheetOf(made, hurt(made, BANKS, 2, state)).note).toContain("It holds 2 of 3 damage: this attack removes it from the game.");
  });

  it("another stage says nothing of a location", () => {
    const { made, state } = atDefense({ stage: "05073", staging: [BANKS] });
    expect(sheetOf(made, state).note).not.toContain("Undefended: The Banks");
  });
});

describe("a hero whose resources cannot be spent (05058:A:1)", () => {
  const locked = (sphere: "leadership" | "tactics") => {
    const base = table({ heroResources: 2, staging: ["05058"], hand: ["event"] });
    const ctx = { ...base.ctx, cards: new Map(base.ctx.cards).set("dh1", { ...heroCard("dh1"), sphere }) };
    return { ...base, ctx, state: syncConstants(base.state, ctx) };
  };

  it("its preview says so, and the payment tray offers its pool no more", () => {
    const made = locked("leadership");
    expect(say(made, made.state, "dh1")).toBe("Its resources cannot be spent while Orc Vanguard is in the staging area. It can still gain and hold them");
    const request = playRequest(made.state, made.ctx, idOf(made.state, "event"));
    expect(request?.pools.map((pool) => pool.heroId) ?? []).not.toContain(idOf(made.state, "dh1"));
  });

  it("a Tactics hero says nothing and still offers its pool", () => {
    const made = locked("tactics");
    expect(say(made, made.state, "dh1")).toBeNull();
    const request = playRequest(made.state, made.ctx, idOf(made.state, "event"));
    expect(request?.pools.map((pool) => pool.heroId)).toContain(idOf(made.state, "dh1"));
  });
});

describe("Orc Arbalesters' Archery X (05057:A:2)", () => {
  it("its preview says what X counts and its value now, and the chip shows the same number", () => {
    const made = table({ stage: "05073", staging: ["05057"] });
    const id = idOf(made.state, "05057");
    expect(say(made, made.state, "05057")).toMatch(/^Archery X: X is the number of different resource icons .* on the heroes in play\. It is \d now$/);
    const x = Number(/It is (\d) now/.exec(say(made, made.state, "05057") ?? "")?.[1]);
    expect(cardKeywords(made.state, made.ctx, id).find((chip) => chip.key === "archery")?.word).toBe(`Archery ${x}`);
  });
});
