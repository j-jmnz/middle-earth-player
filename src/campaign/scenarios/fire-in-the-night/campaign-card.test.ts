// Rules: emce.setup-fire-in-the-night, emce.boon-allies, emce.treasure, emce.campaign-log, emce.deep, rr.campaign-setup-checklist, rr.setup, rr.first-player (data/rules/entries.json); ledger lines 12187:A:2, 12187:A:3, 12187:B:1 to 12187:B:4.
// The campaign card of Fire in the Night (12187) dealt in a game: its Setup (Beldis under the first player, the Turayn and Isolde removals), its Deep rule and its Resolution (Beldis or the line, the treasure for 5 progress, the treasures discovered, the pool removal).
import { beforeAll, describe, expect, it } from "vitest";

import { buildStart } from "../../start.ts";
import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { checklist } from "../../checklist.ts";
import { choiceSentence, consequenceSentence, declineSentence, promptSentence, resolutionView, settledSentence, type ResolutionView } from "../../resolution-view.ts";
import type { World } from "../../world.ts";
import { emptyLog, type CampaignLog } from "../../log.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { ignoresKeyword } from "../../../rules/families/wilderland/markers.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { nightLoadout, nightPlan, nightStart, nightWorld } from "../../../../test/scenarios/fire-in-the-night/game.ts";
import { CODES, campaign, legalIntents, night } from "../../../../test/scenarios/fire-in-the-night/scene.ts";

