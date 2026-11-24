// Rules: ats.underworld, ats.underworld-example, ats.setup-the-stewards-fear-underworld-deck, rr.reveal, rr.surge, rr.in-play-and-out-of-play, rr.quest-advancement, rr.constant-ability (data/rules/entries.json). The engine facts of the verbs The Steward's Fear adds in the pelargir family that no printed line shows by
// itself: the deck built and hidden by the Setup, what Underworld X takes and what it leaves, the card revealed from the deck, the deck shuffled into the encounter deck, the card revealed and discarded, the random pick, the tokens taken off the quest and the loss at an empty deck.
// The printed lines are tested in src/campaign/scenarios/the-stewards-fear/.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { idOf, idsOf, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { CODES, DECK_CODES, PLOTS, VILLAINS, codeOf, deckCodes, run, runSettled, table, underCodes } from "../../../../test/scenarios/the-stewards-fear/table.ts";

const SETUP: Instruction = { verb: "BuildUnderworldDeck", codes: DECK_CODES };

// The records of the table are left out: only the verb under test runs.
const bare = (layout: Layout) => table(layout, []);

// An effect of the source card that runs the instructions in a frame, as a card's own record does, and settles.
function inFrame(made: LayoutTable, state: ScenarioState, source: string, instructions: Instruction[], steps: EngineStep[] = []): ScenarioState {
  const effect: Effect = { id: "test:whenRevealed:1", cardCode: made.state.cards[source]?.code ?? "", lines: [], timing: "whenRevealed", instructions };
  return settle(pushCardEffects({ ...state, window: null, mode: "stopped" }, "whenRevealed", source, 0, false, [effect], made.ctx, steps), made.ctx, steps);
}

describe("BuildUnderworldDeck (06011:A:1)", () => {
  const SET = [...DECK_CODES, "05037", "05037", "05042", "05042", "05043"];

  it("shuffles the set-aside cards with these codes into a facedown deck, apart from the encounter deck, and leaves the other set-aside cards alone", () => {
    const t = bare({ setAside: [...SET, CODES.roots, ...VILLAINS], deck: ["f0"] });
    const built = run(t, t.state, SETUP);
    expect([...deckCodes(built)].sort()).toEqual([...SET].sort());
    for (const id of built.setAside.filter((one) => built.cards[one]?.stackedAt != null)) expect(built.cards[id]).toMatchObject({ zone: "setAside", face: "down", controller: null });
    expect(built.setAside.filter((id) => built.cards[id]?.stackedAt == null).map((id) => codeOf(built, id))).toEqual(expect.arrayContaining([CODES.roots, ...VILLAINS]));
    expect(built.encounterDeck).toEqual(t.state.encounterDeck);
  });

  it("is the seed's order: one seed always builds the same deck, and the seeds build more than one order", () => {
    const orders = [1, 2, 3, 4, 5, 6].map((seed) => {
      const t = bare({ seed, setAside: SET });
      return deckCodes(run(t, t.state, SETUP)).join();
    });
    expect(orders[0]).toBe(deckCodes((() => { const t = bare({ seed: 1, setAside: SET }); return run(t, t.state, SETUP); })()).join());
    expect(new Set(orders).size).toBeGreaterThan(1);
  });
});

