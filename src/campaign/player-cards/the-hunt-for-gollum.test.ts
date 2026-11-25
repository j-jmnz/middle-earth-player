// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.resource-match, rr.action, rr.response, rr.forced, rr.search, rr.ready,
// rr.step-1-3, rr.first-player, rr.triggered-ability (data/rules/entries.json).
// The Hunt for Gollum player cards, written from their card text (data/cards/HfG.json; data/printed holds no ledger for this pack, so
// the lines are the text of data/cards and every intent goes through sendUnledgered): Bilbo Baggins 02001:A:1, Dúnedain Mark 02002:A:1
// and A:2, Winged Guardian 02004:A:2 and A:3, The Eagles Are Coming! 02005:A:1, Westfold Horse-breaker 02006:A:1, Mustering the Rohirrim
// 02007:A:1, Rivendell Minstrel 02008:A:1, Song of Kings 02010:A:1 and A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf } from "../../../test/harness/scene.ts";
import { answerFirst, atDefense, choices, enter, fillers, hosts, passAll, play, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const BILBO = "02001";
const MARK = "02002";
const BRAND = "18001"; // a Dale hero: "After you play an attachment on a Dale character without an attachment, draw a card."
const GUARDIAN = "02004";
const EAGLES = "02005";
const HORSE_BREAKER = "02006";
const MUSTERING = "02007";
const MINSTREL = "02008";
const SONG_OF_KINGS = "02010";
// Landroval: another Eagle. Song of Hope: another Song.
const LANDROVAL = "02053";
const SONG_OF_HOPE = "17082";
// Heroes and cards with no text: Leadership, Tactics, Spirit and Lore heroes; a Rohan ally, a Rohan attachment; a restricted
// attachment and a plain one that attach to any character.
const LEAD = "lead";
const TAC = "tac";
const SPI = "spi";
const LORE = "lore";
const ROHAN_ALLY = "rohan-ally";
const ROHAN_RIDER = "rohan-rider";
const ROHAN_GEAR = "rohan-gear";
const HEAVY = "heavy";
const LIGHT = "light";
const ALLY = "ally";
const CARD = "card";
const WEAK = "weak";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);
const hero = (code: string, sphere: "leadership" | "tactics" | "lore" | "spirit") => definePrinted({ code, name: code, type: "hero", sphere, threat: 8, willpower: 1, attack: 1, defense: 1, health: 5 });

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([BILBO, MARK, GUARDIAN, EAGLES, HORSE_BREAKER, MUSTERING, MINSTREL, SONG_OF_KINGS, LANDROVAL, SONG_OF_HOPE, BRAND]))]);
  for (const card of [hero(LEAD, "leadership"), hero(TAC, "tactics"), hero(SPI, "spirit"), hero(LORE, "lore")]) cards.set(card.code, card);
  cards.set(ROHAN_ALLY, definePrinted({ code: ROHAN_ALLY, name: "Rohan Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Rohan"] }));
  cards.set(ROHAN_RIDER, definePrinted({ code: ROHAN_RIDER, name: "Rohan Rider", type: "ally", sphere: "tactics", cost: 2, willpower: 1, attack: 2, defense: 1, health: 2, traits: ["Rohan"] }));
  cards.set(ROHAN_GEAR, definePrinted({ code: ROHAN_GEAR, name: "Rohan Gear", type: "attachment", sphere: "spirit", cost: 1, traits: ["Rohan"] }));
  cards.set(HEAVY, definePrinted({ code: HEAVY, name: "Heavy", type: "attachment", sphere: "neutral", cost: 0, keywords: { restricted: true } }));
  cards.set(LIGHT, definePrinted({ code: LIGHT, name: "Light", type: "attachment", sphere: "neutral", cost: 0 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Bilbo Baggins (02001:A:1)", () => {
  // The resource phase's draw step with Bilbo controlled by `seat`, each player's deck 4 cards: the cards each seat draws.
  function draws(effects: readonly Effect[], seat: number, firstPlayer: number): number[] {
    const tab = table(effects, { seats: 2, heroes: [{ code: LEAD, seat: 0 }, { code: TAC, seat: 1 }, { code: BILBO, seat }], playerDeck: [...fillers(CARD, 4, 0), ...fillers(CARD, 4, 1)] });
    const run = enter({ ...tab.state, firstPlayer }, tab, "resourceGrant");
    return [0, 1].map((index) => run.state.seats[index]?.hand.length ?? 0);
  }

  // "The first player draws 1 additional card in the resource phase.": with Bilbo in play the first player draws 2 and the other 1.
  lineSpec("02001:A:1", "Bilbo Baggins: the first player draws 1 additional card in the resource phase", (effects) => {
    expect(draws(effects, 0, 0)).toEqual([2, 1]);
  });

  // "The first player": it is the first player who draws the extra card, also when Bilbo's controller is not the first player.
  it("02001:A:1 Bilbo Baggins: the first player draws the extra card when another player controls Bilbo", () => {
    expect(draws(EFFECTS, 1, 0)).toEqual([2, 1]);
    expect(draws(EFFECTS, 0, 1)).toEqual([1, 2]);
  });
});

describe("Dúnedain Mark (02002:A:1, A:2)", () => {
  // "Attach to a hero.": the two heroes are offered and the ally is not.
  lineSpec("02002:A:1", "Dúnedain Mark: Attach to a hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEAD, seat: 0 }, { code: TAC, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: MARK, seat: 0 }] });
    const mark = idsOf(tab, MARK);
    expect(hosts(tab, mark)).toEqual([idsOf(tab, LEAD), idsOf(tab, TAC)].sort());
    expect(play(begin(tab.state), tab, mark, idsOf(tab, TAC)).state.cards[mark]?.host).toBe(idsOf(tab, TAC));
  });

  // "Attached hero gains +1 Attack": the Tactics hero it is played on has Attack 2, the other hero keeps 1.
  lineSpec("02002:A:2", "Dúnedain Mark: the attached hero gains +1 Attack", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEAD, seat: 0 }, { code: TAC, seat: 0 }], hand: [{ code: MARK, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, MARK), idsOf(tab, TAC));
    expect(stat(run.state, tab, idsOf(tab, TAC), "attack")).toBe(1 + 1);
    expect(stat(run.state, tab, idsOf(tab, LEAD), "attack")).toBe(1);
  });
});