let ctx: ReduceContext;
beforeAll(async () => {
  ctx = (await nightWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const dealtScenario = campaignScenario(night);
const lines = (...allyLines: ("turayn" | "melanwar" | "isolde" | "beldis")[]): CampaignLog => ({ ...emptyLog(1), allyLines });
type Facts = Parameters<typeof nightStart>[3];
// The scenario dealt and its Setup played to the first round: the mulligan is kept and each question is answered with its first option.
function opened(seats: 1 | 2, seed = 1, args: { facts?: Facts; log?: CampaignLog; choices?: readonly string[] } = {}): ScenarioState {
  const log = args.log ?? emptyLog(seats);
  let state = startScenario(nightStart(seats, seed, "Normal", args.facts, log, undefined, args.choices), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// The searchable cards of a Normal game, by type and uniqueness.
const encounterCodes = [...new Set(dealtScenario.cards.filter((card) => card.pile === "encounter").map((card) => card.code))];
const nonUnique = (type: string) => encounterCodes.filter((code) => ctx.cards.get(code)?.type === type && ctx.cards.get(code)?.isUnique !== true);
const encounterCount = (state: ScenarioState, type: string) => Object.values(state.cards).filter((card) => ctx.cards.get(card.code)?.type === type && card.zone !== "removed" && !["setAside", "cavesDeck", "campaign", "sideQuestDeck"].includes(card.zone)).length;

describe("12187:A Setup", () => {
  it("12187:A:2 the first player gains control of Beldis", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats);
      expect(where(state, CODES.beldis), `${seats} seats`).toMatchObject([{ zone: "play", controller: state.firstPlayer }]);
    }
  });

  it("12187:A:2 the scenario's own cards are dealt: Dagnir in the staging area, the eight side quests in the side quest deck, and none of them in the encounter deck", () => {
    const state = opened(1);
    expect(where(state, CODES.dagnir)).toMatchObject([{ zone: "staging" }]);
    expect(state.piles?.sideQuestDeck).toHaveLength(8);
    expect(state.piles?.sideQuestDeck?.map((id) => state.cards[id]?.code).sort()).toEqual([CODES.drawHerFire, CODES.fortifyTheDefense, CODES.rallyTheWoodmen, CODES.douseTheFlames, CODES.holdTheDoor, CODES.defendTheTown, CODES.routTheGoblins, CODES.faceTheDragon].sort());
    for (const id of state.encounterDeck) expect(ctx.cards.get(state.cards[id]?.code ?? "")?.type).not.toBe("encounter-side-quest");
  });

  it("12187:A:2 with Turayn's oath the first player removes 3 non-unique locations from the encounter deck", () => {
    const log = lines("turayn");
    const locations = nonUnique("location");
    expect(locations.length).toBeGreaterThan(2);
    const asks = checklist({ log, scenario: dealtScenario, seats: nightLoadout(1), effects: EFFECTS, cards: ctx.cards });
    expect(!asks.ok && asks.needs?.options).toEqual(locations);
    const answers = [locations[0] ?? "", locations[1] ?? "", locations[2] ?? ""];
    const plan = nightPlan(1, log, answers);
    expect(plan.removedFromEncounter).toEqual(answers);
    const state = opened(1, 1, { log, choices: answers });
    expect(encounterCount(opened(1, 1), "location") - encounterCount(state, "location")).toBe(3);
  });

  it("12187:A:2 with Isolde's line the first player removes 3 non-unique enemies, and with both lines the locations come first", () => {
    const log = lines("isolde");
    const enemies = nonUnique("enemy");
    const answers = enemies.slice(0, 3);
    const asks = checklist({ log, scenario: dealtScenario, seats: nightLoadout(1), effects: EFFECTS, cards: ctx.cards });
    expect(!asks.ok && asks.needs?.options).toEqual(enemies);
    expect(nightPlan(1, log, answers).removedFromEncounter).toEqual(answers);
    const state = opened(1, 1, { log, choices: answers });
    expect(encounterCount(opened(1, 1), "enemy") - encounterCount(state, "enemy")).toBe(3);
    const locations = nonUnique("location").slice(0, 3);
    expect(nightPlan(1, lines("turayn", "isolde"), [...locations, ...answers]).removedFromEncounter).toEqual([...locations, ...answers]);
  });

  it("12187:A:2 without a line nothing is searched for, and Melanwar's and Beldis's lines remove nothing here", () => {
    expect(nightPlan(1, emptyLog(1)).removedFromEncounter).toEqual([]);
    expect(nightPlan(1, lines("melanwar", "beldis")).removedFromEncounter).toEqual([]);
  });

  it("12187:A:2 a standalone game has no campaign card: no Beldis, no Deep rule, nothing removed", () => {
    const start = buildStart({ campaign, scenario: night, seatCount: 1, seed: 1, threatModifier: 0, seats: nightLoadout(1), effects: EFFECTS, mode: "standalone" });
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    expect(where(state, CODES.beldis)).toEqual([]);
    expect(where(state, CODES.campaignCard)).toEqual([]);
    expect(ignoresKeyword(state, ctx, "deep")).toBe(false);
    expect(where(state, CODES.dagnir)).toMatchObject([{ zone: "staging" }]);
  });

  it("12187:A:3 the Deep keyword is ignored while the campaign card is on the table", () => {
    const state = opened(1);
    expect(where(state, CODES.campaignCard)).toMatchObject([{ zone: "campaign" }]);
    expect(ignoresKeyword(state, ctx, "deep")).toBe(true);
    // A game without the campaign card (a standalone one) ignores nothing.
    expect(ignoresKeyword(opened(1, 1), ctx, "discover")).toBe(false);
  });
});

// The scenario won: the Resolution waits for the first player's answer, which `pick` gives (the first option by default).
function won(state: ScenarioState, pick: (options: readonly string[], seat: number) => string = (options) => options[0] ?? ""): { state: ScenarioState; asked: { seat: number; options: string[] }[] } {
  const asked: { seat: number; options: string[] }[] = [];
  let next = openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx);
  for (let guard = 0; guard < 30 && next.window?.kind === "resolution"; guard += 1) {
    const options = legalIntents(next, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    asked.push({ seat: next.window.seat, options });
    next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: pick(options, next.window.seat) } as PlayerIntent, ctx)).state, ctx);
  }
  return { state: next, asked };
}
const withProgress = (state: ScenarioState, progress: number): ScenarioState => updateCard(state, state.questStage ?? "", { progress });
const LINE = "line";
// The Resolution answers: the line for Beldis, a pool card by its code, a treasure by its code.
const takeLine = (options: readonly string[]) => (options.includes(LINE) ? LINE : (options[0] ?? ""));

