// Rules: rr.attachment-cards, rr.limits, rr.response, rr.explored, rr.ready, rr.action, rr.cost, rr.engaged, rr.ranged, rr.hit-points,
// rr.sentinel, rr.engagement-check, rr.then, rr.event-cards, rr.triggered-ability, rr.play-and-put-into-play (data/rules/entries.json).
// The Three Trials player cards, written from their card text (data/cards/TTT.json; data/printed holds no ledger for this pack, so every
// intent goes through sendUnledgered): Idraen 08025:A:1, Feigned Voices 08027:A:1, Rúmil 08028:A:2, Elven Mail 08029:A:2 and A:3,
// Warden of Arnor 08031:A:1, Message from Elrond 08032:A:1, Noiseless Movement 08033:A:1, Leaf Brooch 08034:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withThreat } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, endRound, enter, fillers, hosts, passAll, play, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const IDRAEN = "08025";
const FEIGNED = "08027";
const RUMIL = "08028";
const MAIL = "08029";
const WARDEN = "08031";
const ELROND = "08032";
const NOISELESS = "08033";
const BROOCH = "08034";
// Core Aragorn (Leadership, Dúnedain, sentinel), Legolas (Tactics, Silvan, ranged), Éowyn (Spirit, Rohan), Beravor (Lore); Erestor (Lore,
// Noldor, who discards his hand at the end of the round).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
const ERESTOR = "10084";
const ALLY = "ally";
const PAL = "pal";
const CARD = "card";
// A location of 1 quest point the quest explores, and one of 9 it does not.
const SMALL = "small";
const LOC = "loc";
// An enemy no damage of these tests destroys.
const WALL = "wall";
const CHEAP = "cheap";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([IDRAEN, FEIGNED, RUMIL, MAIL, WARDEN, ELROND, NOISELESS, BROOCH, ARAGORN, LEGOLAS, EOWYN, BERAVOR, ERESTOR]))]);
  cards.set(SMALL, definePrinted({ code: SMALL, name: "Small", type: "location", threat: 0, questPoints: 1 }));
  cards.set(LOC, definePrinted({ code: LOC, name: "Loc", type: "location", threat: 0, questPoints: 9 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 2, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Warden of Arnor (08031:A:1)", () => {
  // "Attach to a Scout hero.": Idraen (a Scout hero) is offered; Éowyn (not a Scout) and Rúmil (a Scout ally) are not.
  lineSpec("08031:A:1", "Warden of Arnor: Attach to a Scout hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: IDRAEN, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: RUMIL, seat: 0 }], hand: [{ code: WARDEN, seat: 0 }] });
    const warden = idsOf(tab, WARDEN);
    expect(hosts(tab, warden)).toEqual([idsOf(tab, IDRAEN)]);
    expect(play(begin(tab.state), tab, warden, idsOf(tab, IDRAEN)).state.cards[warden]?.host).toBe(idsOf(tab, IDRAEN));
  });
});

describe("Leaf Brooch (08034:A:1)", () => {
  // "Attach to a hero. Limit 1 per hero.": both heroes are offered and the ally is not; once a Brooch is on Aragorn, the second copy is
  // offered only Éowyn.
  lineSpec("08034:A:1", "Leaf Brooch: Attach to a hero, limit 1 per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: fillers(BROOCH, 2) });
    const [first = "", second = ""] = tab.ids[BROOCH] ?? [];
    const [aragorn, eowyn] = [idsOf(tab, ARAGORN), idsOf(tab, EOWYN)];
    expect(hosts(tab, first)).toEqual([aragorn, eowyn].sort());
    const run = play(begin(tab.state), tab, first, aragorn);
    expect(run.state.cards[first]?.host).toBe(aragorn);
    expect(hosts(tab, second, run.state)).toEqual([eowyn]);
  });
});