describe("HideOneAside (06011:A:1)", () => {
  it("keeps one card of the codes set aside facedown, chosen by the seed, and removes the others from the game", () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const t = bare({ seed, setAside: [...VILLAINS, ...PLOTS, CODES.roots] });
      const hidden = run(t, run(t, t.state, { verb: "HideOneAside", codes: VILLAINS }), { verb: "HideOneAside", codes: PLOTS });
      const villains = VILLAINS.map((code) => hidden.cards[idOf(t.state, code)]?.zone);
      expect(villains.filter((zone) => zone === "setAside")).toHaveLength(1);
      expect(villains.filter((zone) => zone === "removed")).toHaveLength(2);
      const plots = PLOTS.map((code) => hidden.cards[idOf(t.state, code)]?.zone);
      expect(plots.filter((zone) => zone === "setAside")).toHaveLength(1);
      expect(plots.filter((zone) => zone === "removed")).toHaveLength(2);
      expect(hidden.cards[idOf(t.state, CODES.roots)]?.zone).toBe("setAside");
      seen.add(VILLAINS.find((code) => hidden.cards[idOf(t.state, code)]?.zone === "setAside") ?? "");
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("TakeUnderworld (06018:A:1, 06018:A:2, 06021:A:1, 06022:A:1)", () => {
  const layout: Layout = { setAside: DECK_CODES, staging: [CODES.houses], active: CODES.sewers };

  it("stacks the top cards facedown under the host in the order they lie, out of the deck: 2 for Houses of the Dead, as the rules example says", () => {
    const t = bare(layout);
    const built = run(t, t.state, SETUP);
    const [first, second] = deckCodes(built);
    const houses = idOf(t.state, CODES.houses);
    const taken = run(t, built, { verb: "TakeUnderworld", amount: 2, host: "self" }, houses);
    expect(underCodes(taken, houses)).toEqual(expect.arrayContaining([first, second]));
    expect(underCodes(taken, houses)).toHaveLength(2);
    expect(deckCodes(taken)).toHaveLength(DECK_CODES.length - 2);
    for (const card of Object.values(taken.cards).filter((one) => one.zone === "under")) {
      expect(card.face).toBe("down");
      expect(card.stackedAt).toBeUndefined();
    }
  });

  it("takes the active location as the host for 'underneath the active location', and nothing with no active location", () => {
    const t = bare(layout);
    const built = run(t, t.state, SETUP);
    const sewers = idOf(t.state, CODES.sewers);
    expect(underCodes(run(t, built, { verb: "TakeUnderworld", amount: 1, host: "activeLocation" }), sewers)).toHaveLength(1);
    const none = bare({ setAside: DECK_CODES, staging: [CODES.houses] });
    const noneBuilt = run(none, none.state, SETUP);
    expect(deckCodes(run(none, noneBuilt, { verb: "TakeUnderworld", amount: 1, host: "activeLocation" }))).toHaveLength(DECK_CODES.length);
  });

  it("takes what remains when the deck holds fewer cards than the value, and nothing from an empty deck", () => {
    const t = bare({ setAside: [CODES.history], staging: [CODES.houses] });
    const built = run(t, t.state, SETUP);
    const houses = idOf(t.state, CODES.houses);
    const one = run(t, built, { verb: "TakeUnderworld", amount: 2, host: "self" }, houses);
    expect(underCodes(one, houses)).toEqual([CODES.history]);
    expect(deckCodes(one)).toEqual([]);
    expect(underCodes(run(t, one, { verb: "TakeUnderworld", amount: 2, host: "self" }, houses), houses)).toEqual([CODES.history]);
  });

  it("reads an amount: the players in the game (The Fourth Star), and a host that is not in play takes nothing", () => {
    const t = bare({ seats: 2, setAside: DECK_CODES, staging: [CODES.star] });
    const built = run(t, t.state, SETUP);
    const star = idOf(t.state, CODES.star);
    expect(underCodes(run(t, built, { verb: "TakeUnderworld", amount: { players: true }, host: "self" }, star), star)).toHaveLength(2);
    const away = bare({ setAside: DECK_CODES, discard: [CODES.star] });
    const awayBuilt = run(away, away.state, SETUP);
    expect(deckCodes(run(away, awayBuilt, { verb: "TakeUnderworld", amount: 1, host: "self" }, idOf(away.state, CODES.star)))).toHaveLength(DECK_CODES.length);
  });
});

describe("RevealUnderworld (06023:A:2)", () => {
  it("reveals the top card in full and adds it to the staging area: an enemy of the deck, faceup", () => {
    const t = bare({ setAside: ["05042"] });
    const built = run(t, t.state, SETUP);
    const revealed = runSettled(t, built, { verb: "RevealUnderworld", discardTrait: "Clue" });
    expect(revealed.staging.map((id) => revealed.cards[id]?.code)).toEqual(["05042"]);
    expect(revealed.cards[revealed.staging[0] ?? ""]?.face).toBe("up");
    expect(deckCodes(revealed)).toEqual([]);
  });

  it("puts a Clue in the encounter discard pile instead, and does nothing with the deck empty", () => {
    const t = bare({ setAside: [CODES.map] });
    const built = run(t, t.state, SETUP);
    const clue = runSettled(t, built, { verb: "RevealUnderworld", discardTrait: "Clue" });
    expect(clue.staging).toEqual([]);
    expect(clue.encounterDiscard.map((id) => clue.cards[id]?.code)).toEqual([CODES.map]);
    expect(runSettled(t, clue, { verb: "RevealUnderworld", discardTrait: "Clue" })).toEqual(clue);
  });
});

describe("ShuffleUnderworldIntoEncounterDeck (06013:B:1)", () => {
  it("moves every card of the deck into the encounter deck, leaves the cards under locations where they lie, and a later Underworld takes nothing", () => {
    const t = bare({ setAside: DECK_CODES, staging: [CODES.houses], deck: ["f0", "f0"] });
    const built = run(t, t.state, SETUP);
    const houses = idOf(t.state, CODES.houses);
    const stacked = run(t, built, { verb: "TakeUnderworld", amount: 1, host: "self" }, houses);
    const shuffled = run(t, stacked, { verb: "ShuffleUnderworldIntoEncounterDeck" });
    expect(shuffled.encounterDeck).toHaveLength(2 + DECK_CODES.length - 1);
    expect(deckCodes(shuffled)).toEqual([]);
    expect(underCodes(shuffled, houses)).toHaveLength(1);
    expect(underCodes(run(t, shuffled, { verb: "TakeUnderworld", amount: 1, host: "self" }, houses), houses)).toHaveLength(1);
    for (const id of shuffled.encounterDeck) expect(shuffled.cards[id]?.stackedAt).toBeUndefined();
  });
});

describe("RevealTopThenDiscard (06016:A:1)", () => {
  it("puts the top card of the encounter deck faceup in the discard pile at once, and a location of it never enters the staging area", () => {
    const t = bare({ staging: ["treachery"], deck: [CODES.storehouse, "f0"] });
    const done = inFrame(t, t.state, idOf(t.state, "treachery"), [{ verb: "RevealTopThenDiscard" }]);
    expect(done.encounterDiscard.map((id) => done.cards[id]?.code)).toEqual([CODES.storehouse]);
    expect(done.cards[done.encounterDiscard[0] ?? ""]?.face).toBe("up");
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["treachery"]);
    expect(done.encounterDeck.map((id) => done.cards[id]?.code)).toEqual(["f0"]);
  });

  it("an enemy is discarded too, and the reveal hears itself: a surge reveals one more card the normal way", () => {
    const t = bare({ staging: ["treachery"], deck: [CODES.discovery, "f0", "f0"] });
    const done = inFrame(t, t.state, idOf(t.state, "treachery"), [{ verb: "RevealTopThenDiscard" }]);
    // Unwelcome Discovery has Surge: the next card is revealed and staged, the first one is discarded.
    expect(done.encounterDiscard.map((id) => done.cards[id]?.code)).toContain(CODES.discovery);
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(expect.arrayContaining(["treachery", "f0"]));
  });

  it("with the encounter deck empty the discard pile is shuffled back first (the card is discarded, not staged), and with both empty nothing happens", () => {
    const t = bare({ staging: ["treachery"], discard: [CODES.storehouse] });
    const done = inFrame(t, t.state, idOf(t.state, "treachery"), [{ verb: "RevealTopThenDiscard" }]);
    // The reveal ended with the deck empty: the quest phase resets it from the discard pile (faq.last-encounter-card).
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["treachery"]);
    expect(done.encounterDeck.map((id) => done.cards[id]?.code)).toEqual([CODES.storehouse]);
    const empty = bare({ staging: ["treachery"] });
    expect(inFrame(empty, empty.state, idOf(empty.state, "treachery"), [{ verb: "RevealTopThenDiscard" }]).encounterDiscard).toEqual([]);
  });
});

describe("PickRandom (06024:A:1)", () => {
  it("picks one card among those the pick finds, by the seed: the same seed the same card, and the seeds reach each of them", () => {
    const pick = { type: "ally", control: "any" } as const;
    const discarded = (seed: number): string[] => {
      const t = bare({ seed, staging: ["treachery"], play: ["ally", "ally", "ally"] });
      const done = inFrame(t, t.state, idOf(t.state, "treachery"), [{ verb: "PickRandom", pick }, { verb: "Discard", target: { kind: "picked" } }]);
      return idsOf(done, "ally").filter((id) => done.cards[id]?.zone !== "play");
    };
    expect(discarded(1)).toHaveLength(1);
    expect(discarded(1)).toEqual(discarded(1));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => discarded(seed)[0])).size).toBeGreaterThan(1);
  });

  it("picks nothing when no card matches, so the instructions after it find no picked card", () => {
    const t = bare({ staging: ["treachery"] });
    const done = inFrame(t, t.state, idOf(t.state, "treachery"), [{ verb: "PickRandom", pick: { type: "ally", control: "any" } }, { verb: "Discard", target: { kind: "picked" } }]);
    expect(done.encounterDiscard).toEqual([]);
  });
});

