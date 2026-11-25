// Rules: rr.action, rr.response, rr.cost, rr.limits, rr.triggered-ability, rr.ready, rr.search, rr.quest-phase, rr.doomed-x,
// rr.play-restrictions-and-permissions, rr.engaged, rr.hero-cards, rr.the-word-choose, rr.deckbuilding (data/rules/entries.json).
// The Under the Ash Mountains heroes, allies, events and contract, written from their card text (data/cards/UtAM.json; data/printed holds
// no ledger for this pack, so the lines are the text of data/cards and every intent goes through sendUnledgered): Gildor Inglorion
// 22081:A:1, Wandering Exile 22082:A:1, Northern Bowmaster 22086:A:2, Reckless Attack 22087:A:2, Odo Proudfoot 22088:A:1, Defiant
// Challenge 22089:A:2, Helm of Secrecy 22090:A:1 and A:2, Council of the Wise 22091:A:1. The attachments are in
// under-the-ash-mountains-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckRulesOf } from "../../catalog/deck-rules.ts";
import { deckSaveRefusal } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf } from "../../../test/harness/scene.ts";
import { canPlay, choices, deckSaveFacts, endRound, fillers, packRow, play, playerTableFor, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const GILDOR = "22081";
const EXILE = "22082";
const BOWMASTER = "22086";
const RECKLESS = "22087";
const ODO = "22088";
const DEFIANT = "22089";
const HELM = "22090";
const COUNCIL = "22091";
// Core Aragorn (Leadership, threat 12), Legolas (Tactics), Éowyn (Spirit), Beravor (Lore, threat 10); Steward of Gondor ("Attach to a
// hero."), a Leadership attachment.
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
const STEWARD = "01026";
const SPYGLASS = "11180"; // an Item that prints no "Attach to" line
const PAL = "pal";
const ALLY = "ally";
const CARD = "card";
// Three Hobbit allies and an ally that is not a Hobbit, all Spirit with no text.
const HOBBIT = "hobbit-ally";
const MAN = "man-ally";
const HOBBIT_TWO = "hobbit-two";
const HOBBIT_THREE = "hobbit-three";
// Enemies that engage nobody and that 2 damage does not destroy.
const WALL = "wall";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([GILDOR, EXILE, BOWMASTER, RECKLESS, ODO, DEFIANT, HELM, COUNCIL, ARAGORN, LEGOLAS, EOWYN, BERAVOR, STEWARD, SPYGLASS]))]);
  cards.set(HOBBIT, definePrinted({ code: HOBBIT, name: "Hobbit Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Hobbit"] }));
  for (const code of [HOBBIT_TWO, HOBBIT_THREE]) cards.set(code, definePrinted({ code, name: code, type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Hobbit"] }));
  cards.set(MAN, definePrinted({ code: MAN, name: "Man Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 9, health: 9 }));
  base = { ...starter, cards };
});

describe("Gildor Inglorion (22081:A:1)", () => {
  // Gildor and the other player's Pal; each player's deck holds 3 cards.
  const gildor = (effects: readonly Effect[]) =>
    table(effects, { seats: 2, heroes: [{ code: GILDOR, seat: 0 }, { code: PAL, seat: 1 }], playerDeck: [...fillers(CARD, 3, 0), ...fillers(CARD, 3, 1)] });

  // "Action: Pay 1 resource from Gildor Inglorion's resource pool to choose a player to draw 1 card (Limit once per round.)": Gildor pays 1,
  // the other player is chosen and draws 1; the Action is not offered again this round, and is again in the next.
  lineSpec("22081:A:1", "Gildor Inglorion: pay 1 from his pool for a chosen player to draw 1, once per round", (effects) => {
    const tab = gildor(effects);
    const id = idsOf(tab, GILDOR);
    expect(triggers(tab.state, tab)).toContain("22081:action:1");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: id, effectId: "22081:action:1", payments: [{ heroId: id, amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab)).toEqual(["seat:0", "seat:1"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    expect(run.state.seats[1]?.hand).toHaveLength(1);
    expect(run.state.seats[0]?.hand).toHaveLength(0);
    expect(run.state.cards[id]?.resources).toBe(6 - 1);
    expect(triggers(run.state, tab)).not.toContain("22081:action:1");
    const next = endRound(run.state, tab);
    expect(next.state.round).toBe(tab.state.round + 1);
    expect(next.state.cards[id]?.resources).toBeGreaterThan(0);
    expect(triggers({ ...next.state, phase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0 }, tab)).toContain("22081:action:1");
  });

  // With both decks empty no player can draw, so the Action is not offered (rr.triggered-ability).
  it("22081:A:1 Gildor Inglorion: not offered when no player has a card to draw", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: GILDOR, seat: 0 }, { code: PAL, seat: 1 }] });
    expect(triggers(tab.state, tab)).not.toContain("22081:action:1");
  });
});

describe("Wandering Exile (22082:A:1)", () => {
  // The quest phase's commit, the Exile ready with `hand` cards in the player's hand: an event, then the man ally.
  const exile = (effects: readonly Effect[], hand: number) => table(effects, { start: "quest", heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: EXILE, seat: 0 }], hand: [{ code: CARD, seat: 0 }, { code: MAN, seat: 0 }].slice(0, hand), deck: ["f0", "f0"] });

  // "Response: After Wandering Exile commits to a quest, discard a card from your hand to ready Wandering Exile.": the Exile commits and
  // exhausts; the player discards the card he picks of his two, and the Exile is ready and still committed.
  lineSpec("22082:A:1", "Wandering Exile: after it commits, discard a card from your hand to ready it", (effects) => {
    const tab = exile(effects, 2);
    const id = idsOf(tab, EXILE);
    const [kept, thrown] = [idsOf(tab, CARD), idsOf(tab, MAN)];
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [id] }, tab.ctx);
    expect(run.state.cards[id]).toMatchObject({ committed: true, exhausted: true });
    expect(triggers(run.state, tab)).toContain("22082:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: id, effectId: "22082:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([kept, thrown].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: thrown }, tab.ctx);
    expect(run.state.seats[0]?.hand).toEqual([kept]);
    expect(run.state.seats[0]?.discard).toEqual([thrown]);
    expect(run.state.cards[id]).toMatchObject({ committed: true, exhausted: false });
  });

  // With an empty hand the cost cannot be paid: no Response.
  it("22082:A:1 Wandering Exile: not offered with an empty hand", () => {
    const tab = exile(EFFECTS, 0);
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, EXILE)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, EXILE)]?.committed).toBe(true);
    expect(triggers(run.state, tab)).not.toContain("22082:response:1");
  });
});

