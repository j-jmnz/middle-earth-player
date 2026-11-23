// Rules: rr.response, rr.action, rr.cost, rr.triggered-ability, rr.lasting-effects, rr.combat-phase, rr.drawing-cards, rr.search,
// rr.resources, rr.resource-match, rr.enters-play, rr.play-and-put-into-play (data/rules/entries.json).
// The Mount Gundabad allies and events, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts):
// Greenwood Defender 19113:A:1, Elf Guide 19114:A:1, Gaffer Gamgee 19115:A:1, Drinking Song 19116:A:1, Erebor Toymaker 19119:A:1. The
// lines are the text of data/cards/MG.json (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered. The
// attachments are in mount-gundabad-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { playCost } from "../../rules/player/attach.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { idsOf, type Run, type Scene, type Table, SAM } from "../../../test/harness/scene.ts";
import { atDefense, canPlay, choices, combat, endRound, enter, fillers, passAll, play, playCode, playerTableFor, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const DEFENDER = "19113";
const GUIDE = "19114";
const GAFFER = "19115";
const DRINKING = "19116";
const TOYMAKER = "19119";
const ARMOR = "19120";
// Core Aragorn (Leadership), Éowyn (Spirit), Denethor (Lore); the Wandering Took (a Hobbit ally, not unique). Sam Gamgee (a unique
// Leadership Hobbit hero) is a scene card.
const ARAGORN = "01001";
const EOWYN = "01007";
const DENETHOR = "01010";
const TOOK = "01043";
// The Pal (a Leadership hero) and a plain ally, from the scene kit; the "card" event of the scene kit.
const PAL = "pal";
const ALLY = "ally";
const CARD = "card";
// A Silvan ally with no text; a Spirit ally of cost 3.
const SILVAN = "silvan";
const COSTLY = "costly";
// An enemy of Attack 2 that no attack of these tests destroys. The test threat is 8: the Dear has engagement cost 50, the Cheap 2
// (starter-scene.ts).
const BRUTE = "brute";
const DEAR = "dear";
const CHEAP = "cheap";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([DEFENDER, GUIDE, GAFFER, DRINKING, TOYMAKER, ARMOR, ARAGORN, EOWYN, DENETHOR, TOOK]))]);
  cards.set(SILVAN, definePrinted({ code: SILVAN, name: "Silvan", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Silvan"] }));
  cards.set(COSTLY, definePrinted({ code: COSTLY, name: "Costly", type: "ally", sphere: "spirit", cost: 3, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 2, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Greenwood Defender (19113:A:1)", () => {
  // Aragorn plays the Defender from the hand; the Brute is engaged.
  const defender = (effects: readonly Effect[]): Table => table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: DEFENDER, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }] });
  // The combat phase on `state`: the Defender is declared as the defender of the Brute's attack.
  const defends = (state: Table["state"], tab: Table): Run => {
    const run = atDefense(tab, state);
    return sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, DEFENDER) }, tab.ctx);
  };

  // "Response: After Greenwood Defender enters play, it does not exhaust to defend until the end of the round.": it defends the Brute and
  // stays ready; in the next round it exhausts to defend.
  lineSpec("19113:A:1", "after it enters play it does not exhaust to defend until the end of the round", (effects) => {
    const tab = defender(effects);
    const card = idsOf(tab, DEFENDER);
    let run = playCode(tab, DEFENDER);
    expect(run.state.cards[card]?.zone).toBe("play");
    expect(triggers(run.state, tab)).toContain("19113:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: card, effectId: "19113:response:1" }, tab.ctx);
    const first = defends(run.state, tab);
    expect(first.state.cards[card]?.exhausted).toBe(false);
    const next = defends(endRound(first.state, tab).state, tab);
    expect(next.state.cards[card]?.exhausted).toBe(true);
  });

  // Not used: it exhausts to defend.
  it("19113:A:1 exhausts to defend when the Response is not used", () => {
    const tab = defender(EFFECTS);
    const run = sendUnledgered(playCode(tab, DEFENDER), { type: "Pass" }, tab.ctx);
    expect(defends(run.state, tab).state.cards[idsOf(tab, DEFENDER)]?.exhausted).toBe(true);
  });
});

