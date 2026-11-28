// Rules: rr.response, rr.action, rr.resource-match, rr.doomed-x, rr.triggered-ability, rr.engagement-check, rr.search, rr.destroy,
// rr.deckbuilding (data/rules/entries.json).
// The Challenge of the Wainriders heroes, allies, events and contract, written from their card text (data/cards/CotW.json; data/printed
// holds the pack's ledger, so every line is checked against it): Saruman 22054:A:2
// and A:3, Nori 22059:A:1, Rohirrim Scout 22061:A:1, The Muster of Rohan 22062:A:1 and A:2, The Grey Wanderer 22074:A:1. The attachments
// are in challenge-of-the-wainriders-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckRulesOf } from "../../catalog/deck-rules.ts";
import { deckSaveRefusal } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, send, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, deckSaveFacts, discarded, endRound, enter, fillers, packRow, play, playableCards, playerTableFor, triggers } from "../../../test/harness/player-table.ts";

const SARUMAN = "22054";
const NORI = "22059";
const SCOUT = "22061";
const MUSTER = "22062";
const WANDERER = "22074";
// Defiant Challenge: a Spirit event with Doomed 2. Waters of Nimrodel: a Lore event with Doomed 3. Quick Strike: a Tactics event with no
// doomed keyword. Théodred: a Leadership Rohan hero; Beravor: a Lore hero, not Rohan. Snowbourn Scout: a Rohan ally.
const DEFIANT = "22089";
const WATERS = "08145";
const STRIKE = "01035";
const THEODRED = "01002";
const BERAVOR = "01012";
const SNOWBOURN = "01016";
const PAL = "pal";
const ALLY = "ally";
const CARD = "card";
// An enemy Nori destroys and one he does not; a non-unique enemy and a unique one that engage at threat 2.
const FRAIL = "frail";
const WALL = "wall";
const RAIDER = "raider";
const CHIEF = "chief";
// A Spirit Rohan ally with no text.
const RIDER = "rider";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([SARUMAN, NORI, SCOUT, MUSTER, WANDERER, DEFIANT, WATERS, STRIKE, THEODRED, BERAVOR, SNOWBOURN]))]);
  cards.set(FRAIL, definePrinted({ code: FRAIL, name: "Frail", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 1 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 3, health: 9 }));
  cards.set(RAIDER, definePrinted({ code: RAIDER, name: "Raider", type: "enemy", threat: 1, engagementCost: 2, attack: 1, defense: 1, health: 3 }));
  cards.set(RIDER, definePrinted({ code: RIDER, name: "Rider", type: "ally", sphere: "spirit", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Rohan"] }));
  cards.set(CHIEF, definePrinted({ code: CHIEF, name: "Chief", type: "enemy", isUnique: true, threat: 1, engagementCost: 2, attack: 1, defense: 1, health: 3 }));
  base = { ...starter, cards };
});

// The ids of the PlayCard intents the engine offers.

describe("Saruman (22054:A:2, A:3)", () => {
  // "While playing an event with the printed doomed keyword, Saruman gains the printed Leadership, Spirit, and Tactics icons.": Saruman (Lore)
  // pays alone for Defiant Challenge (Spirit, Doomed 2); he cannot pay for Quick Strike (Tactics, not doomed).
  lineSpec("22054:A:2", "Saruman: pays for an event with the printed doomed keyword of any sphere", (effects) => {
    const tab = table(effects, { heroes: [{ code: SARUMAN, seat: 0 }], allies: [{ code: RIDER, seat: 0 }], hand: [{ code: DEFIANT, seat: 0 }, { code: STRIKE, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const saruman = idsOf(tab, SARUMAN);
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, STRIKE), payments: [{ heroId: saruman, amount: 1 }] }, tab.ctx)).not.toBeNull();
    // Defiant Challenge readies an exhausted character: the Rider is exhausted, so the event can change the game.
    let run = send(begin(updateCard(tab.state, idsOf(tab, RIDER), { exhausted: true })), { type: "PlayCard", cardId: idsOf(tab, DEFIANT), payments: [{ heroId: saruman, amount: 0 }] }, tab.ctx);
    // The first player chooses whether to ready the Rider; the event resolves once he declines.
    run = send(run, { type: "Choose", optionId: "skip" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, DEFIANT)]?.zone).not.toBe("hand");
  });

  // Saruman exhausted, with Waters of Nimrodel (Doomed 3) and an Ally in hand; a damaged ally in play gives the Waters something to heal.
  function exhausted(effects: readonly Effect[]): Table {
    const tab = table(effects, { heroes: [{ code: SARUMAN, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: WATERS, seat: 0 }, { code: ALLY, seat: 0 }] });
    const ally = tab.ids[ALLY]?.find((id) => tab.state.cards[id]?.zone === "play") ?? "";
    return { ...tab, state: updateCard(updateCard(tab.state, idsOf(tab, SARUMAN), { exhausted: true }), ally, { damage: 1 }) };
  }

  // "Response: After you play a card with the doomed keyword, ready Saruman.": he plays Waters of Nimrodel exhausted (an event's cost needs no
  // ready hero) and readies.
  lineSpec("22054:A:3", "Saruman: after you play a card with the doomed keyword, ready him", (effects) => {
    const tab = exhausted(effects);
    const saruman = idsOf(tab, SARUMAN);
    let run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, WATERS), payments: [{ heroId: saruman, amount: 3 }] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("22054:response:1");
    run = send(run, { type: "Trigger", cardId: saruman, effectId: "22054:response:1" }, tab.ctx);
    expect(run.state.cards[saruman]?.exhausted).toBe(false);
  });

  // An ally with no doomed keyword: no Response.
  it("22054:A:3 Saruman: not offered after a card with no doomed keyword", () => {
    const tab = exhausted(EFFECTS);
    const hand = tab.ids[ALLY]?.find((id) => tab.state.cards[id]?.zone === "hand") ?? "";
    const run = play(begin(tab.state), tab, hand);
    expect(triggers(run.state, tab)).not.toContain("22054:response:1");
  });

  // Saruman ready: "ready Saruman" can change nothing, so the Response is not offered (rr.triggered-ability).
  it("22054:A:3 Saruman: not offered while he is ready", () => {
    const start = exhausted(EFFECTS);
    const tab = { ...start, state: updateCard(start.state, idsOf(start, SARUMAN), { exhausted: false }) };
    const run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, WATERS), payments: [{ heroId: idsOf(tab, SARUMAN), amount: 3 }] }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("22054:response:1");
  });
});

