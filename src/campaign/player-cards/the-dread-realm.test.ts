// Rules: rr.action, rr.limits, rr.resources, rr.cost, rr.modifiers, rr.engaged, rr.lasting-effects, rr.exhausted, bts.valour,
// rr.play-restrictions-and-permissions, rr.then, rr.drawing-cards (data/rules/entries.json).
// The Dread Realm hero, ally and events, each line tested from the words on the card: Arwen Undómiel 10140:A:1, Fornost Bowman 10143:A:2,
// Hour of Wrath 10144:A:1 and A:2, Elven-light 10145:A:2. The attachments are in the-dread-realm-attachments.test.ts. The lines are the text
// of data/cards/TDR.json (data/printed holds no entry for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withThreat } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, discarded, enter, fillers, passAll, play, playCode, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ARWEN = "10140";
const BOWMAN = "10143";
const WRATH = "10144";
const ELVEN_LIGHT = "10145";
// Core Aragorn (Leadership, Dúnedain), Legolas (Tactics, Silvan), Gimli (Tactics, Dwarf), Glorfindel (Lore, Noldor).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const GIMLI = "01004";
const GLORFINDEL = "01011";
// An enemy whose attack of 3 none of these heroes stops, and which no attack here destroys.
const BRUTE = "brute";
const WEAK = "weak";
const PAL = "pal";
const CARD = "card";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ARWEN, BOWMAN, WRATH, ELVEN_LIGHT, ARAGORN, LEGOLAS, GIMLI, GLORFINDEL]))]);
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 40, attack: 3, defense: 9, health: 9 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

// The card ids a PlayCard intent is offered for.
const playable = (tab: Table, state = tab.state) => legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "PlayCard" ? [intent.cardId] : []));

describe("Arwen Undómiel (10140:A:1)", () => {
  // Arwen and Glorfindel (Noldor) and Legolas (not Noldor) for the first player, core Aragorn for the second; an event and an ally (or the
  // event alone, or nothing) in Arwen's player's hand.
  const scene = (effects: readonly Effect[], hand = 2) =>
    table(effects, { seats: 2, heroes: [{ code: ARWEN, seat: 0 }, { code: GLORFINDEL, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 1 }], hand: [...fillers(CARD, Math.min(hand, 1)), ...fillers(ALLY, hand - 1)] }, 0);

  // "Action: Discard a card from your hand to add 1 resource to a Noldor's resource pool ... (Limit once per round.)": the player picks the
  // ally to discard, the Noldor heroes are offered and Legolas is not, the chosen Glorfindel gets 1 resource; the Action is not offered again
  // this round, though a card is left in hand.
  lineSpec("10140:A:1", "Arwen: discards a card to add 1 resource to a Noldor hero, once per round", (effects) => {
    const tab = scene(effects);
    const [arwen, glorfindel] = [idsOf(tab, ARWEN), idsOf(tab, GLORFINDEL)];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: arwen, effectId: "10140:action:1" }, tab.ctx);
    const [card, ally] = [idsOf(tab, CARD), idsOf(tab, ALLY)];
    expect(choices(run.state, tab).sort()).toEqual([card, ally].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: ally }, tab.ctx);
    expect(run.state.seats[0]?.hand).toEqual([card]);
    expect(run.state.seats[0]?.discard).toEqual([ally]);
    expect(choices(run.state, tab).sort()).toEqual(["aragorn", "noldor"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "noldor" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([arwen, glorfindel].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: glorfindel }, tab.ctx);
    expect(run.state.cards[glorfindel]?.resources).toBe(1);
    expect(run.state.cards[arwen]?.resources).toBe(0);
    expect(triggers(run.state, tab)).not.toContain("10140:action:1");
  });

  // "... or to Aragorn's resource pool.": the other player's Aragorn gets the resource.
  it("10140:A:1 Arwen: adds the resource to the other player's Aragorn", () => {
    const tab = scene(EFFECTS, 1);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, ARWEN), effectId: "10140:action:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(0);
    run = sendUnledgered(run, { type: "Choose", optionId: "aragorn" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(1);
  });

  // With no card in hand the cost cannot be paid: the Action is not offered.
  it("10140:A:1 Arwen: not offered with an empty hand", () => {
    const tab = scene(EFFECTS, 0);
    expect(triggers(tab.state, tab)).not.toContain("10140:action:1");
  });
});

describe("Fornost Bowman (10143:A:2)", () => {
  // "Fornost Bowman gets +1 Attack for each enemy engaged with you.": played while 2 enemies are engaged with his player and 1 with the other,
  // he has Attack 1 + 2.
  lineSpec("10143:A:2", "Fornost Bowman: +1 Attack for each enemy engaged with his player only", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 0 }, { code: WEAK, seat: 1 }], hand: [{ code: BOWMAN, seat: 0 }] });
    const bowman = idsOf(tab, BOWMAN);
    const run = play(begin(tab.state), tab, bowman);
    expect(run.state.cards[bowman]?.zone).toBe("play");
    expect(stat(run.state, tab, bowman, "attack")).toBe(1 + 2);
  });
});