describe("Idraen (08025:A:1)", () => {
  // Idraen quests (and is exhausted) with the active location of 1 quest point (`small`) or of 9 (`loc`).
  function quested(effects: readonly Effect[], active: string) {
    const tab = table(effects, { start: "quest", heroes: [{ code: IDRAEN, seat: 0 }, { code: ARAGORN, seat: 0 }], active, deck: ["f0", "f0"] });
    const committed = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, IDRAEN)] }, tab.ctx);
    const run = passAll(sendUnledgered(committed, { type: "Pass" }, tab.ctx), tab.ctx);
    return { tab, run, idraen: idsOf(tab, IDRAEN), location: idsOf(tab, active) };
  }

  // "Response: After a location is explored, ready Idraen.": the quest explores the active location, and Idraen, exhausted by questing,
  // is readied.
  lineSpec("08025:A:1", "Idraen: after a location is explored, ready her", (effects) => {
    const { tab, run: quest, idraen, location } = quested(effects, SMALL);
    expect(quest.state.cards[location]?.zone).toBe("encounterDiscard");
    expect(quest.state.cards[idraen]?.exhausted).toBe(true);
    expect(triggers(quest.state, tab)).toContain("08025:response:1");
    const run = sendUnledgered(quest, { type: "Trigger", cardId: idraen, effectId: "08025:response:1" }, tab.ctx);
    expect(run.state.cards[idraen]?.exhausted).toBe(false);
  });

  // The location is not explored (2 progress of 9): no Response.
  it("08025:A:1 Idraen: not offered while no location is explored", () => {
    const { tab, run, location } = quested(EFFECTS, LOC);
    expect(run.state.cards[location]?.zone).toBe("activeLocation");
    expect(triggers(run.state, tab)).not.toContain("08025:response:1");
  });

  // Éowyn quests and Idraen stays ready: the location is explored, but readying a ready Idraen changes nothing, so it is not offered.
  it("08025:A:1 Idraen: not offered while she is ready", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: IDRAEN, seat: 0 }, { code: EOWYN, seat: 0 }], active: SMALL, deck: ["f0", "f0"] });
    const committed = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, EOWYN)] }, tab.ctx);
    const run = passAll(sendUnledgered(committed, { type: "Pass" }, tab.ctx), tab.ctx);
    expect(run.state.cards[idsOf(tab, SMALL)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[idsOf(tab, IDRAEN)]?.exhausted).toBe(false);
    expect(triggers(run.state, tab)).not.toContain("08025:response:1");
  });
});

describe("Feigned Voices (08027:A:1)", () => {
  // Aragorn (Leadership) pays; Rúmil (a Silvan ally) and a plain ally are in play, Legolas is a Silvan hero; the Wall and the Cheap enemy
  // are engaged with the player.
  function voices(effects: readonly Effect[]) {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: RUMIL, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: FEIGNED, seat: 0 }], engaged: [{ code: WALL, seat: 0 }, { code: CHEAP, seat: 0 }] });
    return { tab, rumil: idsOf(tab, RUMIL), wall: idsOf(tab, WALL), cheap: idsOf(tab, CHEAP), card: idsOf(tab, FEIGNED) };
  }

  // "Combat Action: Return a Silvan ally you control to your hand to choose an enemy engaged with a player. That enemy cannot attack that
  // player this phase.": Rúmil is the only Silvan ally (Legolas is a hero, the plain ally is not Silvan), so he goes back to the hand at
  // once; the Wall is chosen and then makes no attack in the combat phase, while the Cheap enemy still attacks.
  lineSpec("08027:A:1", "Feigned Voices: return a Silvan ally to choose an engaged enemy that cannot attack this phase", (effects) => {
    const { tab, rumil, wall, cheap, card } = voices(effects);
    let run = combat(tab.state, tab);
    run = play(run, tab, card);
    expect(run.state.cards[rumil]?.zone).toBe("hand");
    expect(run.state.cards[idsOf(tab, ALLY)]?.zone).toBe("play");
    expect(choices(run.state, tab).sort()).toEqual([cheap, wall].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: wall }, tab.ctx);
    const before = run.steps.length;
    run = passAll(run, tab.ctx);
    // Only the Cheap enemy attacks: the game asks for a defender against it, not against the Wall.
    expect(run.state.window).toMatchObject({ kind: "defense", enemyId: cheap });
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, ARAGORN) }, tab.ctx), tab.ctx);
    const attackers = run.steps.slice(before).flatMap((step) => (step.kind === "strike" && step.side === "enemy" ? [step.enemyId] : []));
    expect(attackers).toEqual([cheap]);
    expect(run.state.window).not.toMatchObject({ kind: "defense" });
  });

  // "Combat Action": in the planning phase the event is not played.
  it("08027:A:1 Feigned Voices: not played outside the combat phase", () => {
    const { tab, card } = voices(EFFECTS);
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === card)).toBe(false);
  });

  // No Silvan ally (only the plain ally and the Silvan hero Legolas): the cost cannot be paid, so the event is not played.
  it("08027:A:1 Feigned Voices: not played without a Silvan ally you control", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: FEIGNED, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const run = combat(tab.state, tab);
    expect(legalIntents(run.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, FEIGNED))).toBe(false);
  });

  // No enemy engaged with a player (the Wall is in the staging area): the effect cannot choose one, so the event is not played and
  // Rúmil is not returned for nothing.
  it("08027:A:1 Feigned Voices: not played with no enemy engaged with a player", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: RUMIL, seat: 0 }], hand: [{ code: FEIGNED, seat: 0 }], staging: [WALL] });
    const run = combat(tab.state, tab);
    expect(legalIntents(run.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, FEIGNED))).toBe(false);
  });
});

