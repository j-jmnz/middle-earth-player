// Rules: rr.response, rr.multiple-defenders, rr.step-6-4-1, rr.step-6-4-3, rr.step-6-8-2, rr.active-location, rr.ranged,
// rr.reveal, rr.play-restrictions-and-permissions, rr.modifiers, rr.restricted, rr.hit-points (data/rules/entries.json).
// The core-set Learn to Play Tactics deck (core-tactics), brought into scope on request (user request, 2026-10-26): Gimli,
// Legolas, Thalin, Gondorian Spearman, Blade Mastery, Rain of Arrows, Thicket of Spears, Swift Strike, Stand Together, Blade of
// Gondolin, Citadel Plate and Dwarven Axe.
import { beforeAll, describe, expect, it } from "vitest";

import { attackBarred, syncConstants } from "../rules/constants.ts";
import { modifiedStat } from "../rules/keywords.ts";
import { startReveal } from "../rules/frames.ts";
import { settle } from "../rules/machine.ts";
import { definePrinted } from "../rules/printed.ts";
import { legalIntents } from "../rules/reduce.ts";
import { updateCard, withMode, type ScenarioState } from "../rules/state.ts";
import { fund, payFor, refusal, starterBase } from "../../scripts/starter-scene.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { begin, buildTable, idsOf, passWindows, send, type Run, type Scene, type Table } from "../../scripts/test-scene.ts";

const GIMLI = "01004";
const LEGOLAS = "01005";
const THALIN = "01006";
const SPEARMAN = "01029";
const BLADE_MASTERY = "01032";
const RAIN = "01033";
const THICKET = "01036";
const SWIFT = "01037";
const STAND = "01038";
const GONDOLIN = "01039";
const PLATE = "01040";
const AXE = "01041";
const ORC = "orc";
const GOBLIN = "goblin";
const WEAK = "weak";
const POUNDER = "pounder";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([GIMLI, LEGOLAS, THALIN, SPEARMAN, BLADE_MASTERY, RAIN, THICKET, SWIFT, STAND, GONDOLIN, PLATE, AXE]))]);
  cards.set(ORC, definePrinted({ code: ORC, name: "Orc", type: "enemy", traits: ["Orc"], threat: 1, engagementCost: 40, attack: 2, defense: 1, health: 5 }));
  cards.set(GOBLIN, definePrinted({ code: GOBLIN, name: "Goblin", type: "enemy", traits: ["Goblin"], threat: 1, engagementCost: 40, attack: 2, defense: 1, health: 5 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  cards.set(POUNDER, definePrinted({ code: POUNDER, name: "Pounder", type: "enemy", threat: 1, engagementCost: 40, attack: 6, defense: 1, health: 9 }));
  base = { ...starter, cards };
});

function table(scene: Scene = {}, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

function offered(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));
}

