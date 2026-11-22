// Rules: rr.action, rr.search, rr.lasting-effects, rr.response, rr.destroy, rr.discard-pile-and-victory-display, rr.cost, bts.valour,
// rr.play-restrictions-and-permissions, rr.unique-cards (data/rules/entries.json).
// The Across the Ettenmoors events, written from their card text (data/cards/AtE.json; data/printed holds no ledger for this pack, so every
// intent goes through sendUnledgered): Dúnedain Message 10056:A:1, Fair and Perilous 10060:A:1 and A:2, None Return 10062:A:1 and A:2, Hope
// Rekindled 10063:A:1 and A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withThreat } from "../../rules/core/state.ts";
import { playCost } from "../../rules/player/attach.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, enter, fillers, passAll, play, playCode, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const MESSAGE = "10056";
const DELAY = "10058";
const FAIR = "10060";
const NONE_RETURN = "10062";
const HOPE = "10063";
// Gather Information: another player side quest.
const GATHER = "09014";
// Glorfindel (Spirit, Noldor, Willpower 3, Attack 3), Trollshaw Scout (a Noldor ally), Henamarth Riversong (a Silvan ally).
const GLORFINDEL = "04101";
const SCOUT = "04104";
const HENAMARTH = "01060";
// Core heroes: Aragorn (Leadership), Legolas (Tactics, Silvan, Attack 3), Éowyn (Spirit, Rohan), Beravor (Lore).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
// Valour events: Horn's Cry (Tactics, cost 2), Hold Your Ground! (Tactics, cost 1), Fierce Defense (Tactics, cost 3). Feint: a Tactics
// event of cost 1 with no Valour trigger.
const HORN = "10088";
const HOLD = "10119";
const FIERCE = "17113";
const FEINT = "01034";
// Enemies of 1 hit point: a non-unique one and a unique one.
const FRAIL = "frail";
const BOSS = "boss";
const PAL = "pal";
const CARD = "card";
const ONE = "one";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [MESSAGE, DELAY, FAIR, NONE_RETURN, HOPE, GATHER, GLORFINDEL, SCOUT, HENAMARTH, ARAGORN, LEGOLAS, EOWYN, BERAVOR, HORN, HOLD, FIERCE, FEINT];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(FRAIL, definePrinted({ code: FRAIL, name: "Frail", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  cards.set(BOSS, definePrinted({ code: BOSS, name: "Boss", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1, isUnique: true }));
  cards.set(ONE, definePrinted({ code: ONE, name: "One", type: "event", sphere: "leadership", cost: 0 }));
  base = { ...starter, cards };
});

describe("Dúnedain Message (10056:A:1)", () => {
  // "Action: Search your deck for a side quest and add it to your hand. Shuffle your deck.": the two side quests in the deck are offered
  // (the events are not); Gather Information goes to the hand, Delay the Enemy stays in the deck, and the deck is shuffled.
  lineSpec("10056:A:1", "Dúnedain Message: search the deck for a side quest, add it to the hand, shuffle", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: MESSAGE, seat: 0 }], playerDeck: [...fillers(CARD, 2), { code: DELAY, seat: 0 }, ...fillers(CARD, 2), { code: GATHER, seat: 0 }, ...fillers(CARD, 2)] });
    const [delay, gather] = [idsOf(tab, DELAY), idsOf(tab, GATHER)];
    const cursor = tab.state.seedCursor;
    let run = playCode(tab, MESSAGE);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([delay, gather].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: gather }, tab.ctx);
    expect(run.state.cards[gather]?.zone).toBe("hand");
    expect(run.state.cards[delay]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toHaveLength(7);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });
});

describe("Fair and Perilous (10060:A:1, A:2)", () => {
  // Éowyn (Spirit) pays; Glorfindel and the other player's Legolas are heroes, the Scout and Henamarth allies.
  const fair = (effects: readonly Effect[]): Table =>
    table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: GLORFINDEL, seat: 0 }, { code: LEGOLAS, seat: 1 }], allies: [{ code: SCOUT, seat: 0 }, { code: HENAMARTH, seat: 1 }], hand: [{ code: FAIR, seat: 0 }] });

  // "Action: Choose a Noldor or Silvan character." "Until the end of the phase, add that character's Willpower to its Attack.": Glorfindel,
  // Legolas, the Scout and Henamarth are offered, Éowyn is not; Glorfindel (Willpower 3) has Attack 3 + 3 until the planning phase ends.
  for (const line of ["10060:A:1", "10060:A:2"]) {
    lineSpec(line, "Fair and Perilous: a Noldor or Silvan character adds its Willpower to its Attack until the end of the phase", (effects) => {
      const tab = fair(effects);
      const glorfindel = idsOf(tab, GLORFINDEL);
      let run = playCode(tab, FAIR);
      expect(choices(run.state, tab).sort()).toEqual([glorfindel, idsOf(tab, LEGOLAS), idsOf(tab, SCOUT), idsOf(tab, HENAMARTH)].sort());
      run = sendUnledgered(run, { type: "Choose", optionId: glorfindel }, tab.ctx);
      expect(stat(run.state, tab, glorfindel, "attack")).toBe(3 + 3);
      expect(stat(enter(run.state, tab, "questCommit").state, tab, glorfindel, "attack")).toBe(3);
    });
  }
});

