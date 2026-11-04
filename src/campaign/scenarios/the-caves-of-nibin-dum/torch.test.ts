// Rules: rr.action, rr.exhausted, rr.travel, rr.engaged, rr.cancel, rr.step-6-2, rr.explored, rr.step-6-8-3 (data/rules/entries.json). The Cave Torch (41029) and the cards that read
// it (Cavern Warg 41031, Lightless Passage 41033, Lost in the Dark 41039), and Cracked Pillar (41028), on a table of plain-number heroes (test/scenarios/the-caves-of-nibin-dum/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { legalAttackEnemies } from "../../../rules/combat/combat.ts";
import { legalIntents, legalTargets } from "../../../rules/engine/legal.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { expireModifiers, type ScenarioState } from "../../../rules/core/state.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { codesIn, fight, loadCavesWorld, cavesTable, resolveReveal, settleChoices, travelTo, type CavesLayout, type CavesWorld } from "../../../../test/scenarios/the-caves-of-nibin-dum/scene.ts";
import { first, type Run, send, start } from "../../../../test/harness/scene-kit.ts";

let world: CavesWorld;

beforeAll(async () => {
  world = await loadCavesWorld();
});

function make(layout: CavesLayout = {}) {
  const made = cavesTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;
const offerOf = (made: Table, state: ScenarioState, code: string, effectId?: string) =>
  legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && state.cards[intent.cardId]?.code === code && (effectId == null || intent.effectId === effectId)) as PlayerIntent | undefined;
const torchOf = (state: ScenarioState) => state.cards[first(state, "41029")];