function choices(run: Run, tab: Table): string[] {
  return legalIntents(run.state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
}

function stat(state: ScenarioState, tab: Table, id: string, which: "attack" | "defense" | "hitPoints" | "willpower"): number {
  return modifiedStat(state, state.cards[id]!, which, tab.ctx.cards);
}

function play(tab: Table, code: string, run: Run = begin(tab.state)): Run {
  const card = idsOf(tab, code);
  return send(run, { type: "PlayCard", cardId: card, payments: payFor(run.state, tab.ctx, card) }, tab.ctx);
}

function combat(state: ScenarioState, tab: Table): Run {
  return begin(settle({ ...withMode(state, "combatStart"), window: null }, tab.ctx, []));
}

const attacking = (state: ScenarioState): ScenarioState => ({ ...withMode(state, "playerAttacks"), window: { kind: "playerAttack" }, activeSeat: 0 });

describe("Gimli (01004:A:1)", () => {
  it("gets +1 Attack for each damage token on him", () => {
    const tab = table({ heroes: [{ code: GIMLI, seat: 0 }] });
    const gimli = idsOf(tab, GIMLI);
    expect(stat(tab.state, tab, gimli, "attack")).toBe(2);
    // The constant is rebuilt after each intent and before each trigger (syncConstants).
    expect(stat(syncConstants(updateCard(tab.state, gimli, { damage: 3 }), tab.ctx), tab, gimli, "attack")).toBe(5);
  });
});

describe("Legolas (01005:A:2; line 1 is Ranged)", () => {
  it("after an attack he is in destroys an enemy, places 2 progress on the current quest", () => {
    const tab = table({ heroes: [{ code: LEGOLAS, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    const legolas = idsOf(tab, LEGOLAS);
    let run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [legolas] }, tab.ctx);
    expect(offered(run.state, tab)).toEqual(["01005:response:1"]);
    const stage = run.state.questStage ?? "";
    run = send(run, { type: "Trigger", cardId: legolas, effectId: "01005:response:1" }, tab.ctx);
    expect(run.state.cards[stage]?.progress).toBe(2);
  });

  it("places the progress on the active location first (rr.active-location)", () => {
    const tab = table({ heroes: [{ code: LEGOLAS, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], active: "141034" });
    const legolas = idsOf(tab, LEGOLAS);
    let run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [legolas] }, tab.ctx);
    run = send(run, { type: "Trigger", cardId: legolas, effectId: "01005:response:1" }, tab.ctx);
    expect(run.steps.filter((step) => step.kind === "progress").map((step) => (step.kind === "progress" ? step.targetId : ""))).toContain(idsOf(tab, "141034"));
  });
});

describe("Thalin (01006:A:1)", () => {
  it("deals 1 damage to an enemy as it is revealed while he is committed to the quest", () => {
    const tab = table({ start: "quest", heroes: [{ code: THALIN, seat: 0 }, { code: GIMLI, seat: 0 }], deck: ["f3", "f0"] });
    let run = send(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, THALIN)] }, tab.ctx);
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, "f3")]?.zone).toBe("staging");
    expect(run.state.cards[idsOf(tab, "f3")]?.damage).toBe(1);
  });

  it("deals none while he stays home", () => {
    const tab = table({ start: "quest", heroes: [{ code: THALIN, seat: 0 }, { code: GIMLI, seat: 0 }], deck: ["f3", "f0"] });
    let run = send(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, GIMLI)] }, tab.ctx);
    run = send(run, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, "f3")]?.damage).toBe(0);
  });

  it("deals none to an enemy a player searched for and revealed: the encounter deck did not reveal it (rr.staging)", () => {
    const tab = table({ start: "quest", heroes: [{ code: THALIN, seat: 0 }, { code: GIMLI, seat: 0 }], deck: ["f0", "f3"] });
    const committed = { ...updateCard(tab.state, idsOf(tab, THALIN), { committed: true, exhausted: true }), window: null };
    const steps: Parameters<typeof settle>[2] = [];
    const found = settle(startReveal(committed, 0, tab.ctx, steps, idsOf(tab, "f3")), tab.ctx, steps);
    expect(found.cards[idsOf(tab, "f3")]?.zone).toBe("staging");
    expect(found.cards[idsOf(tab, "f3")]?.damage).toBe(0);
  });
});

describe("Gondorian Spearman (01029:A:2; line 1 is Sentinel) and Swift Strike (01037:A:1)", () => {
  const scene = (): Table => table({ heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], engaged: [{ code: ORC, seat: 0 }], hand: [{ code: SWIFT, seat: 0 }] });

  it("after the Spearman is declared as a defender, deal 1 damage to the attacking enemy; Swift Strike deals 2 more", () => {
    const tab = scene();
    let run = passWindows(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = send(run, { type: "DeclareDefender", defenderId: idsOf(tab, SPEARMAN) }, tab.ctx);
    expect(offered(run.state, tab).sort()).toEqual(["01029:response:1", "01037:response:1"]);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, SPEARMAN), effectId: "01029:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ORC)]?.damage).toBe(1);
    const strike = idsOf(tab, SWIFT);
    run = send(run, { type: "Trigger", cardId: strike, effectId: "01037:response:1", payments: payFor(run.state, tab.ctx, strike) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ORC)]?.damage).toBe(3);
    expect(run.state.cards[strike]?.zone).toBe("discard");
  });

  it("Swift Strike answers any defender, and the Spearman only his own declaration", () => {
    const tab = scene();
    let run = passWindows(combat(tab.state, tab), tab.ctx);
    run = send(run, { type: "DeclareDefender", defenderId: idsOf(tab, GIMLI) }, tab.ctx);
    expect(offered(run.state, tab)).toEqual(["01037:response:1"]);
  });
});