describe("None Return (10062:A:1, A:2)", () => {
  // The Pal (Attack 1) attacks the enemy `enemy` (1 hit point, Defense 0) engaged with his player; None Return is in hand, Beravor (Lore) pays for it, and the
  // victory display holds `victory` copies of None Return.
  function destroyed(effects: readonly Effect[], enemy: string, victory: number): { tab: Table; run: Run; card: string; enemy: string } {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: NONE_RETURN, seat: 0 }], engaged: [{ code: enemy, seat: 0 }], victory: Array.from({ length: victory }, () => NONE_RETURN) });
    const id = idsOf(tab, enemy);
    const card = tab.ids[NONE_RETURN]?.find((each) => tab.state.cards[each]?.zone === "hand") ?? "";
    // Beravor's Action opens an action window after the attack is declared; it is passed.
    const run = passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: id, attackerIds: [idsOf(tab, PAL)] }, tab.ctx), tab.ctx);
    return { tab, run, card, enemy: id };
  }
  const answer = (tab: Table, run: Run, card: string): Run => sendUnledgered(run, { type: "Trigger", cardId: card, effectId: "10062:response:1", payments: [{ heroId: idsOf(tab, BERAVOR), amount: 1 }] }, tab.ctx);

  // "Response: After a non-unique enemy is destroyed, add None Return to the victory display to add that enemy to the victory display.": the
  // destroyed enemy goes to the victory display with None Return, not to the discard pile; Beravor pays 1.
  lineSpec("10062:A:2", "None Return: after a non-unique enemy is destroyed, it and the enemy go to the victory display", (effects) => {
    const { tab, run: start, card, enemy } = destroyed(effects, FRAIL, 0);
    expect(triggers(start.state, tab)).toContain("10062:response:1");
    const run = answer(tab, start, card);
    expect(run.state.cards[card]?.zone).toBe("victory");
    expect(run.state.cards[enemy]?.zone).toBe("victory");
    expect(run.state.cards[idsOf(tab, BERAVOR)]?.resources).toBe(6 - 1);
  });

  // "a non-unique enemy": a unique enemy destroyed gives no Response.
  it("10062:A:2 None Return: not offered when a unique enemy is destroyed", () => {
    const { tab, run, enemy } = destroyed(EFFECTS, BOSS, 0);
    expect(run.state.cards[enemy]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("10062:response:1");
  });

  // "Limit 3 copies of None Return in the victory display.": with 2 there it may still be added (the third); with 3 it is not offered. The
  // Response record carries the same limit as its condition, so the line holds without the constant record: a plain test.
  it("10062:A:1 None Return: not offered with 3 copies in the victory display, offered with 2", () => {
    const effects = EFFECTS;
    const two = destroyed(effects, FRAIL, 2);
    expect(answer(two.tab, two.run, two.card).state.cards[two.card]?.zone).toBe("victory");
    const three = destroyed(effects, FRAIL, 3);
    expect(three.run.state.cards[three.enemy]?.zone).not.toBe("engaged");
    expect(triggers(three.run.state, three.tab)).not.toContain("10062:response:1");
  });

  // Legolas destroys the enemy: his own Response ("After Legolas participates in an attack that destroys an enemy") and None Return answer
  // the same moment (rr.response: several responses may follow one triggering condition), so None Return is still offered once his is used.
  it("10062:A:2 None Return: offered after Legolas's Response to the same destruction", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: NONE_RETURN, seat: 0 }], engaged: [{ code: FRAIL, seat: 0 }] });
    const run = passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, FRAIL), attackerIds: [idsOf(tab, LEGOLAS)] }, tab.ctx), tab.ctx);
    expect(run.state.cards[idsOf(tab, FRAIL)]?.zone).toBe("encounterDiscard");
    expect(triggers(run.state, tab)).toEqual(["01005:response:1"]);
    // Legolas's Response first, in its own window; None Return is offered in the window after it.
    const used = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, LEGOLAS), effectId: "01005:response:1" }, tab.ctx);
    expect(triggers(used.state, tab)).toEqual(["10062:response:1"]);
    const card = idsOf(tab, NONE_RETURN);
    const done = sendUnledgered(used, { type: "Trigger", cardId: card, effectId: "10062:response:1", payments: [{ heroId: idsOf(tab, BERAVOR), amount: 1 }] }, tab.ctx);
    expect(done.state.cards[card]?.zone).toBe("victory");
    expect(done.state.cards[idsOf(tab, FRAIL)]?.zone).toBe("victory");
  });
});

