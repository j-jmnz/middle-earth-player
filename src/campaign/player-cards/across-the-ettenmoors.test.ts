// Rules: rr.response, rr.action, rr.cost, rr.limits, rr.lasting-effects, rr.sentinel, rr.exhausted, rr.restricted, rr.enters-play,
// rr.refresh-phase, rr.deckbuilding, rr.damage (data/rules/entries.json).
// The Across the Ettenmoors hero, allies and side quest, written from their card text (data/cards/AtE.json; data/printed holds no ledger for
// this pack, so every intent goes through sendUnledgered): Dori 10054:A:2, Longbeard Sentry 10057:A:1, Delay the Enemy 10058:A:2, Wellinghall
// Preserver 10061:A:1, A:2 and A:3. The attachments are in across-the-ettenmoors-attachments.test.ts, the events in
// across-the-ettenmoors-events.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckSaveRefusal } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { hasKeyword } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, deckSaveFacts, enter, fillers, hosts, packRow, passAll, playCode, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const DORI = "10054";
const SENTRY = "10057";
const DELAY = "10058";
const PRESERVER = "10061";
// Core heroes: Legolas (Tactics, Defense 1), Beravor (Lore, pays for the Preserver).
const LEGOLAS = "01005";
const BERAVOR = "01012";
const WEAK = "weak";
const ALLY = "ally";
const PAL = "pal";
const CARD = "card";
// A restricted attachment with no text, and an Ent ally with no text.
const GEAR = "gear";
const ENT = "ent";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([DORI, SENTRY, DELAY, PRESERVER, LEGOLAS, BERAVOR]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  cards.set(GEAR, definePrinted({ code: GEAR, name: "Gear", type: "attachment", sphere: "lore", cost: 0, keywords: { restricted: true } }));
  cards.set(ENT, definePrinted({ code: ENT, name: "Ent", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 1, defense: 1, health: 5, traits: ["Ent"] }));
  base = { ...starter, cards };
});

// The enemy strikes of the steps after `from`, as [defender, Defense].
const strikes = (steps: readonly { kind: string }[], from: number) =>
  steps.slice(from).flatMap((step) => (step.kind === "strike" && "side" in step && step.side === "enemy" && "targetId" in step && "defense" in step ? [[step.targetId, step.defense]] : []));

describe("Dori (10054:A:2)", () => {
  // Dori and Legolas, two enemies engaged; the combat phase runs to the first attack's defense window.
  function dori(effects: readonly Effect[], allies: Scene["allies"] = []): { tab: Table; dori: string; legolas: string; run: ReturnType<typeof begin> } {
    const tab = table(effects, { heroes: [{ code: DORI, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies, engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 0 }] });
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("chooseEnemy");
    run = passAll(sendUnledgered(run, { type: "ChooseEnemy", enemyId: idsOf(tab, WEAK) }, tab.ctx), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    return { tab, dori: idsOf(tab, DORI), legolas: idsOf(tab, LEGOLAS), run };
  }

  // "Response: After another hero is declared as a defender, exhaust Dori to add his Defense to the defending hero's Defense for this
  // attack.": Legolas (Defense 1) defends; Dori exhausts and the attack strikes Defense 1 + 2. At the second attack Legolas is back to 1.
  lineSpec("10054:A:2", "Dori: after another hero defends, exhaust him to add his Defense to the defender's for this attack", (effects) => {
    const { tab, dori: card, legolas, run: start } = dori(effects);
    let run = sendUnledgered(start, { type: "DeclareDefender", defenderId: legolas }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("10054:response:1");
    const before = run.steps.length;
    run = passAll(sendUnledgered(run, { type: "Trigger", cardId: card, effectId: "10054:response:1" }, tab.ctx), tab.ctx);
    expect(run.state.cards[card]?.exhausted).toBe(true);
    expect(strikes(run.steps, before)[0]).toEqual([legolas, 1 + 2]);
    expect(stat(run.state, tab, legolas, "defense")).toBe(1);
  });

  // "another hero": Dori defending himself gets nothing from his own Response.
  it("10054:A:2 Dori: not offered when he defends himself", () => {
    const { tab, dori: card, run } = dori(EFFECTS);
    expect(triggers(sendUnledgered(run, { type: "DeclareDefender", defenderId: card }, tab.ctx).state, tab)).not.toContain("10054:response:1");
  });

  // "hero": an ally defending is not a hero.
  it("10054:A:2 Dori: not offered when an ally defends", () => {
    const { tab, run } = dori(EFFECTS, [{ code: ALLY, seat: 0 }]);
    expect(triggers(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, ALLY) }, tab.ctx).state, tab)).not.toContain("10054:response:1");
  });
});