describe("Dúnedain Mark moved to another player's hero (02002:A:3)", () => {
  // "attach Dúnedain Mark to another hero.": the line names no player, so the other seat's hero is offered; the Mark then belongs to that player's play area (rr.attachment-cards, rr.ownership-and-control), still owned by the seat that brought it.
  lineSpec("02002:A:3", "Dúnedain Mark: the other player's hero takes control of the Mark it receives", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: LEAD, seat: 0 }, { code: TAC, seat: 1 }], attached: [{ code: MARK, host: LEAD }] });
    const mark = idsOf(tab, MARK);
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: mark, effectId: "02002:action:1", payments: [{ heroId: idsOf(tab, LEAD), amount: 1 }] }, tab.ctx);
    expect(run.state.cards[mark]).toMatchObject({ host: idsOf(tab, TAC), controller: 1 });
  });

  // Brand's "After you play an attachment on a Dale character without an attachment": the Mark's move onto Brand is no play, so Brand's Response is not offered (rr.play-and-put-into-play).
  it("02002:A:3 Dúnedain Mark moved onto a Dale hero is not played: Brand's 18001:A:2 is not offered", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: LEAD, seat: 0 }, { code: BRAND, seat: 1 }], attached: [{ code: MARK, host: LEAD }], playerDeck: [{ code: CARD, seat: 1 }] });
    const mark = idsOf(tab, MARK);
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: mark, effectId: "02002:action:1", payments: [{ heroId: idsOf(tab, LEAD), amount: 1 }] }, tab.ctx);
    expect(run.state.cards[mark]).toMatchObject({ host: idsOf(tab, BRAND), controller: 1 });
    expect(legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "18001:response:1")).toBe(false);
  });
});

