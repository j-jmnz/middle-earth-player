// Rules: rr.response, rr.action, rr.then, rr.limits, rr.triggered-ability, rr.cost, rr.modifiers, rr.lasting-effects, rr.engagement-check,
// rr.staging, rr.search, rr.drawing-cards, trg.secrecy (data/rules/entries.json).
// The Long Dark heroes, allies and events, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Háma
// 04076:A:1, Erestor 04077:A:1, Fresh Tracks 04078:A:1, Erebor Battle Master 04079:A:1, Out of Sight 04081:A:2, Word of Command 04084:A:1.
// The attachments are in the-long-dark-attachments.test.ts. The lines are the text of data/cards/TLD.json (data/printed holds no ledger
// for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, canPlay, choices, combat, discarded, endRound, enter, fillers, passAll, play, playCode, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const HAMA = "04076";
const ERESTOR = "04077";
const TRACKS = "04078";
const MASTER = "04079";
const SIGHT = "04081";
const WORD = "04084";
// Core cards: Gimli (Dwarf hero, Tactics), Denethor and Beravor (Lore heroes), Eleanor (Spirit), Aragorn (Leadership), Gandalf (an Istari
// ally), Feint (a Tactics event), Ever Vigilant (a Leadership event), Round Shield (a Tactics attachment).
const GIMLI = "01004";
const DENETHOR = "01010";
const ELEANOR = "01008";
const ARAGORN = "01001";
const GANDALF = "01073";
const FEINT = "01034";
const VIGILANT = "01020";
const SHIELD = "19118";
// Hobbit hero with no text (scene.ts), Leadership.
const PAL = "pal";
const ALLY = "ally";
const CARD = "card";
// A Dwarf ally with no text, Tactics, cost 1.
const DWARF = "dwarf";
// An enemy no attack of these tests destroys; an enemy the engagement check engages (cost 5, the threat is 8); a location with no text.
const WALL = "wall";
const NEAR = "near";
const FIELD = "field";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [HAMA, ERESTOR, TRACKS, MASTER, SIGHT, WORD, GIMLI, DENETHOR, ELEANOR, ARAGORN, GANDALF, FEINT, VIGILANT, SHIELD];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(DWARF, definePrinted({ code: DWARF, name: "Dwarf", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dwarf"] }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 9, health: 99 }));
  cards.set(NEAR, definePrinted({ code: NEAR, name: "Near", type: "enemy", threat: 1, engagementCost: 5, attack: 1, defense: 1, health: 9 }));
  cards.set(FIELD, definePrinted({ code: FIELD, name: "Field", type: "location", threat: 1, questPoints: 3 }));
  base = { ...starter, cards };
});

describe("Háma (04076:A:1)", () => {
  // Háma and the Wall engaged with the player; Feint (Tactics event), Ever Vigilant (Leadership event) and Round Shield (Tactics
  // attachment) in the discard pile, one card in hand. The player attack window is open.
  function hama(effects: readonly Effect[], rows: readonly (readonly [string, number])[] = [[FEINT, 0], [VIGILANT, 0], [SHIELD, 0]]) {
    const scene = table(effects, { heroes: [{ code: HAMA, seat: 0 }], hand: [{ code: CARD, seat: 0 }], engaged: fillers(WALL, 4) });
    const { tab, ids } = discarded(scene, rows);
    return { tab, ids, declared: sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [idsOf(tab, HAMA)] }, tab.ctx) };
  }

  // "Response: After Háma is declared as an attacker, return a Tactics event from your discard pile to your hand. Then, choose and
  // discard 1 card from your hand.": Feint (the only Tactics event) comes to the hand; the player then picks the card to discard from
  // the two in hand, and the hand holds Feint alone.
  lineSpec("04076:A:1", "Háma: after he is declared as an attacker, a Tactics event from the discard pile to the hand, then discard 1", (effects) => {
    const { tab, ids: [feint = "", vigilant = "", shield = ""], declared } = hama(effects);
    const card = idsOf(tab, CARD);
    expect(triggers(declared.state, tab)).toContain("04076:response:1");
    let run = sendUnledgered(declared, { type: "Trigger", cardId: idsOf(tab, HAMA), effectId: "04076:response:1" }, tab.ctx);
    expect(run.state.cards[feint]?.zone).toBe("hand");
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([feint, card].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: card }, tab.ctx);
    expect(run.state.seats[0]?.hand).toEqual([feint]);
    expect(run.state.cards[card]?.zone).toBe("discard");
    expect(run.state.cards[vigilant]?.zone).toBe("discard");
    expect(run.state.cards[shield]?.zone).toBe("discard");
  });

  // No Tactics event in the discard pile (a Leadership event and a Tactics attachment): the part before "Then" cannot resolve, so the
  // Response is not offered and no card is discarded (rr.then, rr.triggered-ability).
  it("04076:A:1 Háma: not offered without a Tactics event in the discard pile", () => {
    const { tab, declared } = hama(EFFECTS, [[VIGILANT, 0], [SHIELD, 0]]);
    expect(triggers(declared.state, tab)).not.toContain("04076:response:1");
  });

  // "(Limit 3 times per game for the group.)": Háma attacks four times (a new Wall each time, a later round), each time taking Feint back
  // and discarding it again; the fourth time the Response is not offered.
  it("04076:A:1 Háma: limit 3 times per game", () => {
    const { tab, ids: [feint = ""], declared } = hama(EFFECTS);
    const hamaId = idsOf(tab, HAMA);
    let run = declared;
    for (let time = 0; time < 3; time += 1) {
      expect(triggers(run.state, tab)).toContain("04076:response:1");
      run = sendUnledgered(run, { type: "Trigger", cardId: hamaId, effectId: "04076:response:1" }, tab.ctx);
      run = sendUnledgered(run, { type: "Choose", optionId: feint }, tab.ctx);
      expect(run.state.cards[feint]?.zone).toBe("discard");
      run = passAll(run, tab.ctx, { responses: true });
      const again = attacking(updateCard({ ...run.state, round: run.state.round + 1 }, hamaId, { exhausted: false }));
      run = sendUnledgered(begin(again), { type: "DeclareAttackers", enemyId: tab.ids[WALL]?.[time + 1] ?? "", attackerIds: [hamaId] }, tab.ctx);
    }
    expect(triggers(run.state, tab)).not.toContain("04076:response:1");
  });
});