describe("Longbeard Sentry (10057:A:1)", () => {
  // The Sentry in play for the first player, `deck` cards in its deck; the other player has an enemy engaged.
  const sentry = (effects: readonly Effect[], deck: number): Table =>
    table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: SENTRY, seat: 0 }], playerDeck: fillers(CARD, deck), engaged: [{ code: WEAK, seat: 1 }] });

  // "Action: Discard 2 cards from the top of your deck to give Longbeard Sentry sentinel and +1 Defense until the end of the phase. (Limit
  // once per phase.)": the top 2 of 3 go to the discard pile; the Sentry has Defense 3 and sentinel, so it may defend the other player's
  // enemy (rr.sentinel); a second use this phase is not offered. In the next phase it is back to Defense 2 and has no sentinel.
  lineSpec("10057:A:1", "Longbeard Sentry: discard the top 2 cards to gain sentinel and +1 Defense until the end of the phase, once a phase", (effects) => {
    const tab = sentry(effects, 3);
    const card = idsOf(tab, SENTRY);
    const [top, second, third] = tab.state.seats[0]?.deck ?? [];
    expect(hasKeyword(tab.state, card, "sentinel", tab.ctx.cards)).toBe(false);
    const state = { ...tab.state, phase: "Combat" as const, boundaryPhase: "Combat" as const };
    let run = sendUnledgered(begin(state), { type: "Trigger", cardId: card, effectId: "10057:action:1" }, tab.ctx);
    expect(run.state.cards[top ?? ""]?.zone).toBe("discard");
    expect(run.state.cards[second ?? ""]?.zone).toBe("discard");
    expect(run.state.seats[0]?.deck).toEqual([third]);
    expect(stat(run.state, tab, card, "defense")).toBe(2 + 1);
    expect(hasKeyword(run.state, card, "sentinel", tab.ctx.cards)).toBe(true);
    expect(triggers(run.state, tab)).not.toContain("10057:action:1");
    // The other player's enemy attacks: the Sentry may defend it, and Legolas (no sentinel) may not.
    run = passAll(combat(run.state, tab), tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 1 });
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: card }, tab.ctx)).toBeNull();
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: idsOf(tab, LEGOLAS) }, tab.ctx)).not.toBeNull();
    const later = enter(run.state, tab, "refresh");
    expect(stat(later.state, tab, card, "defense")).toBe(2);
    expect(hasKeyword(later.state, card, "sentinel", tab.ctx.cards)).toBe(false);
  });

  // "Limit once per phase": used in the planning phase, it may be used again in the combat phase.
  it("10057:A:1 Longbeard Sentry: offered again in the next phase", () => {
    const tab = sentry(EFFECTS, 5);
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, SENTRY), effectId: "10057:action:1" }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("10057:action:1");
    expect(triggers(combat(run.state, tab).state, tab)).toContain("10057:action:1");
  });

  // With 1 card in the deck the cost of 2 cannot be paid in full.
  it("10057:A:1 Longbeard Sentry: not offered with fewer than 2 cards in the deck", () => {
    const tab = sentry(EFFECTS, 1);
    expect(triggers(tab.state, tab)).not.toContain("10057:action:1");
  });
});

