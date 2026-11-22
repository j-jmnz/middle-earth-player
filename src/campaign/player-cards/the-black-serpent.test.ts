// Rules: rr.attachment-cards, rr.limits, rr.lasting-effects, rr.modifiers, rr.action, rr.response, rr.triggered-ability, rr.ready,
// rr.drawing-cards, rr.play-restrictions-and-permissions, rr.unique-cards, rr.traits, rr.cost (data/rules/entries.json).
// The Black Serpent player cards, written from their card text (data/cards/TBS.json; data/printed holds no ledger for this pack, so the
// lines are the text of data/cards and every intent goes through sendUnledgered): Song of Hope 17082:A:1 and A:2, Burst into Song
// 17083:A:1, Defender of Cair Andros 17084:A:1 and A:2, Oath of Eorl 17085:A:1, Fearless Scout 17086:A:1 and A:2, Dúnedain Pipe 17088:A:1
// and A:2, Old Toby 17089:A:1, Southron Refugee 17090:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withThreat } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { hasTrait } from "../../rules/interpret/conditions.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { playCost } from "../../rules/player/attach.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, combat, enter, fillers, hosts, passAll, play, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const SONG_OF_HOPE = "17082";
const BURST = "17083";
const DEFENDER = "17084";
const OATH = "17085";
const SCOUT = "17086";
const PIPE = "17088";
const TOBY = "17089";
const REFUGEE = "17090";
// Song of Kings: a Song attachment. Hobbit Pipe: another Pipe attachment.
const SONG_OF_KINGS = "02010";
const HOBBIT_PIPE = "141015";
// Heroes and allies with no text: a Leadership hero, a Tactics hero, a Lore Dúnedain hero, a Dúnedain ally; unique Rohan, Gondor and
// Rohan-and-Gondor characters; a Harad event.
const LEAD = "lead";
const TAC = "tac";
const SPI = "spi";
const DUN_HERO = "dun-hero";
const DUN_ALLY = "dun-ally";
const ROHAN = "rohan";
const GONDOR = "gondor";
const BOTH = "both";
const ROHAN_ALLY = "rohan-ally";
const HARAD_EVENT = "harad-event";
const ALLY = "ally";
const CARD = "card";
const WEAK = "weak";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);
const hero = (code: string, sphere: "leadership" | "tactics" | "lore" | "spirit", traits: string[] = [], isUnique = false) =>
  definePrinted({ code, name: code, type: "hero", sphere, threat: 8, willpower: 1, attack: 1, defense: 1, health: 5, traits, isUnique });

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([SONG_OF_HOPE, BURST, DEFENDER, OATH, SCOUT, PIPE, TOBY, REFUGEE, SONG_OF_KINGS, HOBBIT_PIPE]))]);
  for (const card of [hero(LEAD, "leadership"), hero(TAC, "tactics"), hero(SPI, "spirit"), hero(DUN_HERO, "lore", ["Dúnedain"]), hero(ROHAN, "tactics", ["Rohan"], true), hero(GONDOR, "tactics", ["Gondor"], true), hero(BOTH, "tactics", ["Rohan", "Gondor"], true)]) cards.set(card.code, card);
  cards.set(DUN_ALLY, definePrinted({ code: DUN_ALLY, name: "Dúnedain Ally", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dúnedain"] }));
  cards.set(ROHAN_ALLY, definePrinted({ code: ROHAN_ALLY, name: "Rohan Ally", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Rohan"] }));
  cards.set(HARAD_EVENT, definePrinted({ code: HARAD_EVENT, name: "Harad Event", type: "event", sphere: "neutral", cost: 1, traits: ["Harad"] }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

// The table at `threat` for the first seat, the constants brought up to date.
const atThreat = (tab: Table, threat: number): Table => ({ ...tab, state: syncConstants(withThreat(tab.state, 0, threat), tab.ctx) });

describe("Song of Hope (17082:A:1, A:2)", () => {
  // "Attach to a hero. Limit 1 per hero.": both heroes are offered and the ally is not; once the Leadership hero holds one, a second
  // copy is offered only the other hero.
  lineSpec("17082:A:1", "Song of Hope: Attach to a hero, one per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEAD, seat: 0 }, { code: TAC, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: SONG_OF_HOPE, seat: 0 }, { code: SONG_OF_HOPE, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[SONG_OF_HOPE] ?? [];
    expect(hosts(tab, first)).toEqual([idsOf(tab, LEAD), idsOf(tab, TAC)].sort());
    const run = play(begin(tab.state), tab, first, idsOf(tab, LEAD));
    expect(run.state.cards[first]?.host).toBe(idsOf(tab, LEAD));
    expect(hosts(tab, second, run.state)).toEqual([idsOf(tab, TAC)]);
  });

  // "Action: Spend 1 resource from attached hero's pool to give attached hero +1 Willpower until the end of the phase. (Limit 3 times per
  // phase.)": three uses give +3 and cost 3 of the host's resources; a fourth is not offered; in the quest phase the Willpower is printed again.
  lineSpec("17082:A:2", "Song of Hope: +1 Willpower for 1 resource, three times a phase, until the end of the phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEAD, seat: 0 }], attached: [{ code: SONG_OF_HOPE, host: LEAD }] });
    const [lead, song] = [idsOf(tab, LEAD), idsOf(tab, SONG_OF_HOPE)];
    let run = begin(tab.state);
    for (let use = 0; use < 3; use += 1) {
      expect(triggers(run.state, tab)).toContain("17082:action:1");
      run = sendUnledgered(run, { type: "Trigger", cardId: song, effectId: "17082:action:1", payments: [{ heroId: lead, amount: 1 }] }, tab.ctx);
    }
    expect(stat(run.state, tab, lead, "willpower")).toBe(1 + 3);
    expect(run.state.cards[lead]?.resources).toBe(6 - 3);
    expect(triggers(run.state, tab)).not.toContain("17082:action:1");
    expect(stat(enter(run.state, tab, "questCommit").state, tab, lead, "willpower")).toBe(1);
  });

  // The cost is paid from the attached hero's pool: a host with no resource cannot pay it, though another hero holds 6, and a payment
  // from the other hero is refused.
  it("17082:A:2 Song of Hope: paid only from the attached hero's pool", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEAD, seat: 0 }, { code: TAC, seat: 0 }], attached: [{ code: SONG_OF_HOPE, host: LEAD }] });
    expect(refusal(tab.state, { type: "Trigger", cardId: idsOf(tab, SONG_OF_HOPE), effectId: "17082:action:1", payments: [{ heroId: idsOf(tab, TAC), amount: 1 }] }, tab.ctx)).not.toBeNull();
    expect(triggers(updateCard(tab.state, idsOf(tab, LEAD), { resources: 0 }), tab)).not.toContain("17082:action:1");
  });
});

describe("Burst into Song (17083:A:1)", () => {
  // "Action: Ready each hero with a Song attachment.": the exhausted Leadership hero with Song of Kings and the other player's exhausted
  // hero with Song of Hope ready; the exhausted Tactics hero with no Song stays exhausted.
  it("17083:A:1 Burst into Song: readies each hero with a Song attachment, any player's", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: LEAD, seat: 0 }, { code: TAC, seat: 0 }, { code: DUN_HERO, seat: 1 }], attached: [{ code: SONG_OF_KINGS, host: LEAD }, { code: SONG_OF_HOPE, host: DUN_HERO }], hand: [{ code: BURST, seat: 0 }] });
    let state = tab.state;
    for (const code of [LEAD, TAC, DUN_HERO]) state = updateCard(state, idsOf(tab, code), { exhausted: true });
    const run = play(begin(state), tab, idsOf(tab, BURST));
    expect(run.state.cards[idsOf(tab, LEAD)]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, DUN_HERO)]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, TAC)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, BURST)]?.zone).toBe("discard");
  });

  // rr.triggered-ability: with every hero that holds a Song ready, the event could change nothing.
  // FAULT: the card readies only heroes with a Song attachment; with that hero ready, the engine still offers the event (only another hero is exhausted).
  it.fails("17083:A:1 Burst into Song: not played when no hero with a Song attachment is exhausted", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEAD, seat: 0 }, { code: TAC, seat: 0 }], attached: [{ code: SONG_OF_KINGS, host: LEAD }], hand: [{ code: BURST, seat: 0 }] });
    const state = updateCard(tab.state, idsOf(tab, TAC), { exhausted: true });
    expect(legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, BURST))).toBe(false);
  });
});

