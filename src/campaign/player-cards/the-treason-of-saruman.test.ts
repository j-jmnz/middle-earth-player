// Rules: rr.action, rr.response, rr.limits, rr.cost, rr.restricted, rr.enters-play, rr.ready, rr.step-6-8-2, rr.modifiers, rr.lasting-effects (data/rules/entries.json).
// The Treason of Saruman heroes and allies, written from their printed lines (data/printed): Aragorn 143001:A:2, Théoden 143002:A:2,
// Treebeard 143003:A:1 and A:2, Legolas 143005:A:2, Quickbeam 143006:A:1 and A:2, Háma 143007:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { settle } from "../../rules/engine/machine.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { playCost } from "../../rules/player/attach.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, send, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, combat, playerTable, stat, triggers } from "../../../test/harness/player-table.ts";

const ARAGORN = "143001";
const THEODEN = "143002";
const TREEBEARD = "143003";
const LEGOLAS = "143005";
const QUICKBEAM = "143006";
const HAMA = "143007";
const ENT_DRAUGHT = "143009";
// Core Legolas (Tactics hero) pays for the Tactics cards; core Gimli is a plain second hero.
const TACTICS = "01005";
const GIMLI = "01004";
// Wandering Took: a Spirit ally that is not Rohan.
const TOOK = "01043";
// Round Shield: "Attach to a character. Restricted."
const SHIELD = "19118";
// Citadel Plate: "Attach to a hero. Restricted."
const PLATE = "01040";
const WEAK = "weak";
const TOUGH = "tough";
// A Rohan ally printed at cost 0.
const FREE_ROHAN = "free-rohan";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ARAGORN, THEODEN, TREEBEARD, LEGOLAS, QUICKBEAM, HAMA, ENT_DRAUGHT, TACTICS, GIMLI, TOOK, SHIELD, PLATE]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  cards.set(TOUGH, definePrinted({ code: TOUGH, name: "Tough", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  cards.set(FREE_ROHAN, definePrinted({ code: FREE_ROHAN, name: "Free Rider", type: "ally", sphere: "spirit", cost: 0, traits: ["Rohan"], willpower: 1, attack: 1, defense: 1, health: 1 }));
  base = { ...starter, cards };
});

function play(tab: Table, code: string, run: Run = begin(tab.state), hostId?: string): Run {
  const card = tab.ids[code]?.find((id) => run.state.cards[id]?.zone === "hand") ?? idsOf(tab, code);
  return send(run, { type: "PlayCard", cardId: card, payments: payFor(run.state, tab.ctx, card), ...(hostId ? { hostId } : {}) }, tab.ctx);
}

// The phase in progress ends and the next begins (withMode announces it); the engine then runs to its next window.
function nextPhase(run: Run, tab: Table, mode: Parameters<typeof withMode>[1]): Run {
  return begin(settle({ ...withMode(run.state, mode), window: null }, tab.ctx, []));
}

describe("Aragorn (143001:A:2)", () => {
  // "Action: Spend 2 resources from Aragorn's resource pool to ready a hero."
  lineSpec("143001:A:2", "spends 2 of his own resources to ready a hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }] }, 0);
    const [aragorn, gimli] = [idsOf(tab, ARAGORN), idsOf(tab, GIMLI)];
    const state = updateCard(updateCard(tab.state, aragorn, { resources: 3 }), gimli, { exhausted: true, resources: 5 });
    // The 2 come from Aragorn's pool, not another hero's.
    expect(refusal(state, { type: "Trigger", cardId: aragorn, effectId: "143001:action:1", payments: [{ heroId: gimli, amount: 2 }] }, tab.ctx)).toBe("Only that card's resources can pay");
    let run = send(begin(state), { type: "Trigger", cardId: aragorn, effectId: "143001:action:1", payments: [{ heroId: aragorn, amount: 2 }] }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    run = send(run, { type: "Choose", optionId: gimli }, tab.ctx);
    expect(run.state.cards[gimli]?.exhausted).toBe(false);
    expect(run.state.cards[aragorn]?.resources).toBe(1);
    expect(run.state.cards[gimli]?.resources).toBe(5);
  });

  lineSpec("143001:A:2", "is not offered while Aragorn holds fewer than 2 resources", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }] }, 0);
    const [aragorn, gimli] = [idsOf(tab, ARAGORN), idsOf(tab, GIMLI)];
    const rich = updateCard(updateCard(tab.state, aragorn, { resources: 2 }), gimli, { exhausted: true, resources: 5 });
    expect(triggers(rich, tab)).toContain("143001:action:1");
    const poor = updateCard(rich, aragorn, { resources: 1 });
    expect(triggers(poor, tab)).not.toContain("143001:action:1");
  });
});