describe("Delay the Enemy (10058:A:2)", () => {
  // "Limit 1 per deck." The deck check reads the card's deck limit (data/cards/AtE.json), which the DeckLimit record restates.
  it("10058:A:2 Delay the Enemy: a deck holds at most 1 copy", () => {
    const row = packRow("AtE", DELAY);
    expect(row?.deckLimit).toBe(1);
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    expect(deckSaveRefusal(["h1"], [...events, { code: DELAY, count: 1 }], deckSaveFacts(row))).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: DELAY, count: 2 }], deckSaveFacts(row))).toMatchObject({ cardCode: DELAY });
  });
});

describe("Wellinghall Preserver (10061:A:1, A:2, A:3)", () => {
  // "Cannot have restricted attachments.": a restricted attachment may go on Beravor and the Ent ally, not on the Preserver.
  lineSpec("10061:A:1", "Wellinghall Preserver: cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], allies: [{ code: PRESERVER, seat: 0 }, { code: ENT, seat: 0 }], hand: [{ code: GEAR, seat: 0 }] });
    const gear = idsOf(tab, GEAR);
    expect(hosts(tab, gear)).toContain(idsOf(tab, BERAVOR));
    expect(hosts(tab, gear)).toContain(idsOf(tab, ENT));
    expect(hosts(tab, gear)).not.toContain(idsOf(tab, PRESERVER));
  });

  // "Enters play exhausted.": played from the hand (Beravor pays 3), it comes into play exhausted.
  lineSpec("10061:A:2", "Wellinghall Preserver: enters play exhausted", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], hand: [{ code: PRESERVER, seat: 0 }] });
    const run = playCode(tab, PRESERVER);
    expect(run.state.cards[idsOf(tab, PRESERVER)]).toMatchObject({ zone: "play", exhausted: true });
    expect(run.state.cards[idsOf(tab, BERAVOR)]?.resources).toBe(6 - 3);
  });

  // The Preserver exhausted in play, the Ent ally and Beravor, with the damage given.
  function preserver(effects: readonly Effect[], damage: { preserver: number; ent: number; beravor: number }): { tab: Table; preserver: string; ent: string; beravor: string } {
    const scene = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], allies: [{ code: PRESERVER, seat: 0 }, { code: ENT, seat: 0 }] });
    const [card, ent, beravor] = [idsOf(scene, PRESERVER), idsOf(scene, ENT), idsOf(scene, BERAVOR)];
    let state = updateCard(scene.state, card, { exhausted: true, damage: damage.preserver });
    state = updateCard(updateCard(state, ent, { damage: damage.ent }), beravor, { damage: damage.beravor });
    return { tab: { ...scene, state }, preserver: card, ent, beravor };
  }

  // "Response: After Wellinghall Preserver readies, heal 1 damage from an Ent character.": it readies in the refresh phase; the damaged
  // Ent characters (itself and the Ent ally) are offered, Beravor (damaged, not an Ent) is not; the Ent ally is healed of 1.
  lineSpec("10061:A:3", "Wellinghall Preserver: after it readies, heal 1 damage from an Ent character", (effects) => {
    const { tab, preserver: card, ent, beravor } = preserver(effects, { preserver: 1, ent: 2, beravor: 1 });
    let run = enter(tab.state, tab, "refresh");
    expect(run.state.cards[card]?.exhausted).toBe(false);
    expect(triggers(run.state, tab)).toContain("10061:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: card, effectId: "10061:response:1" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([card, ent].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: ent }, tab.ctx);
    expect(run.state.cards[ent]?.damage).toBe(1);
    expect(run.state.cards[card]?.damage).toBe(1);
    expect(run.state.cards[beravor]?.damage).toBe(1);
  });

  // No damaged Ent character (only Beravor is damaged): nothing to heal, so it is not offered.
  it("10061:A:3 Wellinghall Preserver: not offered when no Ent character is damaged", () => {
    const { tab } = preserver(EFFECTS, { preserver: 0, ent: 0, beravor: 2 });
    expect(triggers(enter(tab.state, tab, "refresh").state, tab)).not.toContain("10061:response:1");
  });
});