describe("Winged Guardian (02004:A:2, A:3)", () => {
  // "Winged Guardian cannot have restricted attachments.": a restricted attachment that attaches to any character is offered the hero
  // and the other ally, not the Guardian; an attachment that is not restricted is offered the Guardian too.
  lineSpec("02004:A:2", "Winged Guardian: cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: TAC, seat: 0 }], allies: [{ code: GUARDIAN, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: HEAVY, seat: 0 }, { code: LIGHT, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, HEAVY))).toEqual([idsOf(tab, TAC), idsOf(tab, ALLY)].sort());
    expect(hosts(tab, idsOf(tab, LIGHT))).toContain(idsOf(tab, GUARDIAN));
  });

  // The Guardian defends the engaged enemy's attack, with `resources` on the Tactics hero and 6 on the Leadership hero.
  function defended(effects: readonly Effect[], resources: number) {
    const tab = table(effects, { heroes: [{ code: TAC, seat: 0 }, { code: LEAD, seat: 0 }], allies: [{ code: GUARDIAN, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    const state = updateCard(tab.state, idsOf(tab, TAC), { resources });
    let run = atDefense(tab, state);
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, GUARDIAN) }, tab.ctx);
    run = passAll(run, tab.ctx, { responses: true });
    return { tab, run };
  }

  // "Forced: After an attack in which Winged Guardian defends resolves, pay 1 Tactics resource or discard Winged Guardian from play.": the
  // attack resolves (the Guardian survives it) and the player is asked; paying takes 1 from the Tactics hero and the Guardian stays.
  lineSpec("02004:A:3", "Winged Guardian: after it defends, pay 1 Tactics resource to keep it", (effects) => {
    const { tab, run } = defended(effects, 2);
    expect(choices(run.state, tab)).toEqual(expect.arrayContaining(["pay", "discard"]));
    const next = sendUnledgered(run, { type: "Choose", optionId: "pay" }, tab.ctx);
    expect(next.state.cards[idsOf(tab, TAC)]?.resources).toBe(2 - 1);
    expect(next.state.cards[idsOf(tab, LEAD)]?.resources).toBe(6);
    expect(next.state.cards[idsOf(tab, GUARDIAN)]?.zone).toBe("play");
  });

  // The other choice: the Guardian is discarded, no resource is paid.
  it("02004:A:3 Winged Guardian: after it defends, the player may discard it instead", () => {
    const { tab, run } = defended(EFFECTS, 2);
    const next = sendUnledgered(run, { type: "Choose", optionId: "discard" }, tab.ctx);
    expect(next.state.cards[idsOf(tab, GUARDIAN)]?.zone).toBe("discard");
    expect(next.state.cards[idsOf(tab, TAC)]?.resources).toBe(2);
  });

  // With no Tactics resource (the Leadership hero's 6 cannot pay it) the Guardian is discarded.
  it("02004:A:3 Winged Guardian: discarded when no Tactics resource can pay", () => {
    const { tab, run } = defended(EFFECTS, 0);
    // The one option left is taken without a question.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, GUARDIAN)]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, LEAD)]?.resources).toBe(6);
  });
});