describe("Théoden (143002:A:2)", () => {
  // "Reduce the cost of the first Rohan ally you play from your hand each round by 1 (to a minimum of 0)."
  lineSpec("143002:A:2", "the first Rohan ally of the round costs 1 less, the second its printed cost", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODEN, seat: 0 }], hand: [{ code: HAMA, seat: 0 }, { code: HAMA, seat: 0 }] }, 5);
    const [first, second] = tab.ids[HAMA] ?? [];
    expect(playCost(tab.state, first ?? "", 0, tab.ctx)).toBe(2);
    const run = send(begin(tab.state), { type: "PlayCard", cardId: first ?? "", payments: [{ heroId: idsOf(tab, THEODEN), amount: 2 }] }, tab.ctx);
    expect(run.state.cards[first ?? ""]?.zone).toBe("play");
    expect(playCost(run.state, second ?? "", 0, tab.ctx)).toBe(3);
  });

  lineSpec("143002:A:2", "the reduction comes back the next round", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODEN, seat: 0 }], hand: [{ code: HAMA, seat: 0 }, { code: HAMA, seat: 0 }] }, 5);
    const [first, second] = tab.ids[HAMA] ?? [];
    let run = send(begin(tab.state), { type: "PlayCard", cardId: first ?? "", payments: [{ heroId: idsOf(tab, THEODEN), amount: 2 }] }, tab.ctx);
    // The round ends and the next begins: the planning phase of round 2.
    run = nextPhase(run, tab, "beginRound");
    run = begin(settle({ ...withMode(run.state, "planning"), window: null }, tab.ctx, []));
    expect(playCost(run.state, second ?? "", 0, tab.ctx)).toBe(2);
  });

  it("143002:A:2 does not take a Rohan ally of cost 0 below 0", () => {
    const tab = table(EFFECTS, { heroes: [{ code: THEODEN, seat: 0 }], hand: [{ code: FREE_ROHAN, seat: 0 }] }, 5);
    expect(playCost(tab.state, idsOf(tab, FREE_ROHAN), 0, tab.ctx)).toBe(0);
  });

  it("143002:A:2 does not reduce an ally that is not Rohan", () => {
    const tab = table(EFFECTS, { heroes: [{ code: THEODEN, seat: 0 }], hand: [{ code: TOOK, seat: 0 }] }, 5);
    expect(playCost(tab.state, idsOf(tab, TOOK), 0, tab.ctx)).toBe(tab.ctx.cards.get(TOOK)?.cost);
  });
});