describe("Rúmil (08028:A:2)", () => {
  // Two players: Legolas (ranged) pays for Rúmil; the other player has Legolas too (a ranged character he controls). The Wall is engaged
  // with the other player, the Cheap enemy with the first, and a third enemy waits in the staging area.
  function rumil(effects: readonly Effect[]) {
    const tab = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: LEGOLAS, seat: 1 }], hand: [{ code: RUMIL, seat: 0 }], engaged: [{ code: WALL, seat: 1 }, { code: CHEAP, seat: 0 }], staging: [WALL] });
    const [staged = "", engaged = ""] = tab.ids[WALL] ?? [];
    return { tab, engaged, staged, cheap: idsOf(tab, CHEAP), card: idsOf(tab, RUMIL) };
  }

  // "Response: After you play Rúmil from your hand, choose an enemy engaged with a player. Deal X damage to that enemy where X is the
  // number of ranged characters you control.": the enemies engaged with either player are offered, the one in the staging area is not;
  // the Wall engaged with the other player takes 2 (Legolas and Rúmil himself; Aragorn is not ranged, and the other player's Legolas is
  // not counted).
  lineSpec("08028:A:2", "Rúmil: after he is played, X damage to an engaged enemy, X the ranged characters you control", (effects) => {
    const { tab, engaged, staged, cheap, card } = rumil(effects);
    let run = play(begin(tab.state), tab, card);
    expect(triggers(run.state, tab)).toContain("08028:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: card, effectId: "08028:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([cheap, engaged].sort());
    expect(choices(run.state, tab)).not.toContain(staged);
    run = sendUnledgered(run, { type: "Choose", optionId: engaged }, tab.ctx);
    expect(run.state.cards[engaged]?.damage).toBe(2);
    expect(run.state.cards[staged]?.damage ?? 0).toBe(0);
  });

  // Only an enemy in the staging area: no enemy engaged with a player to choose, so the Response is not offered.
  it("08028:A:2 Rúmil: not offered with no enemy engaged with a player", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: RUMIL, seat: 0 }], staging: [WALL] });
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, RUMIL)).state, tab)).not.toContain("08028:response:1");
  });
});

describe("Elven Mail (08029:A:2, A:3)", () => {
  // "Attach to a Noldor or Silvan character.": Legolas (Silvan hero), Erestor (Noldor hero) and Rúmil (Silvan ally) are offered; Aragorn
  // and the plain ally are not. Legolas (Tactics) pays.
  it("08029:A:2 Elven Mail: Attach to a Noldor or Silvan character", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: ERESTOR, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: RUMIL, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: MAIL, seat: 0 }] });
    const mail = idsOf(tab, MAIL);
    expect(hosts(tab, mail)).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, ERESTOR), idsOf(tab, RUMIL)].sort());
    expect(play(begin(tab.state), tab, mail, idsOf(tab, RUMIL)).state.cards[mail]?.host).toBe(idsOf(tab, RUMIL));
  });

  // "Attached character gets +2 hit points and gains sentinel.": two players; the Mail is played on Legolas (no sentinel of his own), who
  // then has 2 more hit points and may defend the attack of the enemy engaged with the other player.
  lineSpec("08029:A:3", "Elven Mail: +2 hit points and sentinel", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: MAIL, seat: 0 }], engaged: [{ code: WALL, seat: 1 }] });
    const legolas = idsOf(tab, LEGOLAS);
    const health = tab.ctx.cards.get(LEGOLAS)?.health ?? 0;
    let run = play(begin(tab.state), tab, idsOf(tab, MAIL), legolas);
    expect(stat(run.state, tab, legolas, "hitPoints")).toBe(health + 2);
    run = passAll(combat(run.state, tab), tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 1 });
    run = sendUnledgered({ ...run, state: { ...run.state, activeSeat: 1 } }, { type: "DeclareDefender", defenderId: legolas }, tab.ctx);
    expect(run.state.cards[legolas]?.exhausted).toBe(true);
  });
});