describe("RemoveQuestTokens (06014:A:2, 06025:A:2)", () => {
  const withTokens = (progress: number, resources: number) => {
    const t = bare({ stage: CODES.conspiracy, progress });
    const stage = t.state.questStage ?? "";
    return { t, stage, state: { ...t.state, cards: { ...t.state.cards, [stage]: { ...t.state.cards[stage]!, resources } } } };
  };

  it("takes one progress token, one resource token or one of either (progress first), and every token with `all`", () => {
    const { t, stage, state } = withTokens(3, 2);
    const at = (next: ScenarioState) => [next.cards[stage]?.progress, next.cards[stage]?.resources];
    expect(at(run(t, state, { verb: "RemoveQuestTokens", kind: "progress", amount: 1 }))).toEqual([2, 2]);
    expect(at(run(t, state, { verb: "RemoveQuestTokens", kind: "resource", amount: 1 }))).toEqual([3, 1]);
    expect(at(run(t, state, { verb: "RemoveQuestTokens", kind: "any", amount: 1 }))).toEqual([2, 2]);
    expect(at(run(t, state, { verb: "RemoveQuestTokens", kind: "any", amount: 4 }))).toEqual([0, 1]);
    expect(at(run(t, state, { verb: "RemoveQuestTokens", kind: "any" }))).toEqual([0, 0]);
  });

  it("takes only what the card holds, and nothing when it holds none", () => {
    const { t, stage, state } = withTokens(0, 0);
    expect(run(t, state, { verb: "RemoveQuestTokens", kind: "any", amount: 1 }).cards[stage]).toMatchObject({ progress: 0, resources: 0 });
  });
});