describe("Treebeard (143003:A:1, A:2)", () => {
  // "Cannot have restricted attachments."
  lineSpec("143003:A:1", "a restricted attachment cannot go on him; it can on another hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: TREEBEARD, seat: 0 }, { code: TACTICS, seat: 0 }], hand: [{ code: PLATE, seat: 0 }] });
    const plate = idsOf(tab, PLATE);
    const pay = payFor(tab.state, tab.ctx, plate);
    expect(refusal(tab.state, { type: "PlayCard", cardId: plate, hostId: idsOf(tab, TREEBEARD), payments: pay }, tab.ctx)).toBe("That card cannot have that attachment");
    expect(refusal(tab.state, { type: "PlayCard", cardId: plate, hostId: idsOf(tab, TACTICS), payments: pay }, tab.ctx)).toBeNull();
  });

  // "Action: Deal 1 damage to Treebeard to give him +1 Willpower and +1 Attack until the end of the phase. (Limit 5 times per phase.)"
  lineSpec("143003:A:2", "1 damage to him gives +1 Willpower and +1 Attack until the end of the phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: TREEBEARD, seat: 0 }] });
    const treebeard = idsOf(tab, TREEBEARD);
    const [willpower, attack] = [stat(tab.state, tab, treebeard, "willpower"), stat(tab.state, tab, treebeard, "attack")];
    let run = send(begin(tab.state), { type: "Trigger", cardId: treebeard, effectId: "143003:action:1" }, tab.ctx);
    expect(run.state.cards[treebeard]?.damage).toBe(1);
    expect(stat(run.state, tab, treebeard, "willpower")).toBe(willpower + 1);
    expect(stat(run.state, tab, treebeard, "attack")).toBe(attack + 1);
    run = send(run, { type: "Trigger", cardId: treebeard, effectId: "143003:action:1" }, tab.ctx);
    expect(stat(run.state, tab, treebeard, "attack")).toBe(attack + 2);
    // The planning phase ends: the bonus goes, the damage stays.
    run = nextPhase(run, tab, "questCommit");
    expect(stat(run.state, tab, treebeard, "willpower")).toBe(willpower);
    expect(stat(run.state, tab, treebeard, "attack")).toBe(attack);
    expect(run.state.cards[treebeard]?.damage).toBe(2);
  });

  lineSpec("143003:A:2", "is used at most 5 times in a phase, and again in the next phase", (effects) => {
    // Ent Draught's +2 hit points keep him alive through 5 damage.
    const tab = table(effects, { heroes: [{ code: TREEBEARD, seat: 0 }], attached: [{ code: ENT_DRAUGHT, host: TREEBEARD }] });
    const treebeard = idsOf(tab, TREEBEARD);
    let run = begin(tab.state);
    for (let time = 0; time < 5; time += 1) run = send(run, { type: "Trigger", cardId: treebeard, effectId: "143003:action:1" }, tab.ctx);
    expect(run.state.cards[treebeard]?.damage).toBe(5);
    expect(triggers(run.state, tab)).not.toContain("143003:action:1");
    run = nextPhase(run, tab, "questCommit");
    expect(triggers(run.state, tab)).toContain("143003:action:1");
  });
});

describe("Legolas (143005:A:2; line 1 is Ranged)", () => {
  // "Response: After Legolas participates in an attack that destroys an enemy, draw 1 card."
  lineSpec("143005:A:2", "draws 1 card after an attack he is in destroys an enemy", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: LEGOLAS, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }, { code: "card", seat: 0 }] });
    const legolas = idsOf(tab, LEGOLAS);
    // Gimli strikes alongside him: participating is enough.
    let run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, GIMLI), legolas] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).not.toBe("engaged");
    const hand = run.state.seats[0]?.hand.length ?? 0;
    run = send(run, { type: "Trigger", cardId: legolas, effectId: "143005:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand.length).toBe(hand + 1);
  });

  it("143005:A:2 is not offered when the enemy survives, or when he is not in the attack", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: LEGOLAS, seat: 0 }], engaged: [{ code: TOUGH, seat: 0 }, { code: WEAK, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }] });
    const survived = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, TOUGH), attackerIds: [idsOf(tab, LEGOLAS)] }, tab.ctx);
    expect(triggers(survived.state, tab)).not.toContain("143005:response:1");
    const without = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, GIMLI)] }, tab.ctx);
    expect(triggers(without.state, tab)).not.toContain("143005:response:1");
  });
});