describe("Hope Rekindled (10063:A:1, A:2)", () => {
  // Legolas (Tactics) pays; the hand holds Hope Rekindled, two Horn's Cry and Feint.
  const hope = (effects: readonly Effect[], threat: number, deck: Scene["playerDeck"] = []): Table => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: HOPE, seat: 0 }, { code: HORN, seat: 0 }, { code: HORN, seat: 0 }, { code: FEINT, seat: 0 }], playerDeck: deck });
    return { ...tab, state: withThreat(tab.state, 0, threat) };
  };

  // "Action: Reduce the cost of the next event that has a Valour trigger you play this phase by 2.": Horn's Cry (cost 2) then costs 0 and
  // is played for nothing; Feint (no Valour trigger) still costs 1, and the second Horn's Cry costs 2 again.
  lineSpec("10063:A:1", "Hope Rekindled: the next Valour event this phase costs 2 less", (effects) => {
    const tab = hope(effects, 8);
    const [first = "", second = ""] = tab.ids[HORN] ?? [];
    let run = playCode(tab, HOPE);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(playCost(run.state, first, 0, tab.ctx)).toBe(0);
    expect(playCost(run.state, idsOf(tab, FEINT), 0, tab.ctx)).toBe(1);
    run = play(run, tab, first);
    // Below threat 40 Horn's Cry resolves its Action with no question.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[first]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, LEGOLAS)]?.resources).toBe(6);
    expect(playCost(run.state, second, 0, tab.ctx)).toBe(2);
  });

  // "this phase": played in the planning phase and not used, the reduction is gone in the quest phase.
  it("10063:A:1 Hope Rekindled: the reduction ends with the phase", () => {
    const tab = hope(EFFECTS, 8);
    const run = playCode(tab, HOPE);
    expect(playCost(enter(run.state, tab, "questCommit").state, idsOf(tab, HORN), 0, tab.ctx)).toBe(2);
  });

  // "Valour Action: Search the top 10 cards of your deck for an event that has a Valour trigger and add it to your hand. Shuffle your
  // deck.": at threat 40 the player picks the Valour Action; Hold Your Ground! and Horn's Cry in the top 10 are offered, Fierce Defense
  // (eleventh) and Feint (no Valour trigger) are not. Hold Your Ground! goes to the hand and the deck is shuffled.
  lineSpec("10063:A:2", "Hope Rekindled: at threat 40, search the top 10 for a Valour event, add it to the hand, shuffle", (effects) => {
    const deck = [...fillers(CARD, 2), { code: HOLD, seat: 0 }, { code: FEINT, seat: 0 }, ...fillers(CARD, 4), { code: HORN, seat: 0 }, { code: CARD, seat: 0 }, { code: FIERCE, seat: 0 }, ...fillers(CARD, 2)];
    const tab = hope(effects, 40, deck);
    const hold = idsOf(tab, HOLD);
    const inDeck = (tab.ids[HORN] ?? []).find((id) => tab.state.cards[id]?.zone === "deck") ?? "";
    expect(tab.state.seats[0]?.deck.indexOf(inDeck)).toBe(8);
    expect(tab.state.seats[0]?.deck.indexOf(idsOf(tab, FIERCE))).toBe(10);
    const cursor = tab.state.seedCursor;
    let run = playCode(tab, HOPE);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab)).toEqual(["10063:action:1", "10063:action:2"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "10063:action:2" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([hold, inDeck].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: hold }, tab.ctx);
    expect(run.state.cards[hold]?.zone).toBe("hand");
    expect(run.state.cards[inDeck]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toHaveLength(deck.length - 1);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });

  // Below 40 the Valour Action cannot be picked: Hope Rekindled plays its Action at once.
  it("10063:A:2 Hope Rekindled: no Valour Action below threat 40", () => {
    const tab = hope(EFFECTS, 39, [{ code: HOLD, seat: 0 }, ...fillers(CARD, 3)]);
    const run = playCode(tab, HOPE);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, HOLD)]?.zone).toBe("deck");
  });
});