describe("Blade Mastery (01032:A:1)", () => {
  it("gives the chosen character +1 Attack and +1 Defense until the end of the phase", () => {
    const tab = table({ heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }], hand: [{ code: BLADE_MASTERY, seat: 0 }] });
    const legolas = idsOf(tab, LEGOLAS);
    let run = play(tab, BLADE_MASTERY);
    run = send(run, { type: "Choose", optionId: legolas }, tab.ctx);
    expect(stat(run.state, tab, legolas, "attack")).toBe(4);
    expect(stat(run.state, tab, legolas, "defense")).toBe(2);
    expect(stat(run.state, tab, idsOf(tab, GIMLI), "attack")).toBe(2);
  });
});

describe("Rain of Arrows (01033:A:1)", () => {
  it("exhausts a ranged character to deal 1 damage to each enemy engaged with the chosen player", () => {
    const tab = table({ heroes: [{ code: LEGOLAS, seat: 0 }, { code: GIMLI, seat: 0 }], hand: [{ code: RAIN, seat: 0 }], engaged: [{ code: ORC, seat: 0 }, { code: GOBLIN, seat: 0 }], staging: [WEAK] });
    const run = play(tab, RAIN);
    expect(run.state.cards[idsOf(tab, LEGOLAS)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, ORC)]?.damage).toBe(1);
    expect(run.state.cards[idsOf(tab, GOBLIN)]?.damage).toBe(1);
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).toBe("staging");
  });

  it("cannot be played without a ready character with the ranged keyword", () => {
    const tab = table({ heroes: [{ code: LEGOLAS, seat: 0 }, { code: GIMLI, seat: 0 }], hand: [{ code: RAIN, seat: 0 }], engaged: [{ code: ORC, seat: 0 }] });
    const state = updateCard(tab.state, idsOf(tab, LEGOLAS), { exhausted: true });
    expect(refusal(state, { type: "PlayCard", cardId: idsOf(tab, RAIN), payments: payFor(state, tab.ctx, idsOf(tab, RAIN)) }, tab.ctx)).toBe("That card cannot be played now");
  });
});

describe("Thicket of Spears (01036:A:1 and A:2)", () => {
  const scene = (): Table => table({ heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: THALIN, seat: 0 }], hand: [{ code: THICKET, seat: 0 }], engaged: [{ code: ORC, seat: 0 }, { code: GOBLIN, seat: 0 }] }, 3);

  it("must be paid for from 3 different heroes' pools", () => {
    const tab = scene();
    const card = idsOf(tab, THICKET);
    expect(refusal(tab.state, { type: "PlayCard", cardId: card, payments: [{ heroId: idsOf(tab, GIMLI), amount: 3 }] }, tab.ctx)).toBe("Pay from at least 3 different heroes");
    const three = [GIMLI, LEGOLAS, THALIN].map((code) => ({ heroId: idsOf(tab, code), amount: 1 }));
    expect(refusal(tab.state, { type: "PlayCard", cardId: card, payments: three }, tab.ctx)).toBeNull();
  });

  it("is not offered while fewer than 3 heroes hold a resource", () => {
    const tab = scene();
    const state = updateCard(tab.state, idsOf(tab, THALIN), { resources: 0 });
    expect(legalIntents(state, tab.ctx)).not.toContainEqual({ type: "PlayCard", cardId: idsOf(tab, THICKET) });
  });

  it("the chosen player's engaged enemies cannot attack that player this phase", () => {
    const tab = scene();
    const three = [GIMLI, LEGOLAS, THALIN].map((code) => ({ heroId: idsOf(tab, code), amount: 1 }));
    const run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, THICKET), payments: three }, tab.ctx);
    for (const code of [ORC, GOBLIN]) expect(attackBarred(run.state, idsOf(tab, code), 0)).toBe(true);
    const later = withMode(run.state, "questCommit");
    expect(attackBarred(later, idsOf(tab, ORC), 0)).toBe(false);
  });
});

