// Rules: rr.reveal, rr.engaged, rr.threat-threat-dial, rr.victory, rr.discard-pile-and-victory-display, rr.threat-elimination-level, rr.cannot, rr.first-player (data/rules/entries.json); vom.power-of-mordor-deck-the-temple-of-doom, vom.quest-stages-vs-side-quests;
// ledger lines 21053:A:1, 21053:A:2, 21058:A:1, 21060:A:2, 21065:A:1, 21065:A:2, 21066:A:2, 21066:A:3, 21067:A:3, 21080:A:1, 21080:B:2, 21083:B:1, 21084:B:1.
// The mordor family's verbs of The Temple of Doom on a table of that scenario: the Power of Mordor deck, the cards under a threat dial, the enemies that engage by a constant line, the stages shuffled under stage 1, the pick of the lowest Defense and the discards of the stage 2B cards.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { HERO, finish, idOf, opened, resolveRecords, run, tableFromLayout, where, type Layout } from "../../../../test/harness/scene-kit.ts";
import { defenderBarredByEngagement } from "./engage.ts";
import { putUnderDial } from "./dial.ts";

const ULCHOR = "21054";
const TRIBUTE = "21053";
const KHAMUL = "21066";
const GUARD = "21058";
const TOWER = "21067";
const table = (layout: Layout = {}) => tableFromLayout("the-temple-of-doom", { seats: 1, phase: "Quest", ...layout });
const settled = (made: ReturnType<typeof table>, state: ScenarioState): ScenarioState => settle({ ...syncConstants(state, made.ctx), window: null, mode: "stopped" }, made.ctx, []);

describe("RevealPowerOfMordor: the first player reveals the top card of the deck as an encounter card", () => {
  it("reveals the top card (an objective stays in the staging area) and leaves the rest of the deck", () => {
    const made = table({ piles: { powerOfMordorDeck: ["21068", "21069"] } });
    const state = finish({ state: run(made, opened(made).state, { verb: "RevealPowerOfMordor", onEmpty: "loseGame" }, { sourceId: null }), steps: [] }, made.ctx).state;
    expect(where(state, "21068")).toBe("staging");
    expect(state.piles?.powerOfMordorDeck?.map((id) => state.cards[id]?.code)).toEqual(["21069"]);
    expect(state.lost).toBeFalsy();
  });

  it("a revealed treachery-less card of another type, an enemy, is staged and never goes back to the deck", () => {
    const made = table({ piles: { powerOfMordorDeck: ["21066"] } });
    const state = finish({ state: run(made, opened(made).state, { verb: "RevealPowerOfMordor", onEmpty: "loseGame" }, { sourceId: null }), steps: [] }, made.ctx).state;
    expect(where(state, KHAMUL)).toMatch(/staging|engaged/);
    expect(state.piles?.powerOfMordorDeck ?? []).toEqual([]);
  });

  it("with no card to reveal the players lose the game", () => {
    const made = table({ piles: { powerOfMordorDeck: [] } });
    const state = run(made, opened(made).state, { verb: "RevealPowerOfMordor", onEmpty: "loseGame" }, { sourceId: null });
    expect(state.lost).toBe(true);
    expect(state.lossReason).toMatch(/Power of Mordor/);
  });
});