describe("Defender of Cair Andros (17084:A:1, A:2)", () => {
  // "Defender of Cair Andros gets +X Defense, where X is the tens digit of your threat. (Limit +4 Defense.)": printed 0; threat 8 gives
  // +0, 27 gives +2, 49 gives +4 and 52 (tens digit 5) is held to +4.
  lineSpec("17084:A:1", "Defender of Cair Andros: +Defense of the tens digit of your threat, at most +4", (effects) => {
    const tab = table(effects, { heroes: [{ code: TAC, seat: 0 }], allies: [{ code: DEFENDER, seat: 0 }] });
    const defender = idsOf(tab, DEFENDER);
    expect(stat(atThreat(tab, 8).state, tab, defender, "defense")).toBe(0);
    expect(stat(atThreat(tab, 27).state, tab, defender, "defense")).toBe(2);
    expect(stat(atThreat(tab, 49).state, tab, defender, "defense")).toBe(4);
    expect(stat(atThreat(tab, 52).state, tab, defender, "defense")).toBe(4);
  });

  // "your threat": the Defender of the second player (threat 6) reads that player's threat, not the first player's 35.
  it("17084:A:1 Defender of Cair Andros: reads its controller's threat", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: TAC, seat: 0 }, { code: LEAD, seat: 1 }], allies: [{ code: DEFENDER, seat: 1 }] });
    expect(stat(atThreat(tab, 35).state, tab, idsOf(tab, DEFENDER), "defense")).toBe(0);
  });

  // The Defender declared as the defender against the engaged enemy, at `threat`.
  function declared(effects: readonly Effect[], threat: number) {
    const tab = atThreat(table(effects, { heroes: [{ code: TAC, seat: 0 }], allies: [{ code: DEFENDER, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] }), threat);
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, DEFENDER) }, tab.ctx);
    return { tab, run };
  }

  // "Valour Response: After Defender of Cair Andros is declared as a defender, deal 1 damage to the attacking enemy.": at threat 40 the
  // Response is offered and the attacking enemy takes 1 damage.
  lineSpec("17084:A:2", "Defender of Cair Andros: at threat 40, after he is declared as a defender, 1 damage to the attacker", (effects) => {
    const { tab, run } = declared(effects, 40);
    expect(triggers(run.state, tab)).toContain("17084:response:1");
    const next = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, DEFENDER), effectId: "17084:response:1" }, tab.ctx);
    expect(next.state.cards[idsOf(tab, WEAK)]?.damage).toBe(1);
  });

  // Valour: below threat 40 the Response is not offered.
  it("17084:A:2 Defender of Cair Andros: no Response at threat 39", () => {
    const { tab, run } = declared(EFFECTS, 39);
    expect(triggers(run.state, tab)).not.toContain("17084:response:1");
  });
});