describe("Northern Bowmaster (22086:A:2)", () => {
  // "You cannot play Northern Bowmaster from your hand unless you are engaged with an enemy.": with the Wall engaged with the player he can
  // be played; with the Wall in the staging area, or engaged with the other player, he cannot. Legolas (Tactics) pays.
  lineSpec("22086:A:2", "Northern Bowmaster: played from the hand only while you are engaged with an enemy", (effects) => {
    const engaged = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: BOWMASTER, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    expect(canPlay(engaged.state, engaged, idsOf(engaged, BOWMASTER))).toBe(true);
    expect(play(begin(engaged.state), engaged, idsOf(engaged, BOWMASTER)).state.cards[idsOf(engaged, BOWMASTER)]?.zone).toBe("play");
    const staged = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: BOWMASTER, seat: 0 }], staging: [WALL] });
    expect(canPlay(staged.state, staged, idsOf(staged, BOWMASTER))).toBe(false);
    const theirs = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: BOWMASTER, seat: 0 }], engaged: [{ code: WALL, seat: 1 }] });
    expect(canPlay(theirs.state, theirs, idsOf(theirs, BOWMASTER))).toBe(false);
  });
});

describe("Reckless Attack (22087:A:2)", () => {
  // "Action: Each player deals 2 damage to an enemy engaged with him.": the first player picks one of his two Walls, the other player's
  // only Wall is taken without asking; each takes 2 damage, the other Wall none.
  lineSpec("22087:A:2", "Reckless Attack: each player deals 2 damage to an enemy engaged with him", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: RECKLESS, seat: 0 }], engaged: [{ code: WALL, seat: 0 }, { code: WALL, seat: 0 }, { code: WALL, seat: 1 }] });
    const [first = "", second = "", theirs = ""] = tab.ids[WALL] ?? [];
    let run = play(begin(tab.state), tab, idsOf(tab, RECKLESS));
    expect(choices(run.state, tab).sort()).toEqual([first, second].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: second }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[second]?.damage).toBe(2);
    expect(run.state.cards[first]?.damage).toBe(0);
    expect(run.state.cards[theirs]?.damage).toBe(2);
  });

  // With no enemy engaged with any player (the Wall in the staging area) no damage can be dealt, so it is not played (rr.triggered-ability).
  it("22087:A:2 Reckless Attack: not played with no enemy engaged", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: RECKLESS, seat: 0 }], staging: [WALL] });
    expect(canPlay(tab.state, tab, idsOf(tab, RECKLESS))).toBe(false);
  });
});

