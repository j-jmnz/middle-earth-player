// Rules: rr.resource-phase, rr.drawing-cards, rr.forced, rr.mulligan, rr.response, rr.action, rr.limits, rr.discard-pile-and-victory-display,
// rr.modifiers, rr.sentinel, rr.gains, rr.cannot, rr.damage, rr.quest-phase, rr.step-3-5 (data/rules/entries.json).
// The Grey Havens heroes and allies, each line tested from the words on the card: Círdan the Shipwright 11001:A:1, Galdor of the Havens
// 11002:A:1 and A:2, Warden of the Havens 11006:A:1, Lindon Navigator 11009:A:2, Sailor of Lune 11012:A:1. The attachments and events are
// in the-grey-havens-attachments.test.ts and the-grey-havens-events.test.ts. The lines are the text of data/cards/TGH.json (data/printed
// holds no entry for this pack), so every intent goes through sendUnledgered. Warden's sentinel is read through Hold Your Ground! (10119),
// which offers only sentinel characters; the questing damage comes from Rockslide (02092).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { moveCard } from "../../rules/core/zones.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, discarded, endRound, enter, fillers, passAll, playCode, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const CIRDAN = "11001";
const GALDOR = "11002";
const WARDEN = "11006";
const NAVIGATOR = "11009";
const SAILOR = "11012";
// Explorer's Almanac: a Lore attachment for the discard pile. The Evening Star: a Lore event to play.
const ALMANAC = "11011";
const EVENING_STAR = "11010";
const HOLD = "10119";
const ROCKSLIDE = "02092";
// Core Legolas (Tactics) and Denethor (Lore) pay for the cards played.
const LEGOLAS = "01005";
const DENETHOR = "01010";
const PLACE = "place";
const PAL = "pal";
const CARD = "card";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([CIRDAN, GALDOR, WARDEN, NAVIGATOR, SAILOR, ALMANAC, EVENING_STAR, HOLD, ROCKSLIDE, LEGOLAS, DENETHOR]))]);
  cards.set(PLACE, definePrinted({ code: PLACE, name: "Place", type: "location", threat: 0, questPoints: 9 }));
  base = { ...starter, cards };
});

// The commit ends and the quest phase runs to its next question, every window passed.
const questOn = (state: ScenarioState, tab: Table, ids: readonly string[]) => passAll(sendUnledgered(sendUnledgered(begin(state), { type: "Commit", cardIds: ids }, tab.ctx), { type: "Pass" }, tab.ctx), tab.ctx, { responses: true });

describe("Círdan the Shipwright (11001:A:1)", () => {
  // "Draw 1 additional card at the beginning of the resource phase.": he draws 2; his Forced (11001:A:2) then asks which of the 2 to discard.
  lineSpec("11001:A:1", "Círdan: draws 2 cards at the beginning of the resource phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: CIRDAN, seat: 0 }], playerDeck: fillers(CARD, 5) }, 0);
    const run = enter(tab.state, tab, "beginRound");
    expect(run.state.seats[0]?.deck).toHaveLength(5 - 2);
    expect((run.state.seats[0]?.hand.length ?? 0) + (run.state.seats[0]?.discard.length ?? 0)).toBe(2);
  });
});