describe("Elf Guide (19114:A:1)", () => {
  // Aragorn (Leadership) for the first player with the Greenwood Defender and the Silvan ally (both Silvan) and the plain ally; the Pal for
  // the second player, with a Silvan ally of his own.
  const guide = (effects: readonly Effect[]): Table =>
    table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: DEFENDER, seat: 0 }, { code: SILVAN, seat: 0 }, { code: ALLY, seat: 0 }, { code: SILVAN, seat: 1 }], hand: [{ code: GUIDE, seat: 0 }] });

  // "Action: Return a Silvan ally you control to your hand to choose a hero. Add 1 resource to that hero's pool.": the two Silvan allies
  // of the first player are offered (not the plain ally, not the second player's Silvan); the Defender goes to the hand; then the second
  // player's Pal is the hero chosen and gets 1 resource.
  lineSpec("19114:A:1", "return a Silvan ally you control to your hand, then 1 resource to the chosen hero", (effects) => {
    const tab = guide(effects);
    const [card, silvan, theirs, pal] = [idsOf(tab, DEFENDER), idsOf(tab, SILVAN), tab.ids[SILVAN]?.[1] ?? "", idsOf(tab, PAL)];
    let run = playCode(tab, GUIDE);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([card, silvan].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: card }, tab.ctx);
    expect(run.state.cards[card]?.zone).toBe("hand");
    expect(run.state.seats[0]?.hand).toContain(card);
    expect(run.state.cards[theirs]?.zone).toBe("play");
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, ARAGORN), pal].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: pal }, tab.ctx);
    expect(run.state.cards[pal]?.resources).toBe(6 + 1);
  });

  // "you control": only the second player controls a Silvan ally, so the cost cannot be paid and the event is not offered.
  it("19114:A:1 is not offered when only another player controls a Silvan ally", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: SILVAN, seat: 1 }], hand: [{ code: GUIDE, seat: 0 }] });
    expect(canPlay(tab.state, tab, idsOf(tab, GUIDE))).toBe(false);
  });
});

describe("Gaffer Gamgee (19115:A:1)", () => {
  // Denethor (Lore) and the Gaffer in play; the Dear (engagement cost 50, above the threat 8) and the Cheap (2) are engaged.
  const gaffer = (effects: readonly Effect[]): Table =>
    table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: GAFFER, seat: 0 }], engaged: [{ code: DEAR, seat: 0 }, { code: CHEAP, seat: 0 }] });

  // "Combat Action: Return Gaffer Gamgee to your hand to choose an enemy with engagement cost higher than your threat. Until the end of the
  // round, that enemy cannot attack you.": in the combat phase the Gaffer goes to the hand and the Dear (the only enemy above the threat)
  // is chosen; only the Cheap attacks, and the Dear makes no attack this round.
  lineSpec("19115:A:1", "return him to the hand so an enemy with a higher engagement cost cannot attack you this round", (effects) => {
    const tab = gaffer(effects);
    const [card, dear, cheap] = [idsOf(tab, GAFFER), idsOf(tab, DEAR), idsOf(tab, CHEAP)];
    let run = combat(tab.state, tab);
    expect(triggers(run.state, tab)).toContain("19115:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: card, effectId: "19115:action:1" }, tab.ctx);
    // One enemy qualifies, so the engine takes it without asking.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[card]?.zone).toBe("hand");
    run = passAll(run, tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "defense", enemyId: cheap });
    run = passAll(sendUnledgered(run, { type: "Undefended", heroId: idsOf(tab, DENETHOR) }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.window?.kind).not.toBe("defense");
    const attackers = run.steps.flatMap((step) => (step.kind === "strike" && step.side === "enemy" ? [step.enemyId] : []));
    expect(attackers).toEqual([cheap]);
    expect(attackers).not.toContain(dear);
  });

  // Only the Cheap (engagement cost 2, below the threat 8) is engaged: no enemy to choose, so it is not offered.
  it("19115:A:1 is not offered when no enemy has an engagement cost higher than your threat", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: GAFFER, seat: 0 }], engaged: [{ code: CHEAP, seat: 0 }] });
    expect(triggers(combat(tab.state, tab).state, tab)).not.toContain("19115:action:1");
  });

  // "Combat Action": in the planning phase it is not offered.
  it("19115:A:1 is not offered outside the combat phase", () => {
    const tab = gaffer(EFFECTS);
    expect(triggers(tab.state, tab)).not.toContain("19115:action:1");
  });
});