describe("Odo Proudfoot (22088:A:1)", () => {
  // "Response: After Odo Proudfoot enters play, search the top 5 cards of your deck for a Hobbit ally and add it to your hand. Shuffle the
  // other cards back into your deck.": the top 5 hold the two Hobbit allies and a man; the sixth card is a third Hobbit ally, not offered.
  // The picked one goes to the hand and the deck of 6 left is shuffled. Éowyn (Spirit) pays.
  lineSpec("22088:A:1", "Odo Proudfoot: after he enters play, a Hobbit ally of the top 5 to the hand, the deck shuffled", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: ODO, seat: 0 }], playerDeck: [{ code: MAN, seat: 0 }, { code: HOBBIT, seat: 0 }, { code: CARD, seat: 0 }, { code: HOBBIT_TWO, seat: 0 }, { code: CARD, seat: 0 }, { code: HOBBIT_THREE, seat: 0 }, { code: CARD, seat: 0 }] });
    const odo = idsOf(tab, ODO);
    const deck = tab.state.seats[0]?.deck ?? [];
    let run = play(begin(tab.state), tab, odo);
    expect(triggers(run.state, tab)).toContain("22088:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: odo, effectId: "22088:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, HOBBIT), idsOf(tab, HOBBIT_TWO)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, HOBBIT_TWO) }, tab.ctx);
    expect(run.state.seats[0]?.hand).toEqual([idsOf(tab, HOBBIT_TWO)]);
    const left = deck.filter((id) => id !== idsOf(tab, HOBBIT_TWO));
    expect([...(run.state.seats[0]?.deck ?? [])].sort()).toEqual([...left].sort());
    expect(run.state.seats[0]?.deck).not.toEqual(left);
  });
});

describe("Defiant Challenge (22089:A:2)", () => {
  // "Action: Each player may ready a character he controls.": the first player readies his ally (Aragorn stays exhausted), the other
  // player readies his only exhausted character, the Pal. Éowyn (Spirit) pays nothing.
  lineSpec("22089:A:2", "Defiant Challenge: each player may ready a character he controls", (effects) => {
    const placed = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: DEFIANT, seat: 0 }] });
    let state = placed.state;
    for (const code of [ARAGORN, ALLY, PAL]) state = updateCard(state, idsOf(placed, code), { exhausted: true });
    const tab = { ...placed, state };
    let run = play(begin(tab.state), tab, idsOf(tab, DEFIANT));
    expect(choices(run.state, tab).sort()).toEqual(["ready", "skip"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "ready" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, ARAGORN), idsOf(tab, ALLY)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, ALLY) }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual(["ready", "skip"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "ready" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ALLY)]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, PAL)]?.exhausted).toBe(false);
  });

  // "may": the first player skips; the other player readies the Pal.
  it("22089:A:2 Defiant Challenge: a player may ready nothing", () => {
    const placed = table(EFFECTS, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: DEFIANT, seat: 0 }] });
    let state = placed.state;
    for (const code of [ALLY, PAL]) state = updateCard(state, idsOf(placed, code), { exhausted: true });
    const tab = { ...placed, state };
    let run = play(begin(tab.state), tab, idsOf(tab, DEFIANT));
    run = sendUnledgered(run, { type: "Choose", optionId: "skip" }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: "ready" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ALLY)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, PAL)]?.exhausted).toBe(false);
  });

  // With no exhausted character in play no player can ready one, so it is not played (rr.triggered-ability).
  it("22089:A:2 Defiant Challenge: not played with no exhausted character", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: DEFIANT, seat: 0 }] });
    expect(canPlay(tab.state, tab, idsOf(tab, DEFIANT))).toBe(false);
  });
});