describe("Erestor (04077:A:1)", () => {
  const erestor = (effects: readonly Effect[], deck: number) => table(effects, { heroes: [{ code: PAL, seat: 0 }], allies: [{ code: ERESTOR, seat: 0 }], hand: [{ code: CARD, seat: 0 }, { code: ALLY, seat: 0 }], playerDeck: fillers(FEINT, deck) });

  // "Action: Choose and discard 1 card from your hand to draw 1 card. (Limit once per round.)": the player picks the Ally of the two in
  // hand, it is discarded and a card is drawn; the Action is not offered again that round, and is the next round.
  lineSpec("04077:A:1", "Erestor: discard 1 card from your hand to draw 1 card, once per round", (effects) => {
    const tab = erestor(effects, 3);
    const [id, ally, card] = [idsOf(tab, ERESTOR), idsOf(tab, ALLY), idsOf(tab, CARD)];
    expect(triggers(tab.state, tab)).toContain("04077:action:1");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: id, effectId: "04077:action:1" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([ally, card].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: ally }, tab.ctx);
    expect(run.state.cards[ally]?.zone).toBe("discard");
    expect(run.state.seats[0]?.hand).toHaveLength(2);
    expect(run.state.seats[0]?.hand).toContain(card);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(triggers(run.state, tab)).not.toContain("04077:action:1");
    const next = withMode(endRound(run.state, tab).state, "planning");
    expect(triggers({ ...next, window: { kind: "pass" }, activeSeat: 0 }, tab)).toContain("04077:action:1");
  });

  // With the deck empty nothing can be drawn: the Action is not offered, and no card is discarded for nothing (rr.cost).
  it("04077:A:1 Erestor: not offered with an empty deck", () => {
    const tab = erestor(EFFECTS, 0);
    expect(triggers(tab.state, tab)).not.toContain("04077:action:1");
  });
});