describe("Noiseless Movement (08033:A:1)", () => {
  // Beravor (Lore) pays; the Cheap enemy (engagement cost 2) and a Wall are in the staging area, a second Wall is engaged with the player.
  function noiseless(effects: readonly Effect[], threat = 8, copies = 1) {
    const scene = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], hand: fillers(NOISELESS, copies), staging: [CHEAP, WALL], engaged: [{ code: WALL, seat: 0 }] });
    const tab = { ...scene, state: withThreat(scene.state, 0, threat) };
    const [staged = "", engaged = ""] = tab.ids[WALL] ?? [];
    return { tab, cheap: idsOf(tab, CHEAP), staged, engaged, cards: tab.ids[NOISELESS] ?? [] };
  }
  const cast = (tab: Table, card: string, enemy: string, run = begin(tab.state)) => sendUnledgered(play(run, tab, card), { type: "Choose", optionId: enemy }, tab.ctx);

  // "Action: Choose an enemy in the staging area. That enemy does not make engagement checks this round. Then, if your threat is 20 or
  // less and this is the first time you played a copy of Noiseless Movement this round, return this card to your hand instead of
  // discarding it.": the enemies in the staging area are offered, the engaged one is not; the Cheap enemy chosen stays in the staging
  // area through the engagement checks (threat 8, its engagement cost 2), and the card goes back to the hand (threat 8, the first copy).
  lineSpec("08033:A:1", "Noiseless Movement: the chosen enemy makes no engagement check this round, the card returns to the hand", (effects) => {
    const { tab, cheap, staged, engaged, cards: [card = ""] } = noiseless(effects);
    let run = play(begin(tab.state), tab, card);
    expect(choices(run.state, tab).sort()).toEqual([cheap, staged].sort());
    expect(choices(run.state, tab)).not.toContain(engaged);
    run = sendUnledgered(run, { type: "Choose", optionId: cheap }, tab.ctx);
    expect(run.state.cards[card]?.zone).toBe("hand");
    const checked = passAll(enter(run.state, tab, "engagement"), tab.ctx, { engage: true });
    expect(checked.state.cards[cheap]?.zone).toBe("staging");
  });

  // Without the card the Cheap enemy engages the player in the same check.
  it("08033:A:1 Noiseless Movement: an enemy not chosen engages at the engagement check", () => {
    const { tab, cheap } = noiseless(EFFECTS);
    expect(passAll(enter(tab.state, tab, "engagement"), tab.ctx, { engage: true }).state.cards[cheap]?.zone).toBe("engaged");
  });

  // "this round": in the next round's engagement checks the Cheap enemy engages again.
  it("08033:A:1 Noiseless Movement: the enemy makes engagement checks again the next round", () => {
    const { tab, cheap, cards: [card = ""] } = noiseless(EFFECTS);
    const run = endRound(cast(tab, card, cheap).state, tab);
    expect(passAll(enter(run.state, tab, "engagement"), tab.ctx, { engage: true }).state.cards[cheap]?.zone).toBe("engaged");
  });

  // "if your threat is 20 or less": at threat 21 the card is discarded.
  it("08033:A:1 Noiseless Movement: discarded at threat 21", () => {
    const { tab, cheap, cards: [card = ""] } = noiseless(EFFECTS, 21);
    expect(cast(tab, card, cheap).state.cards[card]?.zone).toBe("discard");
  });

  // At threat 20 the card returns.
  it("08033:A:1 Noiseless Movement: returns to the hand at threat 20", () => {
    const { tab, cheap, cards: [card = ""] } = noiseless(EFFECTS, 20);
    expect(cast(tab, card, cheap).state.cards[card]?.zone).toBe("hand");
  });

  // "the first time you played a copy ... this round": the copy played second in the round is discarded, even after the first returned.
  it("08033:A:1 Noiseless Movement: the second copy played in a round is discarded", () => {
    const { tab, cheap, staged, cards: [first = "", second = ""] } = noiseless(EFFECTS, 8, 2);
    const run = cast(tab, first, cheap);
    expect(run.state.cards[first]?.zone).toBe("hand");
    const again = cast(tab, second, staged, run);
    expect(again.state.cards[second]?.zone).toBe("discard");
  });
});

