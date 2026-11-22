// Rules: rr.play-restrictions-and-permissions, rr.action, rr.response, rr.play-and-put-into-play, rr.step-6-8-2, rr.quest-phase, rr.staging (data/rules/entries.json).
// The Over Hill and Under Hill events, written from their card text (data/cards; data/printed holds no ledger for this box yet): A Very Good Tale 131014:A:1, Foe-hammer 131015:A:1,
// Goblin-cleaver 131016:A:1, Expecting Mischief 131018:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { type ScenarioState } from "../../rules/core/state.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { fund, payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, buildTable, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, playerTable, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const THORIN = "131002";
const ORI = "131004";
const FILI = "131006";
const KILI = "131007";
const BOFUR = "131008";
const GANDALF = "131010";
const TALE = "131014";
const FOE_HAMMER = "131015";
const CLEAVER = "131016";
const MISCHIEF = "131018";
// Core Gimli (a Tactics Dwarf hero) and Dwarven Axe (a Weapon attachment).
const GIMLI = "01004";
// Core Legolas: a Tactics hero for the second seat.
const LEGOLAS = "01005";
const AXE = "01041";
const WEAK = "weak";
const TOUGH = "tough";
const ORC = "orc";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([THORIN, ORI, FILI, KILI, BOFUR, GANDALF, TALE, FOE_HAMMER, CLEAVER, MISCHIEF, GIMLI, AXE, LEGOLAS]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  cards.set(TOUGH, definePrinted({ code: TOUGH, name: "Tough", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 20 }));
  cards.set(ORC, definePrinted({ code: ORC, name: "Orc", type: "enemy", traits: ["Orc"], threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 20 }));
  base = { ...starter, cards };
});

function playIn(state: ScenarioState, tab: Table, code: string): Run {
  const card = idsOf(tab, code);
  return sendUnledgered(begin(state), { type: "PlayCard", cardId: card, payments: payFor(state, tab.ctx, card) }, tab.ctx);
}

function playable(state: ScenarioState, tab: Table, code: string): string | null {
  const card = idsOf(tab, code);
  return refusal(state, { type: "PlayCard", cardId: card, payments: payFor(state, tab.ctx, card) }, tab.ctx);
}

describe("A Very Good Tale (131014:A:1)", () => {
  // "Action: Exhaust 2 allies you control to shuffle your deck and discard the top 5 cards. Put up to 2 allies discarded by this effect into play under your control.
  // The total cost of the allies put into play cannot exceed the total cost of the allies exhausted to pay for this effect."
  // Fili and Kili (cost 3 each) are exhausted: 6 to spend. The deck is 5 cards, so all of them are discarded whatever the shuffle: Gandalf (5), Bofur (3),
  // the stand-in Ally (1) and two filler cards.
  function told(effects: readonly Effect[]): { tab: Table; run: Run } {
    const deck = [GANDALF, BOFUR, "ally", "card", "card"].map((code) => ({ code, seat: 0 }));
    const tab = table(effects, { heroes: [{ code: THORIN, seat: 0 }], allies: [{ code: FILI, seat: 0 }, { code: KILI, seat: 0 }], hand: [{ code: TALE, seat: 0 }], playerDeck: deck });
    let run = playIn(tab.state, tab, TALE);
    for (const code of [FILI, KILI]) if (choices(run.state, tab).includes(idsOf(tab, code))) run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, code) }, tab.ctx);
    return { tab, run };
  }

  lineSpec("131014:A:1", "exhausts 2 allies, discards the top 5 and puts discarded allies into play within their total cost", (effects) => {
    const { tab, run: discarded } = told(effects);
    expect([FILI, KILI].map((code) => discarded.state.cards[idsOf(tab, code)]?.exhausted)).toEqual([true, true]);
    expect(discarded.state.seats[0]?.deck).toHaveLength(0);
    // Gandalf (5) and Bofur (3) together cost 8, more than 6: once Gandalf is picked, Bofur is not offered.
    expect(choices(discarded.state, tab)).toEqual(expect.arrayContaining([idsOf(tab, GANDALF), idsOf(tab, BOFUR), idsOf(tab, "ally")]));
    let run = sendUnledgered(discarded, { type: "Choose", optionId: idsOf(tab, GANDALF) }, tab.ctx);
    expect(choices(run.state, tab)).not.toContain(idsOf(tab, BOFUR));
    expect(choices(run.state, tab)).toContain(idsOf(tab, "ally"));
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, "ally") }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GANDALF)]).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.cards[idsOf(tab, "ally")]).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.cards[idsOf(tab, BOFUR)]?.zone).toBe("discard");
  });

  it("131014:A:1 is not played while you control fewer than 2 ready allies", () => {
    const tab = table(EFFECTS, { heroes: [{ code: THORIN, seat: 0 }], allies: [{ code: FILI, seat: 0 }], hand: [{ code: TALE, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }] });
    expect(playable(tab.state, tab, TALE)).not.toBeNull();
  });
});