describe("The Eagles Are Coming! (02005:A:1)", () => {
  // The deck: the Guardian, two fillers, Landroval, a filler (the top 5), then a second Guardian (sixth) and a filler.
  function eagles(effects: readonly Effect[]) {
    const tab = table(effects, { heroes: [{ code: TAC, seat: 0 }], hand: [{ code: EAGLES, seat: 0 }], playerDeck: [{ code: GUARDIAN, seat: 0 }, ...fillers(CARD, 2), { code: LANDROVAL, seat: 0 }, ...fillers(CARD, 1), { code: GUARDIAN, seat: 0 }, ...fillers(CARD, 1)] });
    const [near = "", far = ""] = tab.ids[GUARDIAN] ?? [];
    return { tab, near, far, landroval: idsOf(tab, LANDROVAL) };
  }

  // "Action: Search the top 5 cards of your deck for any number of Eagle cards and add them to your hand. Shuffle the other cards back
  // into your deck.": both Eagles of the top 5 go to the hand, the sixth card (an Eagle) stays in the deck, and the deck is shuffled.
  it("02005:A:1 The Eagles Are Coming!: the Eagles of the top 5 go to the hand, the rest is shuffled", () => {
    const { tab, near, far, landroval } = eagles(EFFECTS);
    const rest = (tab.state.seats[0]?.deck ?? []).filter((id) => id !== near && id !== landroval);
    const run = answerFirst(play(begin(tab.state), tab, idsOf(tab, EAGLES)), tab);
    expect(run.state.cards[near]?.zone).toBe("hand");
    expect(run.state.cards[landroval]?.zone).toBe("hand");
    expect(run.state.cards[far]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toHaveLength(rest.length);
    expect(run.state.seats[0]?.deck).not.toEqual(rest);
  });

  // "any number": the player picks which Eagles to take; with two found the game asks.
  lineSpec("02005:A:1", "The Eagles Are Coming!: the player chooses how many of the Eagles to take", (effects) => {
    const { tab } = eagles(effects);
    const run = play(begin(tab.state), tab, idsOf(tab, EAGLES));
    expect(run.state.window?.kind).toBe("choose");
  });
});

describe("Westfold Horse-breaker (02006:A:1)", () => {
  // "Action: Discard Westfold Horse-breaker to choose and ready a hero.": the other player's exhausted hero is chosen (the exhausted
  // Spirit hero is offered too) and readies; the Horse-breaker is in its owner's discard pile.
  it("02006:A:1 Westfold Horse-breaker: discard it to ready a hero, any player's", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: SPI, seat: 0 }, { code: TAC, seat: 1 }], allies: [{ code: HORSE_BREAKER, seat: 0 }] });
    const [spi, tac, breaker] = [idsOf(tab, SPI), idsOf(tab, TAC), idsOf(tab, HORSE_BREAKER)];
    const state = updateCard(updateCard(tab.state, spi, { exhausted: true }), tac, { exhausted: true });
    expect(triggers(state, tab)).toContain("02006:action:1");
    let run = sendUnledgered(begin(state), { type: "Trigger", cardId: breaker, effectId: "02006:action:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([spi, tac].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: tac }, tab.ctx);
    expect(run.state.cards[tac]?.exhausted).toBe(false);
    expect(run.state.cards[spi]?.exhausted).toBe(true);
    expect(run.state.cards[breaker]?.zone).toBe("discard");
    expect(run.state.seats[0]?.discard).toContain(breaker);
  });

  // rr.triggered-ability: with every hero ready, nothing can be readied, and the Horse-breaker is not discarded for nothing.
  it("02006:A:1 Westfold Horse-breaker: not offered when every hero is ready", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SPI, seat: 0 }], allies: [{ code: HORSE_BREAKER, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("02006:action:1");
  });
});

describe("Mustering the Rohirrim (02007:A:1)", () => {
  // "Action: Search the top 10 cards of your deck for any 1 Rohan ally card and add it to your hand. Then, shuffle the other cards back
  // into your deck.": the top 10 hold two Rohan allies (different cards) and a Rohan attachment, the eleventh card is a Rohan ally. The two
  // in the top 10 are offered; the second is taken; the rest of the deck is shuffled.
  it("02007:A:1 Mustering the Rohirrim: one Rohan ally of the top 10 to the hand, then shuffle", () => {
    const deck = [{ code: ROHAN_ALLY, seat: 0 }, { code: ROHAN_GEAR, seat: 0 }, ...fillers(CARD, 3), { code: ROHAN_RIDER, seat: 0 }, ...fillers(CARD, 4), { code: ROHAN_ALLY, seat: 0 }, ...fillers(CARD, 2)];
    const tab = table(EFFECTS, { heroes: [{ code: SPI, seat: 0 }], hand: [{ code: MUSTERING, seat: 0 }], playerDeck: deck });
    const [first = "", eleventh = ""] = tab.ids[ROHAN_ALLY] ?? [];
    const second = idsOf(tab, ROHAN_RIDER);
    const rest = (tab.state.seats[0]?.deck ?? []).filter((id) => id !== second);
    let run = play(begin(tab.state), tab, idsOf(tab, MUSTERING));
    expect(choices(run.state, tab).sort()).toEqual([first, second].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: second }, tab.ctx);
    expect(run.state.cards[second]?.zone).toBe("hand");
    expect(run.state.cards[first]?.zone).toBe("deck");
    expect(run.state.cards[eleventh]?.zone).toBe("deck");
    expect(run.state.cards[idsOf(tab, ROHAN_GEAR)]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toHaveLength(rest.length);
    expect(run.state.seats[0]?.deck).not.toEqual(rest);
  });
});