describe("Nori (22059:A:1)", () => {
  // Nori and the Pal; `enemy` engaged; the discard pile holds two cards, the Snowbourn Scout on top; the deck holds 2 cards.
  function nori(effects: readonly Effect[], enemy: string, pile = true): { tab: Table; top: string; under: string } {
    const start = table(effects, { heroes: [{ code: PAL, seat: 0 }], allies: [{ code: NORI, seat: 0 }], engaged: [{ code: enemy, seat: 0 }], playerDeck: fillers(CARD, 2) });
    const { tab, ids: [under = "", top = ""] } = pile ? discarded(start, [[ALLY, 0], [SNOWBOURN, 0]]) : { tab: start, ids: [] };
    return { tab, top, under };
  }

  // "Response: After Nori participates in an attack that destroys an enemy, put the top card of your discard pile on the bottom of your
  // deck.": Nori (Attack 2) and the Pal attack the Frail and destroy it; the Snowbourn Scout goes to the bottom of the deck and the Ally stays.
  lineSpec("22059:A:1", "Nori: after an attack he joins destroys an enemy, the top card of the discard pile goes to the bottom of the deck", (effects) => {
    const { tab, top, under } = nori(effects, FRAIL);
    let run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, FRAIL), attackerIds: [idsOf(tab, PAL), idsOf(tab, NORI)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, FRAIL)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).toContain("22059:response:1");
    run = send(run, { type: "Trigger", cardId: idsOf(tab, NORI), effectId: "22059:response:1" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[top]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck.at(-1)).toBe(top);
    expect(run.state.seats[0]?.deck).toHaveLength(3);
    expect(run.state.cards[under]?.zone).toBe("discard");
  });

  // The Wall survives the attack: no Response.
  it("22059:A:1 Nori: not offered when the attack destroys no enemy", () => {
    const { tab } = nori(EFFECTS, WALL);
    const run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [idsOf(tab, NORI)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WALL)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("22059:response:1");
  });

  // The Pal destroys the Frail alone: Nori did not participate.
  it("22059:A:1 Nori: not offered when he did not participate in the attack", () => {
    const { tab } = nori(EFFECTS, FRAIL);
    const run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, FRAIL), attackerIds: [idsOf(tab, PAL)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, FRAIL)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("22059:response:1");
  });

  // An empty discard pile: nothing can move, so the Response is not offered (rr.triggered-ability).
  it("22059:A:1 Nori: not offered with an empty discard pile", () => {
    const { tab } = nori(EFFECTS, FRAIL, false);
    const run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, FRAIL), attackerIds: [idsOf(tab, NORI)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, FRAIL)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("22059:response:1");
  });
});