describe("Fresh Tracks (04078:A:1)", () => {
  // The quest phase: the hero commits, the player passes and the staging step reveals `revealed`; Fresh Tracks is in hand.
  function staged(effects: readonly Effect[], revealed: string, staging: readonly string[] = []): { tab: Table; run: Run } {
    const tab = table(effects, { start: "quest", heroes: [{ code: PAL, seat: 0 }], hand: [{ code: TRACKS, seat: 0 }], deck: [revealed], staging });
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, PAL)] }, tab.ctx);
    return { tab, run: sendUnledgered(run, { type: "Pass" }, tab.ctx) };
  }

  // "Response: After an enemy is added to the staging area, deal 1 damage to that enemy. Players ignore that enemy while making engagement
  // checks this round.": the revealed Near (cost 5, the threat 8) takes 1 damage; this round's engagement check leaves it in the staging
  // area, the next round's engages it.
  lineSpec("04078:A:1", "Fresh Tracks: 1 damage to the enemy added to the staging area, ignored by the engagement checks this round", (effects) => {
    const { tab, run: revealed } = staged(effects, NEAR);
    const near = idsOf(tab, NEAR);
    expect(revealed.state.cards[near]?.zone).toBe("staging");
    expect(triggers(revealed.state, tab)).toContain("04078:response:1");
    const run = sendUnledgered(revealed, { type: "Trigger", cardId: idsOf(tab, TRACKS), effectId: "04078:response:1", payments: payFor(revealed.state, tab.ctx, idsOf(tab, TRACKS)) }, tab.ctx);
    expect(run.state.cards[near]?.damage).toBe(1);
    expect(run.state.cards[idsOf(tab, TRACKS)]?.zone).toBe("discard");
    const checked = enter(run.state, tab, "engagement");
    expect(checked.state.cards[near]?.zone).toBe("staging");
    const later = enter(endRound(checked.state, tab).state, tab, "engagement");
    expect(later.state.cards[near]?.zone).toBe("engaged");
  });

  // "ignore that enemy": only that enemy. Another Near already in the staging area is still engaged by this round's engagement check.
  it("04078:A:1 Fresh Tracks: another enemy in the staging area is still engaged", () => {
    const { tab, run: revealed } = staged(EFFECTS, NEAR, [NEAR]);
    // The deck's card is made first (scene.ts), so the revealed Near is the first.
    const [tracked = "", other = ""] = tab.ids[NEAR] ?? [];
    expect(revealed.state.cards[tracked]?.zone).toBe("staging");
    const run = sendUnledgered(revealed, { type: "Trigger", cardId: idsOf(tab, TRACKS), effectId: "04078:response:1", payments: payFor(revealed.state, tab.ctx, idsOf(tab, TRACKS)) }, tab.ctx);
    expect(run.state.cards[tracked]?.damage).toBe(1);
    const checked = enter(run.state, tab, "engagement");
    expect(checked.state.cards[other]?.zone).toBe("engaged");
    expect(checked.state.cards[tracked]?.zone).toBe("staging");
  });

  // A location added to the staging area is not an enemy: no Response.
  it("04078:A:1 Fresh Tracks: not offered after a location is added to the staging area", () => {
    const { tab, run } = staged(EFFECTS, FIELD);
    expect(run.state.cards[idsOf(tab, FIELD)]?.zone).toBe("staging");
    expect(triggers(run.state, tab)).not.toContain("04078:response:1");
  });
});

describe("Erebor Battle Master (04079:A:1)", () => {
  // "Erebor Battle Master gets +1 Attack for each other Dwarf ally you control. (Limit +4 Attack.)": with Gimli (a Dwarf hero, not an
  // ally) and 3 Dwarf allies he has 1 + 3; the fourth Dwarf ally, played from the hand, brings 1 + 4 in the state that intent returns, and
  // a fifth Dwarf ally gives no more (the limit).
  lineSpec("04079:A:1", "Erebor Battle Master: +1 Attack for each other Dwarf ally you control, at most +4", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: MASTER, seat: 0 }, ...fillers(DWARF, 3)], hand: fillers(DWARF, 2) });
    const master = idsOf(tab, MASTER);
    const attack = printed(tab, MASTER, "attack");
    expect(stat(tab.state, tab, master, "attack")).toBe(attack + 3);
    let run = playCode(tab, DWARF);
    expect(stat(run.state, tab, master, "attack")).toBe(attack + 4);
    run = playCode(tab, DWARF, run);
    expect(run.state.seats[0]?.hand).toHaveLength(0);
    expect(stat(run.state, tab, master, "attack")).toBe(attack + 4);
  });

  // "you control": the other player's Dwarf allies are not counted; he does not count himself.
  it("04079:A:1 Erebor Battle Master: another player's Dwarf allies and himself are not counted", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: MASTER, seat: 0 }, ...fillers(DWARF, 2, 1)] });
    expect(stat(tab.state, tab, idsOf(tab, MASTER), "attack")).toBe(printed(tab, MASTER, "attack"));
  });
});