describe("Message from Elrond (08032:A:1)", () => {
  // Two players: the first plays the card (Beravor pays). Each has two cards in hand and a deck of three.
  function elrond(effects: readonly Effect[]) {
    const tab = table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: ELROND, seat: 0 }, { code: ALLY, seat: 0 }, { code: CARD, seat: 1 }, { code: ALLY, seat: 1 }], playerDeck: [...fillers(CARD, 3, 0), ...fillers(CARD, 3, 1)] });
    const given = tab.ids[CARD]?.[0] ?? "";
    return { tab, given, card: idsOf(tab, ELROND) };
  }

  // "Action: Choose a player. That player may choose 1 card from his hand and add it to another player's hand. At the end of the round,
  // if the chosen card is in that player's hand or in play, shuffle it into its owner's deck.": the first player chooses the second, who
  // adds a card of his hand to the first player's hand; at the end of the round the card is shuffled into the second player's deck.
  it("08032:A:1 Message from Elrond: the chosen player gives a card to another player, shuffled into its owner's deck at the end of the round", () => {
    const { tab, given, card } = elrond(EFFECTS);
    let run = play(begin(tab.state), tab, card);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab)).toContain("seat:1");
    run = sendUnledgered(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    expect(choices(run.state, tab)).toContain(given);
    run = sendUnledgered(run, { type: "Choose", optionId: given }, tab.ctx);
    // The first player is the only other player: the engine takes him.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.seats[0]?.hand).toContain(given);
    expect(run.state.seats[1]?.hand).not.toContain(given);
    const ended = endRound(run.state, tab);
    expect(ended.state.cards[given]?.zone).toBe("deck");
    expect(ended.state.seats[1]?.deck).toContain(given);
    expect(ended.state.seats[0]?.hand).not.toContain(given);
    // Shuffled in: neither on top nor at the bottom of the deck.
    const at = ended.state.seats[1]?.deck.indexOf(given) ?? -1;
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan((ended.state.seats[1]?.deck.length ?? 0) - 1);
  });

  // "if the chosen card is in that player's hand or in play": the second player gives Noiseless Movement, and the first player (threat 30,
  // so it is not returned) plays it on the Wall; it is in the discard pile at the end of the round and is not shuffled into a deck.
  it("08032:A:1 Message from Elrond: a given card that left the hand and play is not shuffled into its owner's deck", () => {
    const scene = table(EFFECTS, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: ELROND, seat: 0 }, { code: NOISELESS, seat: 1 }], playerDeck: [...fillers(CARD, 3, 0), ...fillers(CARD, 3, 1)], staging: [WALL] });
    const tab = { ...scene, state: withThreat(scene.state, 0, 30) };
    const given = idsOf(tab, NOISELESS);
    let run = play(begin(tab.state), tab, idsOf(tab, ELROND));
    run = sendUnledgered(sendUnledgered(run, { type: "Choose", optionId: "seat:1" }, tab.ctx), { type: "Choose", optionId: given }, tab.ctx);
    expect(run.state.seats[0]?.hand).toContain(given);
    run = play(run, tab, given);
    expect(run.state.cards[given]?.zone).toBe("discard");
    const ended = endRound(run.state, tab);
    expect(ended.state.cards[given]?.zone).toBe("discard");
    expect(ended.state.seats[1]?.deck).not.toContain(given);
  });
});