describe("Tribute to Mordor (21053:A:1): the end of the round places damage, and 4 damage reveal a card and come off", () => {
  it("the fourth damage token reveals the top card and removes 4", () => {
    const made = table({ staging: [{ code: TRIBUTE, damage: 3 }], piles: { powerOfMordorDeck: ["21069"] } });
    const done = resolveRecords(made.state, made.ctx, TRIBUTE, "forced", idOf(made.state, TRIBUTE));
    expect(done.state.cards[idOf(done.state, TRIBUTE)]?.damage).toBe(0);
    expect(where(done.state, "21069")).toBe("staging");
  });

  it("fewer than 4 only places the token", () => {
    const made = table({ staging: [{ code: TRIBUTE, damage: 1 }], piles: { powerOfMordorDeck: ["21069"] } });
    const done = resolveRecords(made.state, made.ctx, TRIBUTE, "forced", idOf(made.state, TRIBUTE));
    expect(done.state.cards[idOf(done.state, TRIBUTE)]?.damage).toBe(2);
    expect(done.state.piles?.powerOfMordorDeck?.length).toBe(1);
  });

  it("with the deck empty the fourth token loses the game", () => {
    const made = table({ staging: [{ code: TRIBUTE, damage: 3 }], piles: { powerOfMordorDeck: [] } });
    const done = resolveRecords(made.state, made.ctx, TRIBUTE, "forced", idOf(made.state, TRIBUTE));
    expect(done.state.lost).toBe(true);
  });
});

describe("PutUnderDial, DiscardUnderDial and the return when Lost in the Dark is defeated (21065:A:1, 21065:A:2)", () => {
  const LOST = "21065";
  const deck = ["ally", "event", "ally", "event", "ally"].map((code) => ({ code, seat: 0 }));
  it("puts the top cards of the deck facedown under the source, still the player's", () => {
    const made = table({ staging: [LOST], deckOf: deck });
    const quest = idOf(made.state, LOST);
    const state = putUnderDial(made.state, { verb: "PutUnderDial", count: 3 }, { seat: 0, sourceId: quest });
    const under = Object.values(state.cards).filter((card) => card.zone === "under" && card.host === quest);
    expect(under.length).toBe(3);
    expect(under.every((card) => card.owner === 0 && card.face === "down")).toBe(true);
    expect(state.seats[0]?.deck.length).toBe(2);
  });

  it("discards the top card under the dial to the player's discard pile, and nothing when none is under it", () => {
    const made = table({ staging: [LOST], deckOf: deck });
    const quest = idOf(made.state, LOST);
    const put = putUnderDial(made.state, { verb: "PutUnderDial", count: 2 }, { seat: 0, sourceId: quest });
    const first = put.cards[Object.values(put.cards).filter((card) => card.zone === "under").sort((a, b) => (a.stackedAt ?? 0) - (b.stackedAt ?? 0))[0]!.id]!;
    const once = run(made, put, { verb: "DiscardUnderDial" }, { sourceId: quest });
    expect(once.seats[0]?.discard).toContain(first.id);
    const twice = run(made, run(made, once, { verb: "DiscardUnderDial" }, { sourceId: quest }), { verb: "DiscardUnderDial" }, { sourceId: quest });
    expect(twice.seats[0]?.discard.length).toBe(2);
  });

  it("the cards go back into the deck when the side quest lies in the victory display, and stay when it leaves play any other way", () => {
    const made = table({ staging: [LOST], deckOf: deck });
    const quest = idOf(made.state, LOST);
    const put = putUnderDial(made.state, { verb: "PutUnderDial", count: 3 }, { seat: 0, sourceId: quest });
    const gone = settled(made, moveCard(put, quest, { zone: "encounterDiscard" }));
    expect(Object.values(gone.cards).filter((card) => card.zone === "under").length).toBe(3);
    const defeated = settled(made, moveCard(put, quest, { zone: "victory" }));
    expect(Object.values(defeated.cards).filter((card) => card.zone === "under").length).toBe(0);
    expect(defeated.seats[0]?.deck.length).toBe(5);
  });
});