describe("Hour of Wrath (10144:A:1, A:2)", () => {
  // "Action: Choose a hero. Until the end of the phase, the chosen hero does not exhaust to attack or defend.": played in the combat phase on
  // Gimli, every hero of both players is offered; Gimli defends the Brute's attack and stays ready, then attacks it and stays ready. In the next
  // phase's combat he exhausts to defend again.
  lineSpec("10144:A:1", "Hour of Wrath: the chosen hero does not exhaust to defend or attack until the end of the phase", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], engaged: [{ code: BRUTE, seat: 0 }], hand: [{ code: WRATH, seat: 0 }] });
    const [gimli, legolas, brute] = [idsOf(tab, GIMLI), idsOf(tab, LEGOLAS), idsOf(tab, BRUTE)];
    let run = play(combat(tab.state, tab), tab, idsOf(tab, WRATH));
    expect(choices(run.state, tab).sort()).toEqual([gimli, legolas, idsOf(tab, PAL)].sort());
    run = passAll(sendUnledgered(run, { type: "Choose", optionId: gimli }, tab.ctx), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: gimli }, tab.ctx);
    expect(run.state.cards[gimli]?.exhausted).toBe(false);
    run = passAll(run, tab.ctx, { responses: true });
    expect(run.state.window?.kind).toBe("playerAttack");
    run = sendUnledgered(run, { type: "DeclareAttackers", enemyId: brute, attackerIds: [gimli] }, tab.ctx);
    expect(run.state.cards[gimli]?.exhausted).toBe(false);
    // The next phase: the lasting effect is over, so Gimli exhausts to defend.
    const later = enter(run.state, tab, "questCommit");
    let next = passAll(combat(later.state, tab), tab.ctx);
    expect(next.state.window?.kind).toBe("defense");
    next = sendUnledgered(next, { type: "DeclareDefender", defenderId: gimli }, tab.ctx);
    expect(next.state.cards[gimli]?.exhausted).toBe(true);
  });

  // "Valour Action: Choose a player. Until the end of the phase, each of that player's heroes do not exhaust to attack or defend." (bts.valour):
  // at threat 40 the first player picks the Valour Action and the second player; the second player's hero attacks and stays ready, the first
  // player's Legolas attacks and exhausts.
  lineSpec("10144:A:2", "Hour of Wrath: at threat 40 the chosen player's heroes do not exhaust to attack", (effects) => {
    const start = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: GIMLI, seat: 1 }], engaged: [{ code: BRUTE, seat: 0 }, { code: WEAK, seat: 1 }], hand: [{ code: WRATH, seat: 0 }] });
    const tab = { ...start, state: withThreat(start.state, 0, 40) };
    const [legolas, gimli, brute, weak] = [idsOf(tab, LEGOLAS), idsOf(tab, GIMLI), idsOf(tab, BRUTE), idsOf(tab, WEAK)];
    let run = playCode(tab, WRATH, combat(tab.state, tab));
    expect(choices(run.state, tab).sort()).toEqual(["10144:action:1", "10144:action:2"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "10144:action:2" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual(["seat:0", "seat:1"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    const theirs = sendUnledgered(begin({ ...attacking(run.state), activeSeat: 1 }), { type: "DeclareAttackers", enemyId: weak, attackerIds: [gimli] }, tab.ctx);
    expect(theirs.state.cards[gimli]?.exhausted).toBe(false);
    const mine = sendUnledgered(begin(attacking(run.state)), { type: "DeclareAttackers", enemyId: brute, attackerIds: [legolas] }, tab.ctx);
    expect(mine.state.cards[legolas]?.exhausted).toBe(true);
  });
});

describe("Elven-light (10145:A:2)", () => {
  // "Action: Return Elven-light to your hand from your discard pile. Then, draw 1 card.": played from the discard pile (Arwen pays 1), it is in
  // the hand with the card drawn, and the deck is 1 card shorter.
  lineSpec("10145:A:2", "Elven-light: returns to the hand from the discard pile, then draws 1 card", (effects) => {
    const start = table(effects, { heroes: [{ code: ARWEN, seat: 0 }], playerDeck: fillers(CARD, 3) });
    const { tab, ids: [light = ""] } = discarded(start, [[ELVEN_LIGHT, 0]]);
    expect(playable(tab)).toContain(light);
    const run = play(begin(tab.state), tab, light);
    expect(run.state.cards[light]?.zone).toBe("hand");
    expect(run.state.seats[0]?.hand).toHaveLength(2);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.state.seats[0]?.discard).not.toContain(light);
    expect(run.state.cards[idsOf(tab, ARWEN)]?.resources).toBe(6 - 1);
  });
});
