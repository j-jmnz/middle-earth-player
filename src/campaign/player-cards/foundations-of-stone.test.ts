// Rules: rr.forced, rr.quest-phase, rr.exhausted, rr.ranged, rr.action, rr.cost, rr.then, rr.drawing-cards, rr.triggered-ability
// (data/rules/entries.json).
// The Foundations of Stone hero, allies and event, written from their card text (data/cards/FoS.json; data/printed holds no ledger for this
// pack, so every intent goes through sendUnledgered): Glorfindel 04101:A:1, Trollshaw Scout 04104:A:2 and A:3, Imladris Stargazer 04106:A:1,
// Daeron's Runes 04108:A:1. The attachments are in foundations-of-stone-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, fillers, passAll, playCode, playerTable, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const GLORFINDEL = "04101";
const SCOUT = "04104";
const STARGAZER = "04106";
const VALINOR = "04107";
const RUNES = "04108";
// Core heroes: Legolas (Tactics), Éowyn (Spirit), Beravor (Lore).
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
const WEAK = "weak";
const PAL = "pal";
const CARD = "card";
// Six distinct deck cards, so the order of the top of a deck can be told apart.
const ONE = "one";
const TWO = "two";
const THREE = "three";
const FOUR = "four";
const FIVE = "five";
const SIX = "six";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([GLORFINDEL, SCOUT, STARGAZER, VALINOR, RUNES, LEGOLAS, EOWYN, BERAVOR]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  for (const code of [ONE, TWO, THREE, FOUR, FIVE, SIX]) cards.set(code, definePrinted({ code, name: code, type: "event", sphere: "leadership", cost: 0 }));
  base = { ...starter, cards };
});

const exhausted = (tab: Table, id: string): Table => ({ ...tab, state: updateCard(tab.state, id, { exhausted: true }) });

describe("Glorfindel (04101:A:1)", () => {
  // "Forced: After Glorfindel exhausts to commit to a quest, raise your threat by 1.": he commits (and exhausts), and his player's threat
  // goes from 8 to 9 before the quest resolves (staging 0, so the quest itself raises nothing).
  lineSpec("04101:A:1", "Glorfindel: his threat rises by 1 after he exhausts to commit", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: GLORFINDEL, seat: 0 }, { code: PAL, seat: 0 }], deck: ["f0", "f0"] });
    const glorfindel = idsOf(tab, GLORFINDEL);
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [glorfindel] }, tab.ctx);
    expect(run.state.cards[glorfindel]).toMatchObject({ committed: true, exhausted: true });
    expect(run.steps.some((step) => step.kind === "threat" && step.seat === 0 && step.amount === 1)).toBe(true);
    expect(run.state.seats[0]?.threat).toBe(9);
  });

  // Another hero commits while Glorfindel stays back exhausted: no threat.
  it("04101:A:1 Glorfindel: no threat when another hero commits", () => {
    const scene = table(EFFECTS, { start: "quest", heroes: [{ code: GLORFINDEL, seat: 0 }, { code: PAL, seat: 0 }], deck: ["f0", "f0"] });
    const tab = exhausted(scene, idsOf(scene, GLORFINDEL));
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, PAL)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, PAL)]?.committed).toBe(true);
    expect(run.steps.some((step) => step.kind === "threat")).toBe(false);
  });

  // With Light of Valinor he commits without exhausting, so he did not "exhaust to commit": no threat.
  it("04101:A:1 Glorfindel: no threat when he commits without exhausting (Light of Valinor)", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: GLORFINDEL, seat: 0 }], attached: [{ code: VALINOR, host: GLORFINDEL }], deck: ["f0", "f0"] });
    const glorfindel = idsOf(tab, GLORFINDEL);
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [glorfindel] }, tab.ctx);
    expect(run.state.cards[glorfindel]).toMatchObject({ committed: true, exhausted: false });
    expect(run.steps.some((step) => step.kind === "threat")).toBe(false);
  });
});

describe("Trollshaw Scout (04104:A:2, A:3)", () => {
  // The Scout in play with `hand` cards in its player's hand, Legolas beside it, and an enemy engaged.
  function scoutTable(effects: readonly Effect[], hand: number): { tab: Table; scout: string; weak: string } {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: SCOUT, seat: 0 }], hand: fillers(CARD, hand), engaged: [{ code: WEAK, seat: 0 }] });
    return { tab, scout: idsOf(tab, SCOUT), weak: idsOf(tab, WEAK) };
  }

  // "Trollshaw Scout does not exhaust to attack.": it attacks and stays ready; Legolas, who attacks the same way, exhausts.
  lineSpec("04104:A:2", "Trollshaw Scout: does not exhaust to attack", (effects) => {
    const { tab, scout, weak } = scoutTable(effects, 1);
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: weak, attackerIds: [scout, idsOf(tab, LEGOLAS)] }, tab.ctx);
    expect(run.state.cards[scout]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, LEGOLAS)]?.exhausted).toBe(true);
  });

  // "Forced: After Trollshaw Scout attacks, either discard it from play or discard 1 card from your hand.": with a card in hand both are
  // offered; the player discards the card and the Scout stays in play.
  lineSpec("04104:A:3", "Trollshaw Scout: after it attacks, discard it or a card from the hand", (effects) => {
    const { tab, scout, weak } = scoutTable(effects, 1);
    const card = idsOf(tab, CARD);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: weak, attackerIds: [scout] }, tab.ctx);
    run = passAll(run, tab.ctx, { responses: true });
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual(["discardHand", "discardSelf"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "discardHand" }, tab.ctx);
    expect(run.state.cards[card]?.zone).toBe("discard");
    expect(run.state.cards[scout]?.zone).toBe("play");
  });

  // The other choice: the Scout goes to the discard pile and the hand is kept.
  it("04104:A:3 Trollshaw Scout: discarding it from play keeps the hand", () => {
    const { tab, scout, weak } = scoutTable(EFFECTS, 1);
    let run = passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: weak, attackerIds: [scout] }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.window?.kind).toBe("choose");
    run = sendUnledgered(run, { type: "Choose", optionId: "discardSelf" }, tab.ctx);
    expect(run.state.cards[scout]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, CARD)]?.zone).toBe("hand");
  });

  // With an empty hand only the Scout can go: it is discarded.
  it("04104:A:3 Trollshaw Scout: with an empty hand it is discarded", () => {
    const { tab, scout, weak } = scoutTable(EFFECTS, 0);
    const run = passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: weak, attackerIds: [scout] }, tab.ctx), tab.ctx, { responses: true });
    // The one option left is taken without a question.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[scout]?.zone).toBe("discard");
  });
});