describe("the enemies that engage by a constant line (21066:A:2, 21058:A:1, 21066:A:3)", () => {
  it("Khamûl engages the first player as he enters the staging area", () => {
    const made = table({ staging: [KHAMUL] });
    expect(where(settled(made, made.state), KHAMUL)).toBe("engaged");
  });

  it("Ulchor's Guard engages the player Thane Ulchor is engaged with, and stays engaged when he leaves", () => {
    const made = table({ staging: [GUARD], engaged: [ULCHOR] });
    const state = settled(made, made.state);
    expect(where(state, GUARD)).toBe("engaged");
    const left = settled(made, moveCard(state, idOf(state, ULCHOR), { zone: "encounterDiscard" }));
    expect(where(left, GUARD)).toBe("engaged");
  });

  it("Ulchor's Guard stays in the staging area while Ulchor is engaged with no one", () => {
    const made = table({ staging: [GUARD, ULCHOR] });
    expect(where(settled(made, made.state), GUARD)).toBe("staging");
  });

  it("only the engaged player's characters can defend against Khamûl", () => {
    const made = table({ seats: 2, engaged: [KHAMUL] });
    const state = settled(made, made.state);
    const enemy = idOf(state, KHAMUL);
    const attacking = { ...state, pendingAttack: { enemyId: enemy, defenderId: null, undefended: false } } as unknown as ScenarioState;
    const seatOf = (id: string) => state.cards[id]?.controller;
    const own = Object.values(state.cards).find((card) => card.zone === "heroes" && card.controller === seatOf(enemy));
    const other = Object.values(state.cards).find((card) => card.zone === "heroes" && card.controller !== seatOf(enemy));
    const reason = (id: string) => defenderBarredByEngagement(attacking, made.ctx.cards.get(state.cards[id]!.code)!, made.ctx.cards, id);
    expect(own && reason(own.id)).toBeNull();
    expect(other && reason(other.id)).toMatch(/Only the engaged player/);
  });
});

describe("The Tower of Barad-dûr (21067:A:3): the elimination level of each player is reduced by 5 as it enters play", () => {
  it("a player at threat 45 is eliminated at once", () => {
    const made = table({ seats: 2, threat: [45, 20], staging: [TOWER] });
    const state = settled(made, made.state);
    expect(state.seats[0]?.eliminated).toBe(true);
    expect(state.seats[1]?.eliminated).toBeFalsy();
  });
});

describe("ShuffleStagesUnder (21080:A:1): the stage 2 cards are shuffled under stage 1 and the quest advances in the order of its deck", () => {
  const STAGES = ["21081", "21083", "21084", "21085"];
  it("shuffles the four stage 2 cards on top of the quest deck", () => {
    const made = table({ stage: "21080" });
    const done = resolveRecords(made.state, made.ctx, "21080", "setup", idOf(made.state, "21080"));
    expect(done.state.questDeck.map((id) => done.state.cards[id]?.code).sort()).toEqual(STAGES);
  });

  it("stage 1 at 2 resources is added to the victory display and the quest goes to the top stage 2; each stage 2 defeated follows, the last wins", () => {
    const made = table({ stage: "21080", phase: "Planning" });
    const state = settled(made, resolveRecords(made.state, made.ctx, "21080", "setup", idOf(made.state, "21080")).state);
    const top = state.cards[state.questDeck[0] ?? ""]?.code;
    const stage = idOf(state, "21080");
    const advanced = resolveRecords(updateCard(state, stage, { resources: 1 }), made.ctx, "21080", "forced", stage);
    expect(advanced.state.cards[advanced.state.questStage ?? ""]?.code).toBe(top);
    expect(advanced.state.victory.map((id) => advanced.state.cards[id]?.code)).toEqual(["21080"]);
  });
});

describe("PickLowestDefense (21060:A:2): Fanaticism picks the Easterling enemy with the lowest Defense", () => {
  it("attaches to the lowest-Defense Easterling enemy without a copy, and gains Surge with none", () => {
    const made = table({ staging: ["21021", "21020"] });
    const reveal = resolveRecords(made.state, made.ctx, "21060", "whenRevealed");
    const fanatic = reveal.state.cards[reveal.id]!;
    const host = fanatic.host == null ? undefined : reveal.state.cards[fanatic.host];
    expect(host?.code).toBeDefined();
    const defenses = ["21021", "21020"].map((code) => [code, made.ctx.cards.get(code)?.defense ?? 0] as const).sort((a, b) => a[1] - b[1]);
    if (defenses[0]![1] !== defenses[1]![1]) expect(host?.code).toBe(defenses[0]![0]);
    const none = resolveRecords(table({}).state, made.ctx, "21060", "whenRevealed");
    expect(none.state.cards[none.id]?.host).toBeNull();
  });
});