describe("Galdor of the Havens (11002:A:1, A:2)", () => {
  // The mulligan window after the setup hand: an event and two allies in hand, six events in the deck.
  function mulligan(effects: readonly Effect[]): { tab: Table; state: ScenarioState } {
    const tab = table(effects, { heroes: [{ code: GALDOR, seat: 0 }], hand: [{ code: CARD, seat: 0 }, { code: ALLY, seat: 0 }, { code: ALLY, seat: 0 }], playerDeck: fillers(CARD, 6) });
    return { tab, state: { ...tab.state, mode: "mulligan", phase: "Setup", boundaryPhase: "Setup", window: { kind: "mulligan" } } };
  }

  // "Response: After drawing your setup hand, instead of taking a mulligan, you may discard any number of cards from your hand. Then, draw that
  // many cards.": the two allies are discarded, two cards are drawn, and the mulligan is not taken: the setup ends and the first resource
  // phase draws its 1 card, so the hand holds the kept card, the 2 drawn and that 1.
  lineSpec("11002:A:1", "Galdor: discards cards from the setup hand and draws as many, instead of a mulligan", (effects) => {
    const { tab, state } = mulligan(effects);
    const [first = "", second = ""] = tab.ids[ALLY] ?? [];
    const kept = idsOf(tab, CARD);
    expect(triggers(state, tab)).toContain("11002:response:1");
    let run = sendUnledgered(begin(state), { type: "Trigger", cardId: idsOf(tab, GALDOR), effectId: "11002:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([kept, first, "done"].sort());
    for (const option of [first, second, "done"]) run = sendUnledgered(run, { type: "Choose", optionId: option }, tab.ctx);
    expect(run.state.cards[kept]?.zone).toBe("hand");
    expect([run.state.cards[first]?.zone, run.state.cards[second]?.zone]).toEqual(["discard", "discard"]);
    expect(run.state.mode).toBe("resourceActions");
    expect(run.state.seats[0]?.hand).toHaveLength(1 + 2 + 1);
    expect(run.state.seats[0]?.deck).toHaveLength(6 - 2 - 1);
  });

  // "Action: If you have no cards in your hand, draw 6 cards. (Limit once per game.)": with an empty hand he draws 6; with the hand emptied
  // again the next round, the Action is not offered.
  lineSpec("11002:A:2", "Galdor: draws 6 cards with an empty hand, once per game", (effects) => {
    const tab = table(effects, { heroes: [{ code: GALDOR, seat: 0 }], playerDeck: fillers(CARD, 9) });
    const galdor = idsOf(tab, GALDOR);
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: galdor, effectId: "11002:action:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(6);
    expect(run.state.seats[0]?.deck).toHaveLength(3);
    let emptied = endRound(run.state, tab).state;
    for (const id of emptied.seats[0]?.hand ?? []) emptied = moveCard(emptied, id, { zone: "discard", seat: 0 });
    expect(emptied.seats[0]?.hand).toEqual([]);
    expect(triggers({ ...emptied, phase: "Planning", boundaryPhase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0 }, tab)).not.toContain("11002:action:1");
  });

  it("11002:A:2 Galdor: not offered with an empty hand and an empty deck", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GALDOR, seat: 0 }] });
    expect(tab.state.seats[0]?.deck).toEqual([]);
    expect(triggers(tab.state, tab)).not.toContain("11002:action:1");
  });

  it("11002:A:2 Galdor: not offered with a card in hand", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GALDOR, seat: 0 }], hand: [{ code: CARD, seat: 0 }], playerDeck: fillers(CARD, 9) });
    expect(triggers(tab.state, tab)).not.toContain("11002:action:1");
  });
});

describe("Warden of the Havens (11006:A:1)", () => {
  // Warden, exhausted; Legolas (Tactics) and Denethor (Lore) to pay; a location for The Evening Star; Explorer's Almanac on top of the discard
  // pile (or the other player's); Hold Your Ground! and The Evening Star in hand.
  function scene(effects: readonly Effect[], seat: 0 | 1): Table {
    const start = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: WARDEN, seat: 0 }], staging: [PLACE], hand: [{ code: HOLD, seat: 0 }, { code: EVENING_STAR, seat: 0 }] });
    // attach with no pairs brings the constants up to date, as the reducer does after an intent.
    const tab = attach(discarded(start, [[CARD, 0], [ALMANAC, seat]]).tab, []);
    return { ...tab, state: updateCard(tab.state, idsOf(tab, WARDEN), { exhausted: true }) };
  }

  // "While the top card of your discard pile is an attachment, Warden of the Havens gets +2 Defense and gains sentinel.": with the Almanac on
  // top he has Defense 1 + 2 and Hold Your Ground! (a sentinel character) can ready him; once The Evening Star is played, an event is on top
  // and he has his printed Defense.
  lineSpec("11006:A:1", "Warden of the Havens: +2 Defense and sentinel while an attachment is on top of the discard pile", (effects) => {
    const tab = scene(effects, 0);
    const warden = idsOf(tab, WARDEN);
    expect(stat(tab.state, tab, warden, "defense")).toBe(printed(tab, WARDEN, "defense") + 2);
    const held = playCode(tab, HOLD);
    expect(held.state.cards[warden]?.exhausted).toBe(false);
    // The one location takes the progress without a question.
    const run = playCode(tab, EVENING_STAR);
    expect(run.state.cards[idsOf(tab, PLACE)]?.progress).toBe(2);
    expect(run.state.seats[0]?.discard.at(-1)).toBe(idsOf(tab, EVENING_STAR));
    expect(stat(run.state, tab, warden, "defense")).toBe(printed(tab, WARDEN, "defense"));
  });

  // "your discard pile": the attachment on top of the other player's discard pile gives nothing.
  it("11006:A:1 Warden of the Havens: an attachment on top of another player's discard pile gives nothing", () => {
    const tab = scene(EFFECTS, 1);
    expect(stat(tab.state, tab, idsOf(tab, WARDEN), "defense")).toBe(printed(tab, WARDEN, "defense"));
  });
});