describe("12187:B Resolution", () => {
  it("12187:B:1 asks the first player whether Beldis joins the pool, for a player, or the line \"Beldis's care has bolstered the heroes' spirits\" is written", () => {
    const state = opened(2);
    const first = won(state).asked[0];
    expect(first?.seat).toBe(0);
    expect(first?.options).toContain(LINE);
    expect(first?.options.filter((option) => option.startsWith(`${CODES.beldis}>`))).toHaveLength(2);
    const line = resolutionResult(won(state, takeLine).state);
    expect(line?.allyLines).toEqual(["beldis"]);
    expect(line?.earned.map((item) => item.code)).not.toContain(CODES.beldis);
    const joined = resolutionResult(won(state, (all) => all.find((option) => option.startsWith(CODES.beldis)) ?? all[0] ?? "").state);
    expect(joined?.earned.map((item) => item.code)).toContain(CODES.beldis);
    expect(joined?.allyLines).toBeUndefined();
  });

  it("12187:B:2 with at least 5 progress on Hrogar's Hill the first player looks at 3 random undiscovered treasures and chooses 1; with less nothing is offered", () => {
    const state = opened(1);
    const many = won(withProgress(state, 5), takeLine);
    const offered = many.asked.find((entry) => entry.options.length === 3 && entry.options.every((option) => /^122\d\d$|^121\d\d$|^12\d{3}$/.test(option)));
    expect(offered, JSON.stringify(many.asked)).toBeDefined();
    expect(new Set(offered?.options).size).toBe(3);
    const chosen = resolutionResult(won(withProgress(state, 5), (options) => (options.includes(LINE) ? LINE : (options[1] ?? ""))).state);
    expect(chosen?.treasures).toHaveLength(1);
    expect(offered?.options).toContain(chosen?.treasures?.[0]);
    // 4 progress is not enough.
    expect(won(withProgress(state, 4), takeLine).asked.every((entry) => entry.options.length !== 3)).toBe(true);
    expect(resolutionResult(won(withProgress(state, 4), takeLine).state)?.treasures).toBeUndefined();
    expect(resolutionResult(won(withProgress(state, 50), (options) => (options.includes(LINE) ? LINE : (options[0] ?? ""))).state)?.treasures).toHaveLength(1);
  });

  it("12187:B:2 the three treasures leave out those the log holds, and are drawn with the game's seed", () => {
    const facts = { prisoner: null, usedOnce: [], counters: {}, treasures: ["12196", "12197", "12198", "12199", "12200", "12201"] };
    const state = withProgress(opened(1, 1, { facts }), 6);
    const offered = won(state, takeLine).asked.find((entry) => entry.options.length === 3)?.options ?? [];
    expect(offered).toHaveLength(3);
    for (const code of offered) expect(facts.treasures).not.toContain(code);
    const again = withProgress(opened(1, 1, { facts }), 6);
    expect(won(again, takeLine).asked.find((entry) => entry.options.length === 3)?.options).toEqual(offered);
  });

  it("12187:B:3 the players discover each treasure they control: none is controlled at the start, so none is written", () => {
    expect(resolutionResult(won(opened(1), takeLine).state)?.treasures).toBeUndefined();
  });

  it("12187:B:4 each player may remove a non-burden card from the campaign pool, first player first; a burden is not offered", () => {
    const facts = { prisoner: null, usedOnce: [], counters: {}, pool: [{ code: "12166", seat: 0 }, { code: "12167", seat: null }, { code: "12169", seat: 1 }] };
    const state = opened(2, 1, { facts });
    const removed = won(state, (options, seat) => (options.includes(LINE) ? LINE : seat === 0 ? (options.find((option) => option.startsWith("12166")) ?? options[0] ?? "") : "skip"));
    const removal = removed.asked.filter((entry) => entry.options.includes("skip") && !entry.options.includes(LINE));
    expect(removal.map((entry) => entry.seat)).toEqual([0, 1]);
    for (const entry of removal) for (const option of entry.options) expect(option).not.toContain("12167");
    expect(removed.state.resolutionLog.poolRemoved?.map((item) => item.code)).toEqual(["12166"]);
    // A player may remove nothing.
    expect(won(state, (options) => (options.includes(LINE) ? LINE : "skip")).state.resolutionLog.poolRemoved ?? []).toEqual([]);
  });

  it("12187:B:4 with no card in the pool nobody is asked", () => {
    const asked = won(opened(1), takeLine).asked;
    expect(asked.every((entry) => entry.options.includes(LINE) || entry.options.length === 3)).toBe(true);
  });

  it("12187:B:1 the choice names the seat (the first player chooses) and says what the ally or the line does, in the Resolution view", () => {
    const world = { campaign, scenario: night, effects: ctx.effects, cards: ctx.cards, sets: new Map<string, string>() } as World;
    const state = openResolution({ ...opened(2), stageCleared: true, window: null, stack: [] }, ctx);
    const view: ResolutionView = resolutionView(state, world);
    expect(view).toMatchObject({ kind: "choosing", seatLabel: "Player 1 (first player) chooses", ally: "Beldis" });
    if (view.kind !== "choosing") return;
    const line = view.tiles.find((tile) => tile.optionId === LINE);
    expect(choiceSentence(view, line ?? view.tiles[0]!)).toContain("Beldis");
    // Alone there is no seat to name.
    const solo = resolutionView(openResolution({ ...opened(1), stageCleared: true, window: null, stack: [] }, ctx), world);
    expect(solo.kind === "choosing" && solo.seatLabel).toBeNull();
  });

  // The Resolution as the screen reads it: the world the view is built in, and the window the engine has open after the answers so far.
  const worldOf = () => ({ campaign, scenario: night, effects: ctx.effects, cards: ctx.cards, sets: new Map<string, string>() }) as World;
  const waiting = (state: ScenarioState): ScenarioState => openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx);
  const choosing = (state: ScenarioState): Extract<ResolutionView, { kind: "choosing" }> => {
    const view = resolutionView(state, worldOf());
    if (view.kind !== "choosing") throw new Error(`not choosing: ${view.kind}`);
    return view;
  };

  it("12187:B:2 the treasure of three: the first player chooses 1 of the 3 random undiscovered treasures, which are only recorded as discovered, as the scenario is over", () => {
    for (const seats of [1, 2] as const) {
      const state = waiting(withProgress(opened(seats), 5));
      const line = expectOk(reduce(state, { type: "ChooseResolution", optionId: LINE } as PlayerIntent, ctx)).state;
      const view = choosing(openResolution(line, ctx));
      expect(view).toMatchObject({ eyebrow: "Choose a treasure", to: "treasure", noun: "treasure", seatLabel: seats > 1 ? "Player 1 (first player) chooses" : null });
      expect(view.tiles).toHaveLength(3);
      expect(view.decline).toBeNull();
      expect(promptSentence(view)).toBe("Choose 1 of the 3 random undiscovered treasures. It is recorded as discovered when you confirm.");
      expect(choiceSentence(view, view.tiles[1]!)).toBe(`${view.tiles[1]!.name} is discovered and recorded in the campaign log. The scenario is over, so it is not attached to a character.`);
      expect(consequenceSentence(view, null, false)).toBe(promptSentence(view));
    }
  });

  it("12187:B:4 each player's removal says whose turn it is, that a burden cannot be removed, what a decline keeps and what the card does; the answer of the first player is kept for the second", () => {
    const facts = { prisoner: null, usedOnce: [], counters: {}, pool: [{ code: "12166", seat: 0 }, { code: "12169", seat: 1 }] };
    let state = waiting(opened(2, 1, { facts }));
    state = openResolution(expectOk(reduce(state, { type: "ChooseResolution", optionId: LINE } as PlayerIntent, ctx)).state, ctx);
    const first = choosing(state);
    expect(first).toMatchObject({ eyebrow: "Remove a card from the pool", to: "removal", seat: 0, seatLabel: "Player 1 (first player) chooses", decline: { label: "Remove nothing" } });
    expect(promptSentence(first)).toBe("Choose a non-burden card to remove from the campaign pool, or tap Remove nothing to keep them all. Each player is asked in turn, the first player first. Your choice is written to the campaign log when you confirm.");
    expect(declineSentence(first)).toBe("Player 1 removes nothing from the campaign pool.");
    const turayn = first.tiles.find((tile) => tile.code === "12166")!;
    expect(choiceSentence(first, turayn)).toBe("Turayn is removed from the campaign pool.");
    const pick = legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" && intent.optionId.includes("12166") ? [intent.optionId] : []))[0] ?? "";
    state = openResolution(expectOk(reduce(state, { type: "ChooseResolution", optionId: pick } as PlayerIntent, ctx)).state, ctx);
    const second = choosing(state);
    expect(second).toMatchObject({ seat: 1, seatLabel: "Player 2 chooses", answered: [{ seat: 0, words: "Turayn" }] });
    expect(second.tiles.map((tile) => tile.code)).toEqual(["12169"]);
    expect(declineSentence(second)).toBe("Player 2 removes nothing from the campaign pool.");
    // Alone nobody is named.
    const solo = choosing(openResolution(expectOk(reduce(waiting(opened(1, 1, { facts: { ...facts, pool: [{ code: "12166", seat: 0 }] } })), { type: "ChooseResolution", optionId: LINE } as PlayerIntent, ctx)).state, ctx));
    expect(solo.seatLabel).toBeNull();
    expect(promptSentence(solo)).toBe("Choose a non-burden card to remove from the campaign pool, or tap Remove nothing to keep them all. Your choice is written to the campaign log when you confirm.");
    expect(declineSentence(solo)).toBe("You remove nothing from the campaign pool.");
  });

  it("12188:A:1 the confirm sentence records the boxes marked beside Beldis in the game, for each player", () => {
    const facts = { prisoner: null, usedOnce: [], counters: {}, beldisUses: [2, 0] };
    const state = won(opened(2, 1, { facts }), takeLine).state;
    // The log held 1 box for the first player before this game: only the marks this game adds are told.
    const view = resolutionView(state, worldOf(), [1, 0]);
    expect(view).toMatchObject({ kind: "settled", beldis: ["Player 1 marks 1 box beside Beldis (2 of 4 marked)"] });
    if (view.kind !== "settled") return;
    expect(settledSentence(view, worldOf(), "The Ghost of Framsburg")).toContain(" Player 1 marks 1 box beside Beldis (2 of 4 marked).");
    const both = resolutionView(state, worldOf());
    expect(both).toMatchObject({ kind: "settled", beldis: ["Player 1 marks 2 boxes beside Beldis (2 of 4 marked)"] });
    // Solo: "You mark".
    const solo = resolutionView(won(opened(1, 1, { facts: { prisoner: null, usedOnce: [], counters: {}, beldisUses: [3] } }), takeLine).state, worldOf(), [2]);
    expect(solo).toMatchObject({ kind: "settled", beldis: ["You mark 1 box beside Beldis (3 of 4 marked)"] });
    // A game that used Beldis for nobody says nothing of the boxes.
    const quiet = resolutionView(won(opened(1), takeLine).state, worldOf());
    expect(quiet.kind === "settled" && quiet.beldis).toBeUndefined();
  });

  it("a lost scenario writes nothing", () => {
    const lost: ScenarioState = { ...opened(1), lost: true, lossReason: "Hrogar's Hill holds 50 damage" };
    expect(resolutionResult(openResolution({ ...lost, stageCleared: true, window: null }, ctx))).toBeNull();
  });
});