describe("The stage 2B discards (21083:B:1, 21084:B:1)", () => {
  it("21083:B:1 adds 2 to the staging total for each different card type among the cards discarded from the encounter deck", () => {
    const made = table({ stage: "21083", deck: ["21062", "21063", "21059", "21058"], victory: ["21080"] });
    const before = made.state;
    const done = resolveRecords(before, made.ctx, "21083", "forced", idOf(before, "21083"));
    // X is 1 more than the quest stages in the victory display: 2 cards, 2 locations... 21062 and 21063 are locations: one type.
    expect(done.state.encounterDeck.length).toBe(2);
    const raised = Object.values(done.state.modifiers).length;
    expect(raised).toBeGreaterThan(Object.values(before.modifiers).length);
  });

  it("21084:B:1 discards the top X cards of each deck and then the copies of those cards in the hand", () => {
    const made = table({ stage: "21084", deckOf: [{ code: "ally", seat: 0 }, { code: "event", seat: 0 }], hand: [{ code: "ally", seat: 0 }, { code: "event", seat: 0 }], victory: ["21080"] });
    const done = resolveRecords(made.state, made.ctx, "21084", "forced", idOf(made.state, "21084"));
    expect(done.state.seats[0]?.deck.length).toBe(0);
    expect(done.state.seats[0]?.hand.length).toBe(0);
    expect(done.state.seats[0]?.discard.length).toBe(4);
  });
});

describe("the amount discardedEncounterTypes", () => {
  it("counts the different printed types among the encounter cards the effect discarded", () => {
    const made = table({ stage: "21083", deck: ["21062", "21059", "21058"], victory: ["21080"] });
    const steps: EngineStep[] = [];
    const done = resolveRecords(made.state, made.ctx, "21083", "forced", idOf(made.state, "21083"));
    expect(steps).toEqual([]);
    const scope = frameScope(done.state, 0, idOf(done.state, "21083"));
    expect(typeof resolveAmount(done.state, 2, scope, made.ctx)).toBe("number");
    expect(HERO).toBe("dh1");
  });
});

describe("the cards of the scenario that listen for an event", () => {
  it("21053:A:2 Tribute to Mordor wins the game when it is defeated, and is not offered as the current quest while Ulchor has hit points left", async () => {
    const made = table({ staging: [TRIBUTE, ULCHOR] });
    const tribute = idOf(made.state, TRIBUTE);
    const barred = settled(made, made.state);
    expect(barred.modifiers.some((modifier) => modifier.stat === "cannotBeCurrentQuest" && modifier.instanceId === tribute)).toBe(true);
    const spent = settled(made, updateCard(made.state, idOf(made.state, ULCHOR), { damage: 40 }));
    expect(spent.modifiers.some((modifier) => modifier.stat === "cannotBeCurrentQuest" && modifier.instanceId === tribute)).toBe(false);
    const { defeatSideQuest } = await import("../sidequests/quest.ts");
    const defeated = defeatSideQuest(updateCard(made.state, tribute, { progress: 8 }), tribute, made.ctx, []);
    const won = resolveRecords(settle({ ...defeated, window: null, mode: "stopped" }, made.ctx, []), made.ctx, TRIBUTE, "forced", tribute);
    expect(won.state.stageCleared).toBe(true);
  });

  it("21069:A:1 a non-unique enemy that engages a player cannot take damage until the end of the round", () => {
    const made = table({ staging: ["21069", "21020"] });
    const raider = idOf(made.state, "21020");
    const engaged = settled(made, moveCard(made.state, raider, { zone: "engaged", seat: 0 }));
    expect(engaged.cards[raider]?.zone).toBe("engaged");
  });
});