describe("Oath of Eorl (17085:A:1)", () => {
  // The combat phase begins with `heroes` in play and Oath of Eorl in hand: is it offered?
  function offered(effects: readonly Effect[], heroes: readonly string[], allies: readonly string[] = []): boolean {
    const tab = table(effects, { heroes: heroes.map((code) => ({ code, seat: 0 })), allies: allies.map((code) => ({ code, seat: 0 })), engaged: [{ code: WEAK, seat: 0 }], hand: [{ code: OATH, seat: 0 }] });
    const run = enter(tab.state, tab, "combatStart");
    return legalIntents(run.state, tab.ctx).some((intent) => (intent.type === "PlayCard" || intent.type === "Trigger") && "cardId" in intent && intent.cardId === idsOf(tab, OATH));
  }

  // "Play only if you control a unique character with the Rohan trait and another unique character with the Gondor trait.": a unique
  // Rohan hero and a unique Gondor hero may play it at the beginning of the combat phase; the Rohan hero alone may not.
  lineSpec("17085:A:1", "Oath of Eorl: played only with a unique Rohan character and another unique Gondor character", (effects) => {
    expect(offered(effects, [ROHAN, GONDOR])).toBe(true);
    expect(offered(effects, [ROHAN, TAC])).toBe(false);
  });

  // "another": one unique character with both traits is not two characters.
  it("17085:A:1 Oath of Eorl: one unique Rohan and Gondor character is not enough", () => {
    expect(offered(EFFECTS, [BOTH, TAC])).toBe(false);
  });

  // "unique": a non-unique Rohan ally does not count.
  it("17085:A:1 Oath of Eorl: a non-unique Rohan ally does not count", () => {
    expect(offered(EFFECTS, [GONDOR, TAC], [ROHAN_ALLY])).toBe(false);
  });
});