describe("Rohirrim Scout (22061:A:1)", () => {
  // The Scout in play; the Raider (non-unique, engagement cost 2) and the Chief (unique) in the staging area; threat 8.
  const scouted = (effects: readonly Effect[]) => table(effects, { heroes: [{ code: PAL, seat: 0 }], allies: [{ code: SCOUT, seat: 0 }], staging: [RAIDER, CHIEF], playerDeck: fillers(CARD, 4) });

  // "Action: Discard Rohirrim Scout to choose a non-unique enemy in the staging area. That enemy does not make engagement checks against you
  // this round.": the Raider is chosen (the Chief is not a choice); in the encounter phase the Chief engages and the Raider stays in the
  // staging area; the next round it engages.
  lineSpec("22061:A:1", "Rohirrim Scout: discard it so a non-unique staged enemy makes no engagement checks against you this round", (effects) => {
    const tab = scouted(effects);
    const [scout, raider, chief] = [idsOf(tab, SCOUT), idsOf(tab, RAIDER), idsOf(tab, CHIEF)];
    let run = send(begin(tab.state), { type: "Trigger", cardId: scout, effectId: "22061:action:1" }, tab.ctx);
    expect(run.state.cards[scout]?.zone).toBe("discard");
    expect(run.state.window?.kind).not.toBe("choose");
    const encounter = enter(run.state, tab, "engagement");
    expect(encounter.state.cards[chief]?.zone).toBe("engaged");
    expect(encounter.state.cards[raider]?.zone).toBe("staging");
    run = endRound(encounter.state, tab);
    const next = enter(run.state, tab, "engagement");
    expect(next.state.cards[raider]?.zone).toBe("engaged");
  });

  // Only the unique Chief in the staging area: no non-unique enemy to choose, so it is not offered and the Scout is not discarded for nothing.
  it("22061:A:1 Rohirrim Scout: not offered without a non-unique enemy in the staging area", () => {
    const tab = table(EFFECTS, { heroes: [{ code: PAL, seat: 0 }], allies: [{ code: SCOUT, seat: 0 }], staging: [CHIEF] });
    expect(triggers(tab.state, tab)).not.toContain("22061:action:1");
  });
});