describe("Rivendell Minstrel (02008:A:1)", () => {
  // "Response: After you play Rivendell Minstrel from your hand, search your deck for 1 Song card and add it to your hand. Shuffle your
  // deck.": the deck holds Song of Kings and Song of Hope (the last card) among fillers: both are offered, Song of Hope is taken, the deck
  // is shuffled.
  it("02008:A:1 Rivendell Minstrel: after it is played, a Song from the deck to the hand, then shuffle", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LORE, seat: 0 }], hand: [{ code: MINSTREL, seat: 0 }], playerDeck: [...fillers(CARD, 2), { code: SONG_OF_KINGS, seat: 0 }, ...fillers(CARD, 4), { code: SONG_OF_HOPE, seat: 0 }] });
    const [kings, hope, minstrel] = [idsOf(tab, SONG_OF_KINGS), idsOf(tab, SONG_OF_HOPE), idsOf(tab, MINSTREL)];
    const rest = (tab.state.seats[0]?.deck ?? []).filter((id) => id !== hope);
    let run = play(begin(tab.state), tab, minstrel);
    expect(triggers(run.state, tab)).toContain("02008:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: minstrel, effectId: "02008:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([kings, hope].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: hope }, tab.ctx);
    expect(run.state.cards[hope]?.zone).toBe("hand");
    expect(run.state.cards[kings]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).not.toEqual(rest);
  });
});

describe("Song of Kings (02010:A:1, A:2)", () => {
  // "Attach to a hero.": the two heroes are offered and the ally is not.
  lineSpec("02010:A:1", "Song of Kings: Attach to a hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEAD, seat: 0 }, { code: TAC, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: SONG_OF_KINGS, seat: 0 }] });
    const song = idsOf(tab, SONG_OF_KINGS);
    expect(hosts(tab, song)).toEqual([idsOf(tab, LEAD), idsOf(tab, TAC)].sort());
    expect(play(begin(tab.state), tab, song, idsOf(tab, TAC)).state.cards[song]?.host).toBe(idsOf(tab, TAC));
  });

  // "Attached hero gains a Leadership resource icon.": the Tactics hero cannot pay for the Leadership ally; once Song of Kings is played on
  // him, he pays for it alone.
  lineSpec("02010:A:2", "Song of Kings: the attached hero gains a Leadership resource icon", (effects) => {
    const tab = table(effects, { heroes: [{ code: TAC, seat: 0 }], hand: [{ code: SONG_OF_KINGS, seat: 0 }, { code: ALLY, seat: 0 }] });
    const [tac, ally] = [idsOf(tab, TAC), idsOf(tab, ALLY)];
    const intent = { type: "PlayCard" as const, cardId: ally, payments: [{ heroId: tac, amount: 1 }] };
    expect(refusal(tab.state, intent, tab.ctx)).not.toBeNull();
    let run = play(begin(tab.state), tab, idsOf(tab, SONG_OF_KINGS), tac);
    run = sendUnledgered(run, intent, tab.ctx);
    expect(run.state.cards[ally]?.zone).toBe("play");
    expect(run.state.cards[tac]?.resources).toBe(6 - 1 - 1);
  });
});