describe("Sailor of Lune (11012:A:1)", () => {
  // The Sailor and Denethor quest against Rockslide (2 damage to each character committed); `top` is on top of the discard pile.
  function scene(effects: readonly Effect[], top: string): Table {
    const start = table(effects, { start: "quest", heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: SAILOR, seat: 0 }], deck: [ROCKSLIDE, ROCKSLIDE] });
    return attach(discarded(start, [[top, 0]]).tab, []);
  }

  // "While the top card of your discard pile is an event, Sailor of Lune gets +1 Willpower and gains: "Cannot be damaged while committed to the
  // quest."": with an event on top he has Willpower 2 and Rockslide deals him no damage, while Denethor takes 2.
  lineSpec("11012:A:1", "Sailor of Lune: +1 Willpower and no damage while questing, with an event on top of the discard pile", (effects) => {
    const tab = scene(effects, EVENING_STAR);
    const [sailor, denethor] = [idsOf(tab, SAILOR), idsOf(tab, DENETHOR)];
    expect(stat(tab.state, tab, sailor, "willpower")).toBe(printed(tab, SAILOR, "willpower") + 1);
    const run = questOn(tab.state, tab, [sailor, denethor]);
    expect(run.state.cards[denethor]?.damage).toBe(2);
    expect(run.state.cards[sailor]).toMatchObject({ zone: "play", damage: 0 });
  });

  // With an attachment on top, his printed Willpower, and Rockslide destroys him (2 hit points).
  it("11012:A:1 Sailor of Lune: no bonus with an attachment on top of the discard pile", () => {
    const tab = scene(EFFECTS, ALMANAC);
    const sailor = idsOf(tab, SAILOR);
    expect(stat(tab.state, tab, sailor, "willpower")).toBe(printed(tab, SAILOR, "willpower"));
    const run = questOn(tab.state, tab, [sailor, idsOf(tab, DENETHOR)]);
    expect(run.state.cards[sailor]?.zone).toBe("discard");
  });
});

describe("Lindon Navigator (11009:A:2)", () => {
  // The Navigator and Denethor quest; nothing is revealed that does anything.
  function scene(effects: readonly Effect[], hand: number): Table {
    return table(effects, { start: "quest", heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: NAVIGATOR, seat: 0 }], hand: fillers(CARD, hand), deck: ["f0", "f0"] });
  }

  // "Forced: After resolving a quest to which Lindon Navigator was committed, either discard it from play or discard 1 card from your hand.":
  // the player is asked; discarding a card from the hand keeps the Navigator in play.
  lineSpec("11009:A:2", "Lindon Navigator: after the quest resolves, discard him or a card from the hand", (effects) => {
    const tab = scene(effects, 2);
    const navigator = idsOf(tab, NAVIGATOR);
    let run = questOn(tab.state, tab, [navigator, idsOf(tab, DENETHOR)]);
    expect(choices(run.state, tab).sort()).toEqual(["discard", "hand"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "hand" }, tab.ctx);
    // The two cards in hand are alike, so the discard asks nothing.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(run.state.cards[navigator]?.zone).toBe("play");
  });

  it("11009:A:2 Lindon Navigator: the player may discard him from play", () => {
    const tab = scene(EFFECTS, 2);
    const navigator = idsOf(tab, NAVIGATOR);
    let run = questOn(tab.state, tab, [navigator, idsOf(tab, DENETHOR)]);
    run = sendUnledgered(run, { type: "Choose", optionId: "discard" }, tab.ctx);
    expect(run.state.cards[navigator]?.zone).toBe("discard");
    expect(run.state.seats[0]?.hand).toHaveLength(2);
  });

  // Not committed: nothing happens to him or the hand.
  it("11009:A:2 Lindon Navigator: no Forced when he did not quest", () => {
    const tab = scene(EFFECTS, 2);
    const run = questOn(tab.state, tab, [idsOf(tab, DENETHOR)]);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, NAVIGATOR)]?.zone).toBe("play");
    expect(run.state.seats[0]?.hand).toHaveLength(2);
  });
});