describe("The Muster of Rohan (22062:A:1, A:2)", () => {
  // "While paying for The Muster of Rohan, each Rohan hero you control is considered to have a Spirit icon.": Théodred (Leadership, Rohan)
  // pays its 4 alone; Beravor (Lore) cannot.
  lineSpec("22062:A:1", "The Muster of Rohan: a Rohan hero pays for it as if it had a Spirit icon", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODRED, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: MUSTER, seat: 0 }], playerDeck: [{ code: SNOWBOURN, seat: 0 }, ...fillers(CARD, 3)] });
    const muster = idsOf(tab, MUSTER);
    expect(refusal(tab.state, { type: "PlayCard", cardId: muster, payments: [{ heroId: idsOf(tab, BERAVOR), amount: 4 }] }, tab.ctx)).not.toBeNull();
    const run = send(begin(tab.state), { type: "PlayCard", cardId: muster, payments: [{ heroId: idsOf(tab, THEODRED), amount: 4 }] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, THEODRED)]?.resources).toBe(6 - 4);
    // Its search asks for the Snowbourn Scout.
    expect(choices(run.state, tab)).toContain(idsOf(tab, SNOWBOURN));
  });

  // "Planning Action: Search the top 10 cards of your deck for up to 4 Rohan allies and put them into play. Shuffle your deck. If any of
  // those allies are still in play at the end of the round, discard them.": the deck holds 5 Snowbourn Scouts in its top 10 and a sixth
  // eleventh. The copies of one card are offered as one choice, with "done"; the first 4 come into play under the player's control,
  // the fifth stays in the deck, the deck is shuffled (its order changes), and at the end of the round the 4 are discarded.
  lineSpec("22062:A:2", "The Muster of Rohan: puts up to 4 Rohan allies of the top 10 into play, shuffles, and discards them at the end of the round", (effects) => {
    const deck = [SNOWBOURN, CARD, SNOWBOURN, SNOWBOURN, CARD, SNOWBOURN, CARD, SNOWBOURN, CARD, CARD, SNOWBOURN, CARD].map((code) => ({ code, seat: 0 }));
    const tab = table(effects, { heroes: [{ code: THEODRED, seat: 0 }], hand: [{ code: MUSTER, seat: 0 }], playerDeck: deck });
    const scouts = tab.ids[SNOWBOURN] ?? [];
    const taken = scouts.slice(0, 4);
    const order = (tab.state.seats[0]?.deck ?? []).filter((id) => !taken.includes(id));
    let run = play(begin(tab.state), tab, idsOf(tab, MUSTER));
    for (const id of taken) {
      expect(choices(run.state, tab)).toContain(id);
      expect(choices(run.state, tab)).not.toContain(scouts[5]);
      run = send(run, { type: "Choose", optionId: id }, tab.ctx);
    }
    // Four are taken: the search asks no more.
    expect(run.state.window?.kind).not.toBe("choose");
    for (const id of taken) expect(run.state.cards[id]).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.cards[scouts[4] ?? ""]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toHaveLength(order.length);
    expect(run.state.seats[0]?.deck).not.toEqual(order);
    const ended = endRound(run.state, tab);
    for (const id of taken) expect(ended.state.cards[id]?.zone).toBe("discard");
  });

  // "for up to 4 Rohan allies": the player picks which. With a Snowbourn Scout on top and the Rider (another Rohan ally) under it, both
  // are offered; the player takes the Rider, then stops ("done"), and the Scout stays in the deck.
  it("22062:A:2 The Muster of Rohan: the player chooses which Rohan allies to take", () => {
    const tab = table(EFFECTS, { heroes: [{ code: THEODRED, seat: 0 }], hand: [{ code: MUSTER, seat: 0 }], playerDeck: [SNOWBOURN, RIDER, CARD].map((code) => ({ code, seat: 0 })) });
    let run = play(begin(tab.state), tab, idsOf(tab, MUSTER));
    expect(choices(run.state, tab)).toEqual(expect.arrayContaining([idsOf(tab, SNOWBOURN), idsOf(tab, RIDER)]));
    run = send(run, { type: "Choose", optionId: idsOf(tab, RIDER) }, tab.ctx);
    expect(choices(run.state, tab)).toEqual([idsOf(tab, SNOWBOURN), "done"]);
    run = send(run, { type: "Choose", optionId: "done" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, RIDER)]?.zone).toBe("play");
    expect(run.state.cards[idsOf(tab, SNOWBOURN)]?.zone).toBe("deck");
  });

  it("22062:A:2 The Muster of Rohan: not played outside the planning phase", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: THEODRED, seat: 0 }], hand: [{ code: MUSTER, seat: 0 }], playerDeck: [{ code: SNOWBOURN, seat: 0 }] });
    expect(playableCards(tab.state, tab)).not.toContain(idsOf(tab, MUSTER));
  });
});

describe("The Grey Wanderer (22074:A:1)", () => {
  // "You cannot choose more than 1 starting hero.": with the contract, a deck of 1 hero saves and one of 2 heroes is refused; without it, 2
  // heroes save.
  lineSpec("22074:A:1", "The Grey Wanderer: a deck with it has at most 1 starting hero", (effects) => {
    const facts = new Map(deckSaveFacts(packRow("CotW", WANDERER)));
    facts.set("h2", { ...(facts.get("h1") ?? { name: "", typeCode: "hero", sphereCode: null, deckLimit: null, deckLegal: true, traits: null }), name: "Second Hero" });
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    const rules = deckRulesOf(effects, [WANDERER]);
    const cards = [...events, { code: WANDERER, count: 1 }];
    expect(deckSaveRefusal(["h1", "h2"], events, facts)).toBeNull();
    expect(deckSaveRefusal(["h1"], cards, facts, [], rules)).toBeNull();
    expect(deckSaveRefusal(["h1", "h2"], cards, facts, [], rules)).toMatchObject({ cardCode: "h2" });
  });
});
