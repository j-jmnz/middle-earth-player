// Rules: ats.cair-andros-location-damage, ats.cair-andros-remove-stage, ats.cair-andros-defense-carry-over, hon.battle, hon.siege, hon.archery, rr.cannot, rr.removed-from-game (data/rules/entries.json); ledger lines 05033:A:1, 05034:A:1, 05035:A:1, 05033:A:2, 05072:B:2, 05073:B:1, 05075:B:2, 05076:B:3, 05057:A:2, 05058:A:1.
// What the table says for The Siege of Cair Andros: the damage on each Battleground location against the number that removes it from the game, the lines of each stage, the stages the Responses removed, the Undefended choice naming the location, a hero whose resources cannot be spent and Orc Arbalesters' Archery X.
// The engine decided each number; nothing here changes one.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../rules/core/state.ts";
import { UNATTRIBUTED } from "../../rules/core/cause.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { reduce, type PlayerIntent } from "../../rules/engine/reduce.ts";
import { expectOk } from "../../rules/core/test-fixture.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { heroCard, idOf, send, start, type Layout } from "../../../test/harness/scene-kit.ts";
import type { Run } from "../../../test/harness/scene.ts";
import { hurt, run as runInstruction, table } from "../../../test/scenarios/the-siege-of-cair-andros/table.ts";