describe("Helm of Secrecy (22090:A:1, A:2)", () => {
  // "Limit 1 per deck.": a deck of 1 copy saves, one of 2 is refused.
  it("22090:A:1 Helm of Secrecy: limit 1 per deck", () => {
    const row = packRow("UtAM", HELM);
    expect(row?.deckLimit).toBe(1);
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    expect(deckSaveRefusal(["h1"], [...events, { code: HELM, count: 1 }], deckSaveFacts(row))).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: HELM, count: 2 }], deckSaveFacts(row))).toMatchObject({ cardCode: HELM });
  });

  // "Action: Choose a hero you control and discard all tokens from it. Select a different non-Fellowship, non-Baggins hero from your
  // collection with a threat cost less than or equal to the chosen hero. Swap those heroes, moving all eligible attachments to the hero from
  // your collection.": the collection is every hero card of the card table (docs/brief.md). Beravor (threat 10, 2 damage, 6 resources)
  // with Steward of Gondor is chosen; the tokens are gone, the heroes offered all cost 10 or less and none is Fellowship, Baggins or
  // Beravor; Éowyn is swapped in with the Steward, and Beravor leaves the game. Aragorn pays 4.
  lineSpec("22090:A:2", "Helm of Secrecy: a hero you control swapped for a hero of no more threat cost from the collection", (effects) => {
    const placed = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }], attached: [{ code: STEWARD, host: BERAVOR }], hand: [{ code: HELM, seat: 0 }] });
    const [aragorn, beravor, steward] = [idsOf(placed, ARAGORN), idsOf(placed, BERAVOR), idsOf(placed, STEWARD)];
    const tab = { ...placed, state: updateCard(placed.state, beravor, { damage: 2 }) };
    let run = play(begin(tab.state), tab, idsOf(tab, HELM));
    expect(choices(run.state, tab).sort()).toEqual([aragorn, beravor].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: beravor }, tab.ctx);
    expect(run.state.cards[beravor]).toMatchObject({ damage: 0, resources: 0 });
    const offered = choices(run.state, tab).map((id) => tab.ctx.cards.get(run.state.cards[id]?.code ?? ""));
    expect(offered.length).toBeGreaterThan(1);
    expect(offered.every((card) => card?.type === "hero" && (card.threat ?? 99) <= 10 && card.sphere !== "fellowship" && card.sphere !== "baggins" && card.name !== "Beravor")).toBe(true);
    const eowyn = choices(run.state, tab).find((id) => run.state.cards[id]?.code === EOWYN) ?? "";
    run = sendUnledgered(run, { type: "Choose", optionId: eowyn }, tab.ctx);
    expect(run.state.seats[0]?.heroes).toEqual([aragorn, eowyn]);
    expect(run.state.cards[steward]?.host).toBe(eowyn);
    expect(run.state.cards[beravor]?.zone).toBe("removed");
  });
});

describe("Helm of Secrecy moves another player's attachment (22090:A:2)", () => {
  // "moving all eligible attachments to the hero from your collection": Spyglass prints no "Attach to" line and belongs to the other player, who put it on Beravor; it is eligible for the new hero all the same.
  lineSpec("22090:A:2", "Helm of Secrecy: an attachment of another player that prints no \"Attach to\" line moves to the swapped-in hero", (effects) => {
    const placed = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: LEGOLAS, seat: 1 }], attached: [{ code: SPYGLASS, host: BERAVOR }], hand: [{ code: HELM, seat: 0 }] });
    const [beravor, spyglass] = [idsOf(placed, BERAVOR), idsOf(placed, SPYGLASS)];
    const tab = { ...placed, state: updateCard(placed.state, spyglass, { owner: 1 }) };
    let run = play(begin(tab.state), tab, idsOf(tab, HELM));
    run = sendUnledgered(run, { type: "Choose", optionId: beravor }, tab.ctx);
    const eowyn = choices(run.state, tab).find((id) => run.state.cards[id]?.code === EOWYN) ?? "";
    run = sendUnledgered(run, { type: "Choose", optionId: eowyn }, tab.ctx);
    expect(run.state.cards[spyglass]).toMatchObject({ host: eowyn, zone: "play" });
  });
});

describe("Council of the Wise (22091:A:1)", () => {
  // "You cannot include more than 1 copy of a card, by title, in your deck.": with the contract a deck with 2 copies of an event is
  // refused and one with 1 copy of each saves; without it the 2 copies save.
  lineSpec("22091:A:1", "Council of the Wise: at most 1 copy of a card by title", (effects) => {
    const row = packRow("UtAM", COUNCIL);
    expect(row?.type).toBe("contract");
    const facts = deckSaveFacts(row);
    const rules = deckRulesOf(effects, [COUNCIL]);
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    const doubled = [...events.slice(1), { code: "e0", count: 2 }];
    expect(deckSaveRefusal(["h1"], [...events, { code: COUNCIL, count: 1 }], facts, [], rules)).toBeNull();
    expect(deckSaveRefusal(["h1"], doubled, facts)).toBeNull();
    expect(deckSaveRefusal(["h1"], [...doubled, { code: COUNCIL, count: 1 }], facts, [], rules)).toMatchObject({ cardCode: "e0" });
  });
});