describe("Foe-hammer (131015:A:1)", () => {
  // "Response: After a hero you control attacks and destroys an enemy, exhaust a Weapon card attached to that hero to draw 3 cards."
  lineSpec("131015:A:1", "exhausts the attacking hero's Weapon to draw 3 cards after he destroys an enemy", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: AXE, host: GIMLI }], hand: [{ code: FOE_HAMMER, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], playerDeck: Array.from({ length: 5 }, () => ({ code: "card", seat: 0 })) });
    const hammer = idsOf(tab, FOE_HAMMER);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, GIMLI)] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("131015:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: hammer, effectId: "131015:response:1", payments: payFor(run.state, tab.ctx, hammer) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, AXE)]?.exhausted).toBe(true);
    // The hand held Foe-hammer only; it is played and 3 cards are drawn.
    expect(run.state.seats[0]?.hand).toHaveLength(3);
    expect(run.state.cards[hammer]?.zone).toBe("discard");
  });

  it("131015:A:1 is not offered without a ready Weapon on the hero, or when an ally destroyed the enemy", () => {
    const deck = Array.from({ length: 5 }, () => ({ code: "card", seat: 0 }));
    const bare = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: FOE_HAMMER, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], playerDeck: deck });
    const unarmed = sendUnledgered(begin(attacking(bare.state)), { type: "DeclareAttackers", enemyId: idsOf(bare, WEAK), attackerIds: [idsOf(bare, GIMLI)] }, bare.ctx);
    expect(triggers(unarmed.state, bare)).not.toContain("131015:response:1");
    const ally = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: AXE, host: GIMLI }], allies: [{ code: BOFUR, seat: 0 }], hand: [{ code: FOE_HAMMER, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], playerDeck: deck });
    const byAlly = sendUnledgered(begin(attacking(ally.state)), { type: "DeclareAttackers", enemyId: idsOf(ally, WEAK), attackerIds: [idsOf(ally, BOFUR)] }, ally.ctx);
    expect(triggers(byAlly.state, ally)).not.toContain("131015:response:1");
  });
});

describe("Goblin-cleaver (131016:A:1)", () => {
  // "Combat Action: Exhaust a Weapon card attached to a hero you control to choose an enemy engaged with you. Deal 2 damage to that enemy. (Deal 3 damage instead if the enemy is an Orc.)"
  function cleave(effects: readonly Effect[], target: string): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: AXE, host: GIMLI }], hand: [{ code: CLEAVER, seat: 0 }], engaged: [{ code: TOUGH, seat: 0 }, { code: ORC, seat: 0 }] });
    const opened = combat(tab.state, tab);
    expect(opened.state.window?.kind).toBe("frameAction");
    let run = playIn(opened.state, tab, CLEAVER);
    if (choices(run.state, tab).includes(idsOf(tab, AXE))) run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, AXE) }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, TOUGH), idsOf(tab, ORC)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, target) }, tab.ctx);
    return { tab, run };
  }

  lineSpec("131016:A:1", "exhausts a hero's Weapon to deal 2 damage to an enemy engaged with you", (effects) => {
    const { tab, run } = cleave(effects, TOUGH);
    expect(run.state.cards[idsOf(tab, AXE)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, TOUGH)]?.damage).toBe(2);
    expect(run.state.cards[idsOf(tab, ORC)]?.damage).toBe(0);
  });

  lineSpec("131016:A:1", "deals 3 damage instead to an Orc", (effects) => {
    const { tab, run } = cleave(effects, ORC);
    expect(run.state.cards[idsOf(tab, ORC)]?.damage).toBe(3);
  });

  lineSpec("131016:A:1", "is a Combat Action: not played in the planning phase, nor without a ready Weapon on a hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: AXE, host: GIMLI }], hand: [{ code: CLEAVER, seat: 0 }], engaged: [{ code: TOUGH, seat: 0 }] });
    expect(playable(tab.state, tab, CLEAVER)).not.toBeNull();
    const opened = combat(tab.state, tab);
    expect(playable(opened.state, tab, CLEAVER)).toBeNull();
    const unarmed = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: CLEAVER, seat: 0 }], engaged: [{ code: TOUGH, seat: 0 }] });
    // With no ready Weapon on a hero nothing can be played in the combat action window, so the engine does not open it: the first enemy attacks (a defense window).
    expect(opened.state.window?.kind).toBe("frameAction");
    expect(combat(unarmed.state, unarmed).state.window?.kind).toBe("defense");
    // The same window opened by hand, the card is refused for the missing Weapon and not for the window.
    const window = { ...opened.state, cards: unarmed.state.cards, seats: unarmed.state.seats };
    expect(window.window?.kind).toBe("frameAction");
    expect(playable(window, unarmed, CLEAVER)).toBe("That card cannot be played now");
  });
});