import { BADGE_CAP, badgeSplit, moreText, slotNumbers } from "../cards/card-effects.ts";
import { cardKeywords } from "../cards/card-keywords.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { asksPick } from "../words/asks.ts";
import { ASKS_BY_SCENARIO } from "../words/asks/index.ts";
import { readoutFor } from "../readouts/readout.ts";
import { previewCards, questTitle } from "../cards/table-preview.ts";
import { defenseSheet } from "../choice/combat-sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { playRequest } from "../choice/pay.ts";
import { pointNote } from "../phases/rail.ts";
import { guideLine, turnReference } from "../phases/reference.ts";
import { questStatNow } from "../phases/quest-stat.ts";
import { cairAndrosStageLines } from "../readouts/against-the-shadow/cair-andros.ts";
import { advanceWords } from "../readouts/quest-advance.ts";
import { momentOf } from "../store/outcome.ts";
import { logLines } from "../store/log.ts";
import { keepIntent, type Kept } from "../store/store.ts";
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
    expect(say(made, state, CITADEL)).toBe("5 of 11 damage. At 11 it is removed: no Response, no victory points.");
    expect(say(made, state, APPROACH)).toBe("6 of 7 damage. At 7 it is removed: no Response, no victory points.");
    expect(say(made, state, BANKS)).toBe("0 of 3 damage. At 3 it is removed: no Response, no victory points.");
    for (const code of [CITADEL, APPROACH, BANKS]) expect(say(made, state, code)).not.toMatch(/progress/i);
    // The card's own token line does not say the damage a second time.
    const tokens = previewCards(state, made.ctx, idOf(state, CITADEL), (code) => ({ name: nameOf(made)(code), text: "", source: null }), (id) => nameOf(made)(state.cards[id]?.code ?? id), []).cards[0]?.tokens;
    expect(tokens ?? []).toEqual([]);
  });

  it("a dial shows each location that holds damage and warms one short of its limit: the Banks at 2 of 3, the Approach at 6 of 7, the Citadel at 10 of 11", () => {
    const made = table({ staging: [CITADEL, APPROACH, BANKS] });
    expect(dialsOf(made, made.state)).toEqual([]);
    const at = (code: string, damage: number) => dialsOf(made, hurt(made, code, damage)).find((dial) => dial.id === `battleground-${code}`);
    expect(at(BANKS, 1)).toMatchObject({ value: 1, limit: 3, warms: true, word: "1/3", icon: "damage", cardId: idOf(made.state, BANKS) });
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
    expect(stage(made, made.state)?.detail).toBe("Undefended damage goes to The Banks now.");
    const gone = hurt(made, BANKS, 3);
    expect(stage(made, gone)?.detail).toBe("Undefended damage goes to The Approach now.");
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

  it("the readout and the 6.E guide say where the damage goes and that the location is removed when the attack alone reaches the limit", () => {
    const { made, state } = atDefense({ staging: [BANKS, APPROACH] });
    const sheet = sheetOf(made, state);
    const name = nameOf(made);
    const readout = (game: ScenarioState) => readoutFor(game, made.ctx, sheet, null, (id) => name(game.cards[id]?.code ?? id));
    const hit = (game: ScenarioState) => ({ ...game, pendingAttack: game.pendingAttack ? { ...game.pendingAttack, heroId: idOf(game, BANKS) } : null });
    expect(readout(hit(state))).toMatchObject({ result: expect.stringMatching(/^Undefended: 1 damage on The Banks, shadow card next$|^Undefended: 1 damage on The Banks$/) });
    const near = hit(hurt(made, BANKS, 2, state));
    expect(readout(near)?.result).toMatch(/^Undefended: 1 damage on The Banks; it is removed from the game/);
    expect(guideLine(state, false)?.text).toBe("Each enemy attacks: declare one defender, or leave it undefended: a Battleground location takes it.");
    const other = atDefense({ stage: "05073", staging: [BANKS] });
    expect(guideLine(other.state, false)?.text).toBe("Each enemy attacks: declare one defender, or take it undefended on a hero.");
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

describe("the shadow cards that damage a location (05030:A:3, 05031:A:3, 05032:A:2)", () => {
  const note = (made: Made, state: ScenarioState, effectId: string, source: string) => {
    const record = made.ctx.effects.find((effect) => effect.id === effectId);
    const instruction = record?.instructions[1];
    if (!instruction) throw new Error(`no Pick in ${effectId}`);
    const names = { card: (id: string) => nameOf(made)(state.cards[id]?.code ?? id), code: nameOf(made) };
    return asksPick({ game: state, ctx: made.ctx, names, instruction, effectId, source: idOf(state, source) }, ASKS_BY_SCENARIO["the-siege-of-cair-andros"])?.prompt;
  };

  it("each says what the 2 damage do, and that they remove the location when they reach its limit", () => {
    const made = table({ staging: [CITADEL, APPROACH, BANKS, "05030", "05031", "05032"] });
    expect(note(made, made.state, "05030:shadow:1", "05030")).toBe("Orc Scramblers: The Citadel takes 2 damage, and the attacker gets no +2 Attack.");
    expect(note(made, hurt(made, CITADEL, 9), "05030:shadow:1", "05030")).toBe("Orc Scramblers: The Citadel takes 2 damage, and the attacker gets no +2 Attack. This removes it from the game.");
    expect(note(made, hurt(made, APPROACH, 5), "05031:shadow:1", "05031")).toBe("Battering Ram: The Approach takes 2 damage, and the attacker gets no +2 Attack. This removes it from the game.");
    expect(note(made, hurt(made, BANKS, 1), "05032:shadow:1", "05032")).toBe("Siege Raft: The Banks takes 2 damage, and the attacker gets no +2 Attack. This removes it from the game.");
    expect(note(made, hurt(made, BANKS, 0), "05032:shadow:1", "05032")).toBe("Siege Raft: The Banks takes 2 damage, and the attacker gets no +2 Attack.");
  });
});

describe("a card of another scenario with a keyword or stat this scenario words", () => {
  it("Wooded Shoreline (142078, Archery from archeryBonus) says no Arbalesters line, and a stage with revealMore adds no Cair Andros line", () => {
    const made = table({ staging: ["142078"] }, undefined, ["142078"]);
    expect(say(made, made.state, "142078") ?? "").not.toMatch(/Archery X/);
    expect(cairAndrosStageLines(made.state, made.ctx, "142067")).toEqual([]);
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

// Words and marks of a stage that counts Attack (Battle) or Defense (Siege) instead of Willpower. A stage with neither keyword is worded as it always was.
describe("the quest's words follow the stat the stage counts", () => {
  const quest: EngineStep = { kind: "quest", willpower: 16, threat: 13, cause: UNATTRIBUTED };
  const logNames = { card: (id: string) => id, code: (code: string) => code, effectCard: () => null, rule: () => null, line: () => null };
  const bannerLine = (code: string) => {
    const made = table({ stage: code });
    const moment = momentOf(made.state, made.state, [quest], { card: (id) => id, questStat: (state) => questStatNow(state, made.ctx) });
    return moment?.lines[0] ?? null;
  };

  it("the banner counts Attack on a Battle stage, Defense on a Siege stage and Willpower on a stage with neither", () => {
    expect(bannerLine("05074")).toEqual({ text: "Attack 16 against threat 13", mark: "attack" });
    expect(bannerLine("05072")).toEqual({ text: "Defense 16 against threat 13", mark: "defense" });
    expect(bannerLine("05073")).toEqual({ text: "Willpower 16 against threat 13", mark: "willpower" });
  });

  // The quest of a table played through the store's own fold: each intent is kept as the table keeps it (keepIntent), and the log reads the kept steps.
  function questLog(layout: Layout): string {
    const made = table({ phase: "Quest", ...layout });
    let state = syncConstants(made.state, made.ctx);
    let kept: Kept = { roundSteps: [], history: [] };
    const take = (intent: PlayerIntent) => {
      const result = expectOk(reduce(state, intent, made.ctx));
      kept = keepIntent(kept, state, result.state, result.steps, intent, made.ctx);
      state = result.state;
    };
    take({ type: "Commit", cardIds: [made.hero, made.hero2] });
    for (let guard = 0; guard < 12 && !kept.roundSteps.some((step) => step.kind === "quest"); guard += 1) take({ type: "Pass" });
    // The Response of the location the quest explored, then the rest of the round's windows.
    const response = legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger");
    if (response) take(response as PlayerIntent);
    const text = logLines(kept.roundSteps, logNames).find((line) => line.text.startsWith("Quest:"))?.text;
    if (!text) throw new Error("no quest line");
    return text;
  }

  it("the log names the stat the quest counted, from the state at the quest step: a Response that removes the current stage does not change it", () => {
    // Stage 2 (Willpower) is current; the quest explores The Banks, whose Response removes stage 2 itself and advances to stage 3 (Battle).
    expect(questLog({ stage: "05073", active: { code: BANKS, progress: 2 } })).toBe("Quest: willpower 4 against threat 0");
  });

  it("the log names Defense for The Last Battle at 1 victory point though the location it explores gains it Battle after the quest step", () => {
    expect(questLog({ stage: "05076", victory: [BANKS], active: { code: CITADEL, progress: 10 } })).toBe("Quest: defense 4 against threat 0");
  });

  it("a quest step kept without the stat (an old line) is worded without one", () => {
    expect(logLines([quest], logNames)[0]).toMatchObject({ text: "Quest: 16 against threat 13", mark: null });
    expect(logLines([{ ...quest, counted: "attack" } as EngineStep], logNames)[0]).toMatchObject({ text: "Quest: attack 16 against threat 13", mark: "attack" });
  });

  it("the stop before the quest resolves names the stat, in the window point and in the reference", () => {
    expect(pointNote("3.3")).toBe("Staging is done. Willpower raised now counts against its threat.");
    expect(pointNote("3.3", "willpower")).toBe(pointNote("3.3"));
    expect(pointNote("3.3", "attack")).toBe("Staging is done. Attack raised now counts against its threat.");
    expect(pointNote("3.3", "defense")).toBe("Staging is done. Defense raised now counts against its threat.");
    const made = table({ stage: "05074" });
    const windows = turnReference(made.state, () => null, "attack").flatMap((phase) => phase.steps).find((step) => step.id === "3.3")?.windows ?? [];
    expect(windows.map((window) => window.note)).toEqual(["Staging is done. Attack raised now counts against its threat."]);
    const plain = turnReference(made.state, () => null).flatMap((phase) => phase.steps).find((step) => step.id === "3.3")?.windows ?? [];
    expect(plain.map((window) => window.note)).toEqual([pointNote("3.3")]);
  });

  it("the quest meter's test id names no stat", () => {
    const view = readFileSync(new URL("../readouts/quest-meter-view.tsx", import.meta.url), "utf8");
    expect(view).toContain('testID="quest-meter-stat"');
    expect(view).not.toContain("quest-meter-willpower");
  });
});

describe("the pills down a card's edge", () => {
  it("a staged enemy whose engagement cost an effect took to 0 shows it once, at its foot, and no bare 0 among the changes", () => {
    const made = table({ stage: "05073", staging: ["05057"] });
    const id = idOf(made.state, "05057");
    const modify = (amount: number) => ({ ...made.state, modifiers: [...made.state.modifiers, { instanceId: id, sourceId: id, stat: "engagementCost" as const, amount, until: "endOfPhase" as const }] });
    const floored = slotNumbers(modify(-99), made.ctx, id);
    expect(floored.engagement?.cost).toBe(0);
    expect(floored.effects.stats.map((badge) => badge.stat)).not.toContain("engagementCost");
    const lowered = slotNumbers(modify(-5), made.ctx, id);
    expect(lowered.engagement?.cost).toBe((made.cards.get("05057")?.engagementCost ?? 0) - 5);
    expect(lowered.effects.stats.map((badge) => badge.stat)).toContain("engagementCost");
  });

  it("the pill for the effects left out says a count of more, never a signed number", () => {
    expect(moreText(1)).toBe("1 more");
    expect(moreText(3)).toBe("3 more");
    expect(badgeSplit(BADGE_CAP + 1, 5)).toEqual({ shown: BADGE_CAP, hidden: 1 });
    expect(moreText(badgeSplit(BADGE_CAP + 1, 5).hidden)).not.toMatch(/[+-]/);
  });
});