describe("Stand Together (01038:A:1, rr.multiple-defenders)", () => {
  it("lets the player declare several defenders, pools their defense, and puts all the damage on the one they choose", () => {
    const tab = table({ heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: THALIN, seat: 0 }], hand: [{ code: STAND, seat: 0 }], engaged: [{ code: POUNDER, seat: 0 }] });
    const [gimli, legolas, thalin] = [GIMLI, LEGOLAS, THALIN].map((code) => idsOf(tab, code));
    let run = combat(tab.state, tab);
    // The action window before the attacks (6.2): Stand Together is played there.
    expect(run.state.window?.kind).toBe("frameAction");
    run = play(tab, STAND, run);
    run = passWindows(run, tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = send(run, { type: "DeclareDefender", defenderId: gimli ?? "" }, tab.ctx);
    // Another defender may be declared, or the declarations end (families/defense/defenders.ts moreDefenders).
    expect(choices(run, tab)).toEqual(["another", "done"]);
    run = send(run, { type: "Choose", optionId: "another" }, tab.ctx);
    expect(choices(run, tab).sort()).toEqual([legolas, thalin].sort());
    run = send(run, { type: "Choose", optionId: thalin ?? "" }, tab.ctx);
    run = passWindows(send(run, { type: "Choose", optionId: "done" }, tab.ctx), tab.ctx);
    // Attack 6 against Gimli's 2 and Thalin's 2 Defense: 2 damage, all of it on one defender the player chooses.
    expect(choices(run, tab).sort()).toEqual([gimli, thalin].sort());
    run = passWindows(send(run, { type: "Choose", optionId: thalin ?? "" }, tab.ctx), tab.ctx);
    expect(run.state.cards[thalin ?? ""]?.damage).toBe(2);
    expect(run.state.cards[gimli ?? ""]?.damage).toBe(0);
    expect(run.state.cards[legolas ?? ""]?.exhausted).toBe(false);
    expect(run.steps.some((step) => step.kind === "strike" && step.defense === 4 && step.attack === 6)).toBe(true);
  });

  it("without it, one defender is declared and the attack goes on", () => {
    const tab = table({ heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }], engaged: [{ code: POUNDER, seat: 0 }] });
    let run = passWindows(combat(tab.state, tab), tab.ctx);
    run = passWindows(send(run, { type: "DeclareDefender", defenderId: idsOf(tab, GIMLI) }, tab.ctx), tab.ctx);
    expect(run.state.cards[idsOf(tab, GIMLI)]?.damage).toBe(4);
  });
});

describe("Blade of Gondolin (01039; line 1 is the attach-to template's)", () => {
  it("gives the attached hero +1 Attack when attacking an Orc (01039:A:2)", () => {
    const tab = table({ heroes: [{ code: LEGOLAS, seat: 0 }], attached: [{ code: GONDOLIN, host: LEGOLAS }], engaged: [{ code: ORC, seat: 0 }, { code: GOBLIN, seat: 0 }] });
    const legolas = idsOf(tab, LEGOLAS);
    // The bonus is read during the attack itself (attackingHolds): the strike's Attack says it.
    const strikeAttack = (enemy: string): number | undefined => {
      const run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, enemy), attackerIds: [legolas] }, tab.ctx);
      const strike = run.steps.find((step) => step.kind === "strike" && step.side === "player");
      return strike?.kind === "strike" ? strike.attack : undefined;
    };
    expect(strikeAttack(ORC)).toBe(4);
    expect(strikeAttack(GOBLIN)).toBe(3);
  });

  it("after the attached hero attacks and destroys an enemy, places 1 progress on the current quest (01039:A:3)", () => {
    const tab = table({ heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: GONDOLIN, host: GIMLI }], engaged: [{ code: WEAK, seat: 0 }] });
    let run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, GIMLI)] }, tab.ctx);
    expect(offered(run.state, tab)).toEqual(["01039:response:1"]);
    const stage = run.state.questStage ?? "";
    run = send(run, { type: "Trigger", cardId: idsOf(tab, GONDOLIN), effectId: "01039:response:1" }, tab.ctx);
    expect(run.state.cards[stage]?.progress).toBe(1);
  });
});

describe("Citadel Plate (01040) and Dwarven Axe (01041), from the templates", () => {
  it("Citadel Plate gives +4 hit points", () => {
    const tab = table({ heroes: [{ code: LEGOLAS, seat: 0 }], attached: [{ code: PLATE, host: LEGOLAS }] });
    expect(stat(tab.state, tab, idsOf(tab, LEGOLAS), "hitPoints")).toBe(8);
  });

  it("Dwarven Axe gives +1 Attack, +2 to a Dwarf", () => {
    const tab = table({ heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: AXE, host: GIMLI }, { code: AXE, host: LEGOLAS }] });
    expect(stat(tab.state, tab, idsOf(tab, GIMLI), "attack")).toBe(4);
    expect(stat(tab.state, tab, idsOf(tab, LEGOLAS), "attack")).toBe(4);
  });
});