describe("Fearless Scout (17086:A:1, A:2)", () => {
  // "Attach to a hero. Limit 1 per hero. Attached hero gains the Scout trait.": both heroes are offered and the ally is not; the hero
  // it is played on is a Scout in the state that play returns; a second copy is offered only the other hero.
  lineSpec("17086:A:1", "Fearless Scout: Attach to a hero, one per hero, and the hero gains Scout", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPI, seat: 0 }, { code: TAC, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: SCOUT, seat: 0 }, { code: SCOUT, seat: 0 }], playerDeck: fillers(CARD, 3) });
    const [first = "", second = ""] = tab.ids[SCOUT] ?? [];
    expect(hosts(tab, first)).toEqual([idsOf(tab, SPI), idsOf(tab, TAC)].sort());
    expect(hasTrait(tab.state, idsOf(tab, TAC), "Scout", tab.ctx)).toBe(false);
    const run = play(begin(tab.state), tab, first, idsOf(tab, TAC));
    expect(run.state.cards[first]?.host).toBe(idsOf(tab, TAC));
    expect(hasTrait(run.state, idsOf(tab, TAC), "Scout", tab.ctx)).toBe(true);
    expect(hasTrait(run.state, idsOf(tab, SPI), "Scout", tab.ctx)).toBe(false);
    expect(hosts(tab, second, run.state)).toEqual([idsOf(tab, SPI)]);
  });

  // "Response: After you play Fearless Scout from your hand, draw a card.": the Response is offered after the play and draws 1.
  lineSpec("17086:A:2", "Fearless Scout: after it is played from the hand, draw a card", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPI, seat: 0 }, { code: TAC, seat: 0 }], hand: [{ code: SCOUT, seat: 0 }], playerDeck: fillers(CARD, 3) });
    let run = play(begin(tab.state), tab, idsOf(tab, SCOUT), idsOf(tab, TAC));
    const hand = run.state.seats[0]?.hand.length ?? 0;
    expect(triggers(run.state, tab)).toContain("17086:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, SCOUT), effectId: "17086:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(hand + 1);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });

  // rr.triggered-ability: a draw from an empty deck changes nothing.
  it("17086:A:2 Fearless Scout: no Response when the deck is empty", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SPI, seat: 0 }, { code: TAC, seat: 0 }], hand: [{ code: SCOUT, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, SCOUT), idsOf(tab, TAC));
    expect(triggers(run.state, tab)).not.toContain("17086:response:1");
  });
});