describe("losesAtEmptyDeck (06030:A:2)", () => {
  const FLAG: Effect = { id: "test:constant:1", cardCode: CODES.flames, lines: [], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "losesAtEmptyDeck", amount: 1, until: "whileSourceInPlay", target: "table" }] };

  it("loses the game for the players once a living player's deck is empty and nothing is resolving, and not while the card is out of play", () => {
    const withFlag = table({ staging: [CODES.flames], deckOf: ["filler"] }, [FLAG]);
    const state = syncConstants({ ...withFlag.state, window: null }, withFlag.ctx);
    expect(flagged(state, "table", "losesAtEmptyDeck")).toBe(true);
    expect(settle(state, withFlag.ctx, []).lost).toBe(false);
    const emptied = { ...state, seats: [{ ...state.seats[0], deck: [] }, state.seats[1]] } as ScenarioState;
    const lost = settle(emptied, withFlag.ctx, []);
    expect(lost.lost).toBe(true);
    expect(lost.lossReason).toContain("deck");
    const off = table({ deckOf: ["filler"] }, [FLAG]);
    expect(settle({ ...off.state, window: null, seats: [{ ...off.state.seats[0], deck: [] }, off.state.seats[1]] } as ScenarioState, off.ctx, []).lost).toBe(false);
  });
});