describe("Out of Sight (04081:A:2)", () => {
  // Two players; the Wall is engaged with each. Out of Sight is in the first player's hand (cost 5, Secrecy 3 at threat 8: 2).
  const sight = (effects: readonly Effect[]): Table =>
    table(effects, { seats: 2, heroes: [{ code: ELEANOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: SIGHT, seat: 0 }], engaged: [{ code: WALL, seat: 0 }, { code: WALL, seat: 1 }] });

  // "Action: Enemies engaged with you cannot attack you this phase.": played in the combat action window, the first player's Wall makes
  // no attack; the other player's Wall attacks him.
  lineSpec("04081:A:2", "Out of Sight: enemies engaged with you cannot attack you this phase", (effects) => {
    const tab = sight(effects);
    const [mine = "", theirs = ""] = tab.ids[WALL] ?? [];
    let run = combat(tab.state, tab);
    expect(run.state.window?.kind).toBe("frameAction");
    run = play(run, tab, idsOf(tab, SIGHT));
    expect(run.state.cards[idsOf(tab, SIGHT)]?.zone).toBe("discard");
    run = passAll(run, tab.ctx);
    // The first player has no attack to defend: the defense the game asks for is the other player's, against his own Wall.
    expect(run.state.window?.kind).toBe("defense");
    expect(run.state.activeSeat).toBe(1);
    expect(run.state.pendingAttack?.enemyId).toBe(theirs);
    expect(run.state.pendingAttack?.enemyId).not.toBe(mine);
  });

  // "this phase": played in the planning phase, it does not stop the attack of the combat phase.
  it("04081:A:2 Out of Sight: played in the planning phase, the enemy attacks in the combat phase", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ELEANOR, seat: 0 }], hand: [{ code: SIGHT, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, SIGHT));
    expect(run.state.cards[idsOf(tab, SIGHT)]?.zone).toBe("discard");
    expect(passAll(combat(run.state, tab), tab.ctx).state.window?.kind).toBe("defense");
  });
});

describe("Word of Command (04084:A:1)", () => {
  const word = (effects: readonly Effect[], scene: Scene): Table => table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: WORD, seat: 0 }], ...scene });

  // "Action: Exhaust an Istari character to search your deck for 1 card and add it to your hand. Shuffle your deck.": Gandalf is exhausted;
  // of the deck's 4 cards the player picks the Ally, which goes to the hand; the deck is shuffled.
  lineSpec("04084:A:1", "Word of Command: exhaust an Istari character to search your deck for 1 card, add it to your hand, shuffle", (effects) => {
    const tab = word(effects, { allies: [{ code: GANDALF, seat: 0 }], playerDeck: [...fillers(CARD, 2), { code: ALLY, seat: 0 }, { code: FEINT, seat: 0 }] });
    const [gandalf, ally] = [idsOf(tab, GANDALF), idsOf(tab, ALLY)];
    const cursor = tab.state.seedCursor;
    let run = play(begin(tab.state), tab, idsOf(tab, WORD));
    expect(run.state.cards[gandalf]?.exhausted).toBe(true);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab)).toContain(ally);
    run = sendUnledgered(run, { type: "Choose", optionId: ally }, tab.ctx);
    expect(run.state.cards[ally]?.zone).toBe("hand");
    expect(run.state.seats[0]?.deck).toHaveLength(3);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });

  // An exhausted Istari, or no Istari (Aragorn is not one): the cost cannot be paid, so the card cannot be played.
  it("04084:A:1 Word of Command: not played without a ready Istari character", () => {
    const exhausted = word(EFFECTS, { allies: [{ code: GANDALF, seat: 0 }], playerDeck: fillers(CARD, 2) });
    const state = updateCard(exhausted.state, idsOf(exhausted, GANDALF), { exhausted: true });
    expect(canPlay(state, exhausted, idsOf(exhausted, WORD))).toBe(false);
    const none = word(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ARAGORN, seat: 0 }], playerDeck: fillers(CARD, 2) });
    expect(canPlay(none.state, none, idsOf(none, WORD))).toBe(false);
  });

  // With the deck empty nothing can be searched for: it is not played, and Gandalf is not exhausted for nothing.
  it("04084:A:1 Word of Command: not played with an empty deck", () => {
    const tab = word(EFFECTS, { allies: [{ code: GANDALF, seat: 0 }] });
    expect(canPlay(tab.state, tab, idsOf(tab, WORD))).toBe(false);
  });
});