describe("Dúnedain Pipe (17088:A:1, A:2)", () => {
  // "Attach to a Dúnedain character. Limit 1 per character.": the Dúnedain hero and the Dúnedain ally are offered, the Leadership hero
  // is not; once the hero holds one, a second copy is offered only the ally.
  lineSpec("17088:A:1", "Dúnedain Pipe: Attach to a Dúnedain character, one per character", (effects) => {
    const tab = table(effects, { heroes: [{ code: DUN_HERO, seat: 0 }, { code: LEAD, seat: 0 }], allies: [{ code: DUN_ALLY, seat: 0 }], hand: [{ code: PIPE, seat: 0 }, { code: PIPE, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[PIPE] ?? [];
    expect(hosts(tab, first)).toEqual([idsOf(tab, DUN_HERO), idsOf(tab, DUN_ALLY)].sort());
    const run = play(begin(tab.state), tab, first, idsOf(tab, DUN_HERO));
    expect(run.state.cards[first]?.host).toBe(idsOf(tab, DUN_HERO));
    expect(hosts(tab, second, run.state)).toEqual([idsOf(tab, DUN_ALLY)]);
  });

  // "Action: Exhaust Dúnedain Pipe and place a card from your hand on the bottom of your deck to draw a card.": of the two cards in hand
  // the player picks the Harad event; it goes under the deck, the top card is drawn, and the Pipe is exhausted.
  lineSpec("17088:A:2", "Dúnedain Pipe: exhaust it and put a card from the hand under the deck to draw a card", (effects) => {
    const tab = table(effects, { heroes: [{ code: DUN_HERO, seat: 0 }], attached: [{ code: PIPE, host: DUN_HERO }], hand: [{ code: HARAD_EVENT, seat: 0 }, { code: ALLY, seat: 0 }], playerDeck: fillers(CARD, 3) });
    const [pipe, event] = [idsOf(tab, PIPE), idsOf(tab, HARAD_EVENT)];
    const top = tab.state.seats[0]?.deck[0] ?? "";
    expect(triggers(tab.state, tab)).toContain("17088:action:1");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: pipe, effectId: "17088:action:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([event, idsOf(tab, ALLY)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: event }, tab.ctx);
    expect(run.state.seats[0]?.deck.at(-1)).toBe(event);
    expect(run.state.cards[top]?.zone).toBe("hand");
    expect([...(run.state.seats[0]?.hand ?? [])].sort()).toEqual([idsOf(tab, ALLY), top].sort());
    expect(run.state.seats[0]?.deck).toHaveLength(3);
    expect(run.state.cards[pipe]?.exhausted).toBe(true);
  });

  // The cost "place a card from your hand" cannot be paid with an empty hand.
  it("17088:A:2 Dúnedain Pipe: not offered with an empty hand", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DUN_HERO, seat: 0 }], attached: [{ code: PIPE, host: DUN_HERO }], playerDeck: fillers(CARD, 3) });
    expect(triggers(tab.state, tab)).not.toContain("17088:action:1");
  });
});