describe("Quickbeam (143006:A:1, A:2)", () => {
  // "Cannot have restricted attachments. Enters play exhausted."
  lineSpec("143006:A:1", "enters play exhausted", (effects) => {
    const tab = table(effects, { heroes: [{ code: TREEBEARD, seat: 0 }], hand: [{ code: QUICKBEAM, seat: 0 }] });
    const run = play(tab, QUICKBEAM);
    expect(run.state.cards[idsOf(tab, QUICKBEAM)]?.zone).toBe("play");
    expect(run.state.cards[idsOf(tab, QUICKBEAM)]?.exhausted).toBe(true);
  });

  lineSpec("143006:A:1", "a restricted attachment cannot go on him; it can on another character", (effects) => {
    const tab = table(effects, { heroes: [{ code: TACTICS, seat: 0 }], allies: [{ code: QUICKBEAM, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }] });
    const shield = idsOf(tab, SHIELD);
    const pay = payFor(tab.state, tab.ctx, shield);
    expect(refusal(tab.state, { type: "PlayCard", cardId: shield, hostId: idsOf(tab, QUICKBEAM), payments: pay }, tab.ctx)).toBe("That card cannot have that attachment");
    expect(refusal(tab.state, { type: "PlayCard", cardId: shield, hostId: idsOf(tab, TACTICS), payments: pay }, tab.ctx)).toBeNull();
  });

  // "Response: After Quickbeam enters play, deal 1 damage to him to ready him."
  lineSpec("143006:A:2", "after he enters play, 1 damage to him readies him", (effects) => {
    const tab = table(effects, { heroes: [{ code: TREEBEARD, seat: 0 }], hand: [{ code: QUICKBEAM, seat: 0 }] });
    const quickbeam = idsOf(tab, QUICKBEAM);
    const run = play(tab, QUICKBEAM);
    const { state } = send(run, { type: "Trigger", cardId: quickbeam, effectId: "143006:response:1" }, tab.ctx);
    expect(state.cards[quickbeam]?.damage).toBe(1);
    expect(state.cards[quickbeam]?.exhausted).toBe(false);
  });

  // The 1 damage is the cost of Quickbeam's Response: its step names the line as the cause (`send` checks it).
  it("143006:A:2 names the line as the cause of the 1 damage it deals", () => {
    const tab = table(EFFECTS, { heroes: [{ code: TREEBEARD, seat: 0 }], hand: [{ code: QUICKBEAM, seat: 0 }] });
    const run = play(tab, QUICKBEAM);
    send(run, { type: "Trigger", cardId: idsOf(tab, QUICKBEAM), effectId: "143006:response:1" }, tab.ctx);
  });
});

describe("Háma (143007:A:1)", () => {
  // "Combat Action: Ready Háma. He gets +3 Defense until the end of the phase. At the end of the phase, discard Háma. (Limit once per round.)"
  lineSpec("143007:A:1", "readies him with +3 Defense, once a round, and discards him at the end of the phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODEN, seat: 0 }], allies: [{ code: HAMA, seat: 0 }], engaged: [{ code: TOUGH, seat: 0 }] });
    const hama = idsOf(tab, HAMA);
    const defense = stat(tab.state, tab, hama, "defense");
    let run = combat(updateCard(tab.state, hama, { exhausted: true }), tab);
    run = send(run, { type: "Trigger", cardId: hama, effectId: "143007:action:1" }, tab.ctx);
    expect(run.state.cards[hama]?.exhausted).toBe(false);
    expect(stat(run.state, tab, hama, "defense")).toBe(defense + 3);
    expect(triggers(run.state, tab)).not.toContain("143007:action:1");
    // The combat phase ends.
    run = nextPhase(run, tab, "refresh");
    expect(run.state.cards[hama]?.zone).toBe("discard");
  });

  lineSpec("143007:A:1", "is a Combat Action: offered in the combat phase only", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODEN, seat: 0 }], allies: [{ code: HAMA, seat: 0 }], engaged: [{ code: TOUGH, seat: 0 }] });
    const hama = idsOf(tab, HAMA);
    expect(triggers(tab.state, tab)).not.toContain("143007:action:1");
    expect(triggers(combat(updateCard(tab.state, hama, { exhausted: true }), tab).state, tab)).toContain("143007:action:1");
  });
});