describe("Cave Torch (41029:A:2, 41029:A:3)", () => {
  it("is attached to a hero and exhausts to place up to 3 progress on a Dark location, then the top encounter card is discarded (41029:A:2)", () => {
    const made = make({ attachments: ["41029"], staging: ["41032"], deck: ["41030", "f0"] });
    const offer = offerOf(made, made.state, "41029");
    if (offer?.type !== "Trigger") throw new Error("the Cave Torch is not offered");
    let run: Run = send(start(made.state), offer, made.ctx);
    // The amount is chosen: the largest.
    for (let guard = 0; guard < 6 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: run.state.window.options.at(-1) ?? "" }, made.ctx);
    expect(run.state.cards[first(run.state, "41032")]?.progress).toBe(3);
    expect(torchOf(run.state)?.exhausted).toBe(true);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("is not offered with no Dark location in play, or when it is exhausted", () => {
    const none = make({ attachments: ["41029"], staging: ["41028"] });
    expect(offerOf(none, none.state, "41029")).toBeUndefined();
    const spent = make({ attachments: ["41029"], staging: ["41032"] });
    const tired = { ...spent.state, cards: { ...spent.state.cards, [torchOf(spent.state)!.id]: { ...torchOf(spent.state)!, exhausted: true } } };
    expect(offerOf(spent, tired, "41029")).toBeUndefined();
  });

  it("discards the top encounter card after it exhausts, and an enemy goes to the staging area (41029:A:3)", () => {
    const enemy = make({ attachments: ["41029"], staging: ["41032"], deck: ["41030", "f0"] });
    const offer = offerOf(enemy, enemy.state, "41029");
    if (offer?.type !== "Trigger") throw new Error("not offered");
    let run: Run = send(start(enemy.state), offer, enemy.ctx);
    run = settleChoices(run, enemy.ctx);
    expect(codesIn(run.state, "staging")).toContain("41030");
    expect(codesIn(run.state, "encounterDiscard")).not.toContain("41030");
    const place = make({ attachments: ["41029"], staging: ["41032"], deck: ["41034", "f0"] });
    const offered = offerOf(place, place.state, "41029");
    if (offered?.type !== "Trigger") throw new Error("not offered");
    const other = settleChoices(send(start(place.state), offered, place.ctx), place.ctx);
    expect(codesIn(other.state, "encounterDiscard")).toContain("41034");
    expect(codesIn(other.state, "staging")).not.toContain("41034");
  });
});

describe("Lightless Passage (41033:A:1, 41033:A:2)", () => {
  it("cannot be traveled to unless a ready Cave Torch can be exhausted, and exhausts it (41033:A:1)", () => {
    const without = make({ staging: ["41033"], phase: "Travel" });
    expect(legalTargets(without.state, { type: "Travel" }, without.ctx)).not.toContain(first(without.state, "41033"));
    const ready = make({ staging: ["41033"], attachments: ["41029"], phase: "Travel" });
    expect(legalTargets(ready.state, { type: "Travel" }, ready.ctx)).toContain(first(ready.state, "41033"));
    const run = travelTo(ready.state, ready.ctx, "41033");
    expect(run.state.cards[first(run.state, "41033")]?.zone).toBe("activeLocation");
    // The Cave Torch was exhausted to pay (its Forced effect answered it: the encounter card on top of the deck is discarded), and readies in the refresh phase.
    const torch = torchOf(ready.state)?.id;
    expect(run.steps.some((step) => step.kind === "push" && step.frame === "forced" && step.cardId === torch)).toBe(true);
    const noTorch = make({ staging: ["41033"], attachments: ["41029"], phase: "Travel" });
    const tired = { ...noTorch.state, cards: { ...noTorch.state.cards, [torch ?? ""]: { ...torchOf(noTorch.state)!, exhausted: true } } };
    expect(legalTargets(tired, { type: "Travel" }, noTorch.ctx)).not.toContain(first(tired, "41033"));
  });

  it("cancels all combat damage dealt to the attacking enemy as a Shadow card (41033:A:2)", () => {
    const hit = fight(world, "41033", "grunt");
    const enemy = hit.run.state.cards[first(hit.run.state, "grunt")];
    expect(enemy?.damage).toBe(0);
    expect(hit.run.state.modifiers.some((modifier) => modifier.stat === "combatDamageCanceled")).toBe(false);
  });

  it("places no combat damage on an enemy that holds the Shadow's flag, and still places other damage (41033:A:2)", () => {
    // The fight above never lands damage on the attacker (a Shadow card's effect ends with the attack), so the flag is read directly.
    const made = make({ engaged: [{ code: "grunt", seat: 0 }] });
    const id = first(made.state, "grunt");
    const flagged = runInstruction(made.state, { verb: "ModifyStat", stat: "combatDamageCanceled", amount: 1, until: "endOfAttack", target: "self" }, { seat: 0, sourceId: id }, made.ctx, []);
    expect(flagged.modifiers.some((modifier) => modifier.stat === "combatDamageCanceled" && modifier.instanceId === id)).toBe(true);
    const steps: never[] = [];
    expect(placeDamage(flagged, id, 3, made.ctx.cards, steps, "combat", ruleCause("rr.step-6-4-3")).cards[id]?.damage).toBe(0);
    expect(steps).toEqual([]);
    expect(placeDamage(flagged, id, 3, made.ctx.cards, [], "framework", ruleCause("rr.damage")).cards[id]?.damage).toBe(3);
    expect(placeDamage(made.state, id, 3, made.ctx.cards, [], "combat", ruleCause("rr.step-6-4-3")).cards[id]?.damage).toBe(3);
  });
});

describe("Lost in the Dark (41039:A:1, 41039:A:2)", () => {
  it("has the player who controls the Cave Torch exhaust it (41039:A:1)", () => {
    const made = make({ attachments: ["41029"] });
    const run = resolveReveal(made.state, made.ctx, "41039", () => "exhaust");
    expect(torchOf(run.state)?.exhausted).toBe(true);
    expect(run.state.modifiers.some((modifier) => modifier.stat === "noQuestProgress")).toBe(false);
  });

  it("or stops progress on the quest until the end of the phase, with the active location still taking it (41039:A:1)", () => {
    const made = make({ attachments: ["41029"], active: "place" });
    const run = resolveReveal(made.state, made.ctx, "41039", () => "noProgress");
    expect(torchOf(run.state)?.exhausted).toBe(false);
    expect(run.state.modifiers.some((modifier) => modifier.stat === "noQuestProgress" && modifier.until === "endOfPhase")).toBe(true);
  });

  it("holds the flag on the table, so no progress goes on the quest until the phase ends (41039:A:1)", () => {
    const made = make({ attachments: ["41029"] });
    const run = resolveReveal(made.state, made.ctx, "41039", () => "noProgress");
    expect(run.state.modifiers.some((modifier) => modifier.stat === "noQuestProgress" && modifier.instanceId === "table")).toBe(true);
    const stageId = run.state.questStage!;
    const before = run.state.cards[stageId]!.progress;
    const blocked = placeQuestProgress(run.state, 3, made.ctx.cards, [], () => false);
    expect(blocked.cards[stageId]?.progress).toBe(before);
    const later = placeQuestProgress(expireModifiers(run.state, ["endOfPhase"]), 3, made.ctx.cards, [], () => false);
    expect(later.cards[stageId]?.progress).toBe(before + 3);
    const free = make({ attachments: ["41029"] });
    expect(placeQuestProgress(free.state, 3, free.ctx.cards, [], () => false).cards[free.state.questStage!]?.progress).toBe(3);
  });

  it("offers only the second branch when the Torch is exhausted, and nothing when nobody has it", () => {
    const spent = make({ attachments: ["41029"] });
    const tired = { ...spent.state, cards: { ...spent.state.cards, [torchOf(spent.state)!.id]: { ...torchOf(spent.state)!, exhausted: true } } };
    const run = resolveReveal(tired, spent.ctx, "41039");
    expect(run.state.modifiers.some((modifier) => modifier.stat === "noQuestProgress")).toBe(true);
    const lone = make({});
    const none = resolveReveal(lone.state, lone.ctx, "41039");
    expect(none.state.modifiers.some((modifier) => modifier.stat === "noQuestProgress")).toBe(false);
  });

  it("only the controller of the Torch chooses with two players", () => {
    const made = make({ seats: 2, attachments: ["41029"] });
    const run = resolveReveal(made.state, made.ctx, "41039", () => "noProgress");
    expect(run.state.modifiers.filter((modifier) => modifier.stat === "noQuestProgress")).toHaveLength(1);
  });

  it("deals 1 damage to the defending character as a Shadow card (41039:A:2)", () => {
    const hit = fight(world, "41039", "grunt");
    // Attack 1 against Defense 2 deals nothing: the 1 damage is the Shadow's.
    expect(hit.run.state.cards[hit.hero]?.damage).toBe(1);
  });
});

describe("Cavern Warg (41031:A:1, 41031:A:2)", () => {
  it("may be answered by exhausting the Cave Torch: the attack is canceled and the Warg returns to the staging area (41031:A:1)", () => {
    const made = make({ attachments: ["41029"], engaged: [{ code: "41031", seat: 0 }], phase: "Combat", hand: ["filler"] });
    let run: Run = start(made.state);
    let offered: PlayerIntent | undefined;
    for (let guard = 0; guard < 30 && !offered; guard += 1) {
      offered = offerOf(made, run.state, "41031", "41031:response:1");
      if (offered) break;
      const intent = legalIntents(run.state, made.ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack");
      if (!intent) break;
      run = send(run, intent as PlayerIntent, made.ctx);
    }
    if (offered?.type !== "Trigger") throw new Error("the Warg's Response is never offered");
    run = settleChoices(send(run, offered, made.ctx), made.ctx);
    expect(torchOf(run.state)?.exhausted).toBe(true);
    expect(run.state.cards[first(run.state, "41031")]?.zone).toBe("staging");
    for (let guard = 0; guard < 10 && run.state.pendingAttack != null; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(run.state.pendingAttack).toBeNull();
    expect(Object.values(run.state.cards).filter((card) => card.zone === "heroes").every((card) => card.damage === 0)).toBe(true);
  });

  it("returns to the staging area after an attack that destroyed a character, as a Shadow card (41031:A:2)", () => {
    const hit = fight(world, "41031", "brute", { phase: "Encounter" });
    // Attack 9 against a hero with Defense 2 and 6 hit points destroys it; the attacker goes back to the staging area after the attack.
    expect(hit.run.state.cards[hit.hero]?.zone).toBe("discard");
    expect(hit.run.state.cards[first(hit.run.state, "brute")]?.zone).toBe("staging");
  });

  it("stays engaged after an attack that destroyed nobody (41031:A:2)", () => {
    const hit = fight(world, "41031", "grunt");
    expect(hit.run.state.cards[first(hit.run.state, "grunt")]?.zone).toBe("engaged");
  });
});

describe("Cracked Pillar (41028:A:1, 41028:A:2)", () => {
  // Passes the combat phase's windows until the player attack window opens.
  function toPlayerAttack(made: Table, state: ScenarioState): Run {
    let run: Run = start(state);
    for (let guard = 0; guard < 20 && run.state.window?.kind !== "playerAttack"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    return run;
  }

  it("can be attacked by the first player in the combat phase as if engaged, its Threat as its Defense (41028:A:1)", () => {
    const made = make({ staging: ["41028"], phase: "Combat" });
    const pillar = first(made.state, "41028");
    expect(modifiedStat(made.state, made.state.cards[pillar]!, "defense", made.ctx.cards)).toBe(2);
    let run = toPlayerAttack(made, made.state);
    expect(run.state.window?.kind).toBe("playerAttack");
    expect(legalAttackEnemies(run.state, 0, made.hero, made.ctx.cards)).toContain(pillar);
    run = send(run, { type: "DeclareAttackers", enemyId: pillar, attackerIds: [made.hero, made.hero2] }, made.ctx);
    for (let guard = 0; guard < 10 && run.state.pendingStrike != null; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    // Two heroes with Attack 2 each against Defense 2: 2 damage stays on the Pillar, which has no hit points to lose.
    expect(run.state.cards[pillar]?.damage).toBe(2);
    expect(run.state.cards[pillar]?.zone).toBe("staging");
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("cannot be attacked outside the combat phase, from the active location, or by a player who is not first (41028:A:1)", () => {
    const quest = make({ staging: ["41028"], phase: "Quest" });
    expect(legalAttackEnemies(quest.state, 0, quest.hero, quest.ctx.cards)).not.toContain(first(quest.state, "41028"));
    const active = make({ active: "41028", phase: "Combat" });
    expect(legalAttackEnemies(active.state, 0, active.hero, active.ctx.cards)).not.toContain(first(active.state, "41028"));
    // The second player's heroes cannot attack it: only the first player may declare the attack.
    const second = make({ seats: 2, staging: ["41028"], phase: "Combat" });
    const other = second.seat1Hero ?? "";
    expect(legalAttackEnemies(second.state, 1, other, second.ctx.cards)).not.toContain(first(second.state, "41028"));
    expect(legalAttackEnemies(second.state, 0, second.hero, second.ctx.cards)).toContain(first(second.state, "41028"));
  });

  it("needs 4 damage removed from it to travel there (41028:A:2)", () => {
    const bare = make({ staging: ["41028"], phase: "Travel" });
    expect(legalTargets(bare.state, { type: "Travel" }, bare.ctx)).not.toContain(first(bare.state, "41028"));
    const hurt = make({ staging: ["41028"], phase: "Travel", damage: [["41028", 5]] });
    expect(legalTargets(hurt.state, { type: "Travel" }, hurt.ctx)).toContain(first(hurt.state, "41028"));
    const run = travelTo(hurt.state, hurt.ctx, "41028");
    expect(run.state.cards[first(run.state, "41028")]?.zone).toBe("activeLocation");
    expect(run.state.cards[first(run.state, "41028")]?.damage).toBe(1);
  });
});