describe("Old Toby (17089:A:1)", () => {
  // "Action: Draw 1 card for each Pipe you control. Heal 1 damage from each hero with a Pipe attachment.": the first player controls two
  // Pipes (on the Dúnedain hero, 2 damage, and on the Leadership hero, 1 damage): 2 cards are drawn. The other player's hero holds that
  // player's Pipe: it is not counted for the draw, but its hero is healed. The Tactics hero, with no Pipe, keeps its damage.
  it("17089:A:1 Old Toby: draws 1 for each Pipe you control and heals 1 from each hero with a Pipe", () => {
    const scene = table(EFFECTS, { seats: 2, heroes: [{ code: DUN_HERO, seat: 0 }, { code: LEAD, seat: 0 }, { code: TAC, seat: 0 }, { code: ROHAN, seat: 1 }], attached: [{ code: PIPE, host: DUN_HERO }, { code: HOBBIT_PIPE, host: LEAD }], allies: [{ code: HOBBIT_PIPE, seat: 1 }], hand: [{ code: TOBY, seat: 0 }], playerDeck: fillers(CARD, 4) });
    const [dun, lead, tac, rohan] = [idsOf(scene, DUN_HERO), idsOf(scene, LEAD), idsOf(scene, TAC), idsOf(scene, ROHAN)];
    // The other player's Pipe, put in play under that player's control, is attached to that player's hero.
    const tab = attach(scene, [[scene.ids[HOBBIT_PIPE]?.[1] ?? "", rohan]]);
    expect(tab.state.cards[scene.ids[HOBBIT_PIPE]?.[1] ?? ""]).toMatchObject({ host: rohan, controller: 1 });
    let state = tab.state;
    for (const [id, damage] of [[dun, 2], [lead, 1], [tac, 1], [rohan, 1]] as const) state = updateCard(state, id, { damage });
    const run = play(begin(state), tab, idsOf(tab, TOBY));
    expect(run.state.seats[0]?.hand).toHaveLength(2);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.state.cards[dun]?.damage).toBe(1);
    expect(run.state.cards[lead]?.damage).toBe(0);
    expect(run.state.cards[rohan]?.damage).toBe(0);
    expect(run.state.cards[tac]?.damage).toBe(1);
  });

  // rr.triggered-ability: with no Pipe in play it draws 0 cards and heals nothing, so it changes nothing.
  it("17089:A:1 Old Toby: not played when no Pipe is in play", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DUN_HERO, seat: 0 }], hand: [{ code: TOBY, seat: 0 }], playerDeck: fillers(CARD, 4) });
    const state = updateCard(tab.state, idsOf(tab, DUN_HERO), { damage: 1 });
    expect(legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, TOBY))).toBe(false);
  });
});

describe("Southron Refugee (17090:A:1)", () => {
  // The Refugee in play, two more Refugees (Harad allies, cost 2), the Harad event (cost 1) and a Leadership ally (cost 1) in hand.
  function refugee(effects: readonly Effect[]): Table {
    return table(effects, { heroes: [{ code: LEAD, seat: 0 }], allies: [{ code: REFUGEE, seat: 0 }], hand: [{ code: REFUGEE, seat: 0 }, { code: REFUGEE, seat: 0 }, { code: HARAD_EVENT, seat: 0 }, { code: ALLY, seat: 0 }] });
  }

  // "Action: Exhaust Southron Refugee to reduce the cost of the next Harad ally you play this phase by 1.": the Refugee exhausts; the
  // Harad ally in hand costs 1, the Harad event and the other ally keep their cost; once that ally is played, the next Harad ally costs 2.
  lineSpec("17090:A:1", "Southron Refugee: exhaust it, the next Harad ally you play this phase costs 1 less", (effects) => {
    const tab = refugee(effects);
    const [inPlay = "", inHand = "", third = ""] = tab.ids[REFUGEE] ?? [];
    expect(playCost(tab.state, inHand, 0, tab.ctx)).toBe(2);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: inPlay, effectId: "17090:action:1" }, tab.ctx);
    expect(run.state.cards[inPlay]?.exhausted).toBe(true);
    expect(playCost(run.state, inHand, 0, tab.ctx)).toBe(1);
    expect(playCost(run.state, idsOf(tab, HARAD_EVENT), 0, tab.ctx)).toBe(1);
    expect(playCost(run.state, idsOf(tab, ALLY), 0, tab.ctx)).toBe(1);
    run = play(run, tab, inHand);
    expect(run.state.cards[idsOf(tab, LEAD)]?.resources).toBe(6 - 1);
    expect(run.state.cards[inHand]?.zone).toBe("play");
    expect(playCost(run.state, third, 0, tab.ctx)).toBe(2);
  });

  // "this phase": the reduction is gone in the quest phase.
  it("17090:A:1 Southron Refugee: the reduction ends with the phase", () => {
    const tab = refugee(EFFECTS);
    const [inPlay = "", inHand = ""] = tab.ids[REFUGEE] ?? [];
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: inPlay, effectId: "17090:action:1" }, tab.ctx);
    expect(playCost(enter(run.state, tab, "questCommit").state, inHand, 0, tab.ctx)).toBe(2);
  });
});