describe("Imladris Stargazer (04106:A:1)", () => {
  // "Action: Exhaust Imladris Stargazer to choose a player. That player looks at the top 5 cards of his deck and then returns them to the top
  // of his deck in any order.": the Stargazer's player chooses the other player, whose deck holds 6 distinct cards. That player puts the
  // fifth card on top, then the fourth, the third and the second; the sixth card, which was not looked at, stays sixth. The Stargazer
  // exhausts and its own player's deck is not touched.
  lineSpec("04106:A:1", "Imladris Stargazer: the chosen player orders the top 5 cards of their deck", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: STARGAZER, seat: 0 }], playerDeck: [...fillers(CARD, 3), ...[ONE, TWO, THREE, FOUR, FIVE, SIX].map((code) => ({ code, seat: 1 }))] });
    const stargazer = idsOf(tab, STARGAZER);
    const deck = [ONE, TWO, THREE, FOUR, FIVE, SIX].map((code) => idsOf(tab, code));
    const own = tab.state.seats[0]?.deck;
    expect(tab.state.seats[1]?.deck).toEqual(deck);
    expect(triggers(tab.state, tab)).toContain("04106:action:1");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: stargazer, effectId: "04106:action:1" }, tab.ctx);
    expect(run.state.cards[stargazer]?.exhausted).toBe(true);
    expect(run.state.window?.kind).toBe("choose");
    const players = choices(run.state, tab);
    expect(players).toHaveLength(2);
    run = sendUnledgered(run, { type: "Choose", optionId: players[1] ?? "" }, tab.ctx);
    // The chosen player is shown the top 5, then puts them back one by one.
    expect(run.state.window).toEqual({ kind: "look", seat: 1, cardIds: deck.slice(0, 5) });
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    expect(choices(run.state, tab).sort()).toEqual(deck.slice(0, 5).sort());
    for (const code of [FIVE, FOUR, THREE, TWO]) run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, code) }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.seats[1]?.deck).toEqual([FIVE, FOUR, THREE, TWO, ONE, SIX].map((code) => idsOf(tab, code)));
    expect(run.state.seats[0]?.deck).toEqual(own);
  });
});

describe("Daeron's Runes (04108:A:1)", () => {
  // Beravor (Lore) pays; the hand holds the Runes and one other card, the deck `deck` cards.
  const runes = (effects: readonly Effect[], deck: number): Table => table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], hand: [{ code: RUNES, seat: 0 }, { code: ONE, seat: 0 }], playerDeck: [TWO, THREE, FOUR].slice(0, deck).map((code) => ({ code, seat: 0 })) });

  // "Action: Draw 2 cards. Then, discard 1 card from your hand.": 2 cards are drawn, then the player picks one of the 3 cards in hand to
  // discard.
  lineSpec("04108:A:1", "Daeron's Runes: draw 2 cards, then discard 1 card from the hand", (effects) => {
    const tab = runes(effects, 3);
    const one = idsOf(tab, ONE);
    let run = playCode(tab, RUNES);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([one, idsOf(tab, TWO), idsOf(tab, THREE)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: one }, tab.ctx);
    expect(run.state.cards[one]?.zone).toBe("discard");
    expect(run.state.seats[0]?.hand).toHaveLength(2);
    expect(run.state.seats[0]?.deck).toHaveLength(1);
  });

  // A deck of 1 card: only 1 is drawn, so the draw did not resolve in full and nothing is discarded.
  lineSpec("04108:A:1", "Daeron's Runes: no discard when fewer than 2 cards could be drawn (rr.then)", (effects) => {
    const tab = runes(effects, 1);
    const run = playCode(tab, RUNES);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.seats[0]?.hand).toHaveLength(2);
    expect(run.state.cards[idsOf(tab, ONE)]?.zone).toBe("hand");
  });

  // An empty deck: nothing can be drawn, so the discard after "Then" does not resolve either and the event cannot change the game state
  // (rr.triggered-ability). It is not offered.
  it("04108:A:1 Daeron's Runes: not offered with an empty deck", () => {
    const tab = runes(EFFECTS, 0);
    const runes0 = idsOf(tab, RUNES);
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === runes0)).toBe(false);
  });
});