describe("Goblin-cleaver with another player's Weapon (131016:A:1)", () => {
  // "Exhaust a Weapon card attached to a hero you control": seat 1 plays Dwarven Axe on seat 0's Gimli. rr.attachment-cards: "When an attachment enters play attached to a
  // character under another player's control, that player gains control of the attachment", so seat 0 controls the Axe and can exhaust it for Goblin-cleaver.
  it("131016:A:1 exhausts a Weapon another player played on your hero", () => {
    const made = buildTable(base, { ring: "none", start: "planning", seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 1 }], hand: [{ code: CLEAVER, seat: 0 }, { code: AXE, seat: 1 }], engaged: [{ code: TOUGH, seat: 0 }], effects: EFFECTS });
    const tab = { ...made, state: syncConstants(fund(fund(made.state, 0, 3), 1, 3), made.ctx) };
    const [axe, gimli, tough, cleaver] = [idsOf(tab, AXE), idsOf(tab, GIMLI), idsOf(tab, TOUGH), idsOf(tab, CLEAVER)];
    // Seat 1's planning turn: it pays for the Axe and attaches it to Gimli.
    const turn = { ...tab.state, activeSeat: 1, planningSeat: 1 };
    const planned = sendUnledgered(begin(turn), { type: "PlayCard", cardId: axe, hostId: gimli, payments: payFor(turn, tab.ctx, axe, 1) }, tab.ctx);
    expect(planned.state.cards[axe]).toMatchObject({ host: gimli, controller: 0, owner: 1 });
    // The combat phase's action window: seat 0 plays Goblin-cleaver.
    const opened = combat(planned.state, tab);
    expect(opened.state.activeSeat).toBe(0);
    let run = playIn(opened.state, tab, CLEAVER);
    if (choices(run.state, tab).includes(axe)) run = sendUnledgered(run, { type: "Choose", optionId: axe }, tab.ctx);
    if (choices(run.state, tab).includes(tough)) run = sendUnledgered(run, { type: "Choose", optionId: tough }, tab.ctx);
    expect(run.state.cards[axe]?.exhausted).toBe(true);
    expect(run.state.cards[tough]?.damage).toBe(2);
    expect(run.state.cards[cleaver]?.zone).toBe("discard");
  });
});

describe("Expecting Mischief (131018:A:1)", () => {
  // "Play during the quest phase, before the staging step."
  lineSpec("131018:A:1", "is played in the quest phase before staging, not in the planning phase nor after staging", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: ORI, seat: 0 }, { code: THORIN, seat: 0 }], hand: [{ code: MISCHIEF, seat: 0 }], deck: ["f0", "f0", "f0"] });
    // The quest phase opens on the commit pass: the staging step has not begun.
    expect(playable(tab.state, tab, MISCHIEF)).toBeNull();
    const planning = table(effects, { heroes: [{ code: ORI, seat: 0 }, { code: THORIN, seat: 0 }], hand: [{ code: MISCHIEF, seat: 0 }] });
    expect(playable(planning.state, planning, MISCHIEF)).not.toBeNull();
    // The heroes commit and the staging step reveals: the window after staging (3.3) is too late.
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, THORIN)] }, tab.ctx);
    for (let guard = 0; guard < 5 && run.state.window?.kind !== "frameAction" && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.mode).not.toBe("questCommit");
    expect(playable(run.state, tab, MISCHIEF)).not.toBeNull();
  });
});