describe("Drinking Song (19116:A:1)", () => {
  // Denethor (Lore) pays; `scene` gives the heroes and allies; the hand holds Drinking Song and 3 events, the deck 5 allies.
  function song(effects: readonly Effect[], scene: Scene): { tab: Table; run: Run } {
    const tab = table(effects, { hand: [{ code: DRINKING, seat: 0 }, ...fillers(CARD, 3)], playerDeck: fillers(ALLY, 5), ...scene });
    return { tab, run: playCode(tab, DRINKING) };
  }

  // "Action: Count the number of cards in your hand and shuffle your hand into your deck. Then, draw an equal number of cards. Draw 1
  // additional card if you control a unique Hobbit character.": the 3 events go into the deck, which is shuffled, and 3 cards are drawn;
  // the Wandering Took is a Hobbit but not unique, so nothing more.
  lineSpec("19116:A:1", "shuffle the hand into the deck and draw as many cards", (effects) => {
    const { tab, run } = song(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: TOOK, seat: 0 }] });
    expect(run.state.cards[idsOf(tab, DRINKING)]?.zone).toBe("discard");
    expect(run.state.seats[0]?.hand).toHaveLength(3);
    expect(run.state.seats[0]?.deck).toHaveLength(5);
    expect(run.state.seedCursor).not.toBe(tab.state.seedCursor);
  });

  // With Sam (a unique Hobbit hero) under his control, the player draws 1 more: 4 cards, the deck keeps 4.
  lineSpec("19116:A:1", "draw 1 additional card while you control a unique Hobbit character", (effects) => {
    const { run } = song(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: SAM, seat: 0 }] });
    expect(run.state.seats[0]?.hand).toHaveLength(3 + 1);
    expect(run.state.seats[0]?.deck).toHaveLength(5 - 1);
  });

  // "you control": the second player's Sam gives no extra card.
  it("19116:A:1 another player's unique Hobbit gives no additional card", () => {
    const { run } = song(EFFECTS, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: SAM, seat: 1 }] });
    expect(run.state.seats[0]?.hand).toHaveLength(3);
  });
});

describe("Erebor Toymaker (19119:A:1)", () => {
  // Éowyn (Spirit) plays the Toymaker; two Armors of Erebor (attachments, cost 2) and a Costly ally (cost 3) wait in hand.
  const toymaker = (effects: readonly Effect[]): Table =>
    table(effects, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: TOYMAKER, seat: 0 }, { code: ARMOR, seat: 0 }, { code: ARMOR, seat: 0 }, { code: COSTLY, seat: 0 }] });

  // "Response: After you play Erebor Toymaker from your hand, reduce the cost of the next attachment played this phase by 2.": the first
  // Armor then costs 0 and the Costly ally keeps its 3; the second Armor costs its printed 2.
  lineSpec("19119:A:1", "after he is played, the next attachment played this phase costs 2 less", (effects) => {
    const tab = toymaker(effects);
    const [card, [first = "", second = ""], costly, eowyn] = [idsOf(tab, TOYMAKER), tab.ids[ARMOR] ?? [], idsOf(tab, COSTLY), idsOf(tab, EOWYN)];
    let run = playCode(tab, TOYMAKER);
    expect(triggers(run.state, tab)).toContain("19119:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: card, effectId: "19119:response:1" }, tab.ctx);
    expect(playCost(run.state, first, 0, tab.ctx)).toBe(0);
    expect(playCost(run.state, costly, 0, tab.ctx)).toBe(3);
    const paid = run.state.cards[eowyn]?.resources ?? 0;
    run = play(run, tab, first, card);
    expect(run.state.cards[first]?.host).toBe(card);
    expect(run.state.cards[eowyn]?.resources).toBe(paid);
    expect(playCost(run.state, second, 0, tab.ctx)).toBe(2);
  });

  // "this phase": with no attachment played, the reduction ends with the planning phase.
  lineSpec("19119:A:1", "the reduction ends with the phase", (effects) => {
    const tab = toymaker(effects);
    let run = playCode(tab, TOYMAKER);
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, TOYMAKER), effectId: "19119:response:1" }, tab.ctx);
    expect(playCost(run.state, idsOf(tab, ARMOR), 0, tab.ctx)).toBe(0);
    expect(playCost(enter(run.state, tab, "questCommit").state, idsOf(tab, ARMOR), 0, tab.ctx)).toBe(2);
  });
});
