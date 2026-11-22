// Rules: dcce.aflame, dcce.stormcaller-elite, dcce.last-player, rr.forced, rr.then, rr.shadow-effects, rr.step-1-2, rr.step-6-8-3, faq.enemy-attacks-outside-combat (data/rules/entries.json). The encounter
// card lines of Raid on the Grey Havens that need more than one card-spec row: a choice, a second player, a resource phase, a player attack, the false case of a condition. Each test that shows a record at work runs
// once on the authored records and once without the records of its line (`withoutLine`), and the second run must differ. Lines: 11037:B:2, 11037:B:3, 11064:A:2, 11065:A:2, 11067:A:1, 11067:A:2, 11078:A:3,
// 11079:A:2, 11188:A:2, 11188:A:4.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalIntents, reduce, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { attack, quest, resolve, reveal, withoutLine, type Act } from "../../../../test/harness/card-spec.ts";
import { idOf, revealFromTop, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "raid-on-the-grey-havens";
const played = (layout: Layout, act: Act | readonly Act[], effects: readonly Effect[] = EFFECTS) => play(SCENARIO, { line: "", layout, act, expect: [] }, effects, effects !== EFFECTS).run.state;
const tokens = (state: ScenarioState, code: string) => state.cards[idOf(state, code)];
const resources = (state: ScenarioState, code: string) => tokens(state, code)?.resources ?? 0;

describe("11064 Umbar Raider", () => {
  // FAULT: the card moves 1 resource from one of your heroes' pools; with no resource in any of them the engine still places 1 resource on Umbar Raider.
  it.fails("11064:A:2 gets no resource after it attacks when none of your heroes has a resource to move", () => {
    expect(resources(played({}, attack("11064")), "11064")).toBe(0);
  });
});

describe("11037 Sahír's Advance", () => {
  it("11037:B:2 gives a Raider revealed while side A's When Revealed resolves only side A's 1 resource", () => {
    // Side A: Na'asiyah and Captain Sahír join the staging area, each player reveals the top card (Umbar Raider), and each other Raider enemy in play gets 1 resource. Side B's line is not in force yet.
    const state = played({ stage: "11037", setAside: ["11076", "11078"], deck: ["11064", "f0"] }, resolve("11037", "whenRevealed"));
    expect(tokens(state, "11064")?.zone).toBe("staging");
    expect(resources(state, "11064")).toBe(1);
  });

  it("11037:B:2 gives no resource to a Raider added to the staging area by a search, not revealed", () => {
    // White Ship's Travel: search the encounter deck for a Corsair enemy and add it to the staging area.
    const state = played({ stage: "11037", deck: ["11064", "f0"] }, resolve("11045", "travel"));
    expect(tokens(state, "11064")?.zone).toBe("staging");
    expect(resources(state, "11064")).toBe(0);
  });

  it("11037:B:2 gives no resource to a revealed enemy that is no Raider", () => {
    expect(resources(played({ stage: "11037", deck: ["f0"] }, reveal("11040")), "11040")).toBe(0);
  });

  it("11037:B:3 does not win while a location in play has damage, the active location included", () => {
    expect(played({ stage: "11037", victory: ["11076"], staging: [{ code: "11039", damage: 1 }], deck: ["f0"] }, reveal("f0")).stageCleared).toBeFalsy();
    expect(played({ stage: "11037", victory: ["11076"], staging: ["11039"], active: { code: "11045", damage: 1 }, deck: ["f0"] }, reveal("f0")).stageCleared).toBeFalsy();
  });

  it("11037:B:3 does not win while Captain Sahír is in play, not in the victory display", () => {
    expect(played({ stage: "11037", engaged: ["11076"], staging: ["11039"], deck: ["f0"] }, reveal("f0")).stageCleared).toBeFalsy();
  });

  it("11037:B:3 wins once the progress the quest turns into healing removes the last damage", () => {
    // B:1 removes damage in place of the progress; Captain Sahír is in the victory display, so the last damage removed wins the game.
    const layout: Layout = { stage: "11037", victory: ["11076"], staging: [{ code: "11043", damage: 1 }], deck: ["f0"] };
    const healed = played(layout, quest("success"));
    expect(tokens(healed, "11043")?.damage ?? 0).toBe(0);
    expect(healed.stageCleared).toBe(true);
    expect(played(layout, quest("success"), withoutLine(EFFECTS, "11037:B:3")).stageCleared).toBeFalsy();
  });
});

describe("11065 Corsair Infiltrator", () => {
  // The resource phase begins: each hero collects 1 resource, then the Forced effect of the engaged player resolves.
  const collected = (layout: Layout, effects: readonly Effect[]): ScenarioState => {
    const made = tableFromLayout(SCENARIO, layout, { effects });
    return settle({ ...made.state, phase: "Resource", boundaryPhase: "Resource", mode: "resourceGrant", window: null }, made.ctx, []);
  };

  it("11065:A:2 takes 1 resource from a hero of the player it is engaged with, the second player, and none from the first player's heroes", () => {
    const layout: Layout = { seats: 2, engaged: [{ code: "11065", seat: 1 }] };
    const state = collected(layout, EFFECTS);
    expect(resources(state, "11065")).toBe(1);
    expect(resources(state, "dh3")).toBe(0);
    expect([resources(state, "dh1"), resources(state, "dh2")]).toEqual([1, 1]);
    expect(resources(collected(layout, withoutLine(EFFECTS, "11065:A:2")), "dh3")).toBe(1);
  });

  it("11065:A:2 takes nothing while it is in the staging area, engaged with no player", () => {
    const state = collected({ staging: ["11065"] }, EFFECTS);
    expect(resources(state, "11065")).toBe(0);
    expect([resources(state, "dh1"), resources(state, "dh2")]).toEqual([1, 1]);
  });
});

describe("11067 Battle-Hardened", () => {
  // Patrol Ship (905402, Corsair Ship): an engaged Ship enemy, which makes no attack.
  const revealed = (effects: readonly Effect[]) => {
    const made = tableFromLayout(SCENARIO, { engaged: ["905402"], deck: ["f0", "f0"] }, { effects, extra: ["905402"] });
    const steps: EngineStep[] = [];
    return { state: revealFromTop(made.state, made.ctx, "11067", steps).state, steps };
  };

  it("11067:A:1 gains surge when the only engaged enemy is a Ship, which does not attack", () => {
    const { state, steps } = revealed(EFFECTS);
    expect(state.staging.filter((id) => state.cards[id]?.code === "f0")).toHaveLength(1);
    expect(steps.some((step) => step.kind === "attack" && step.side === "enemy")).toBe(false);
    const without = revealed(withoutLine(EFFECTS, "11067:A:1")).state;
    expect(without.staging.filter((id) => without.cards[id]?.code === "f0")).toHaveLength(0);
  });

  it("11067:A:2 places no resource on an attacking enemy that is no Raider", () => {
    expect(resources(played({}, attack("f3", { shadow: "11067" })), "f3")).toBe(0);
  });
});

describe("11078 Na'asiyah", () => {
  // Both heroes (2 Attack each) attack her: 4 Attack against her 2 Defense and 1 resource.
  const attacked = (effects: readonly Effect[]) => {
    const made = tableFromLayout(SCENARIO, { phase: "PlayerAttacks", engaged: [{ code: "11078", seat: 0, resources: 1 }] }, { effects });
    const id = idOf(made.state, "11078");
    return { made, id, run: send(start(made.state), { type: "DeclareAttackers", enemyId: id, attackerIds: [made.hero, made.hero2] }, made.ctx) };
  };

  it("11078:A:3 defends with +1 Defense for each resource on her, for this attack only, and discards 1 resource after it", () => {
    const { made, id, run } = attacked(EFFECTS);
    const after = run.state.cards[id]!;
    expect(after.damage).toBe(1);
    expect(after.resources).toBe(0);
    expect(modifiedStat(run.state, after, "defense", made.cards)).toBe(2);
    expect(attacked(withoutLine(EFFECTS, "11078:A:3")).run.state.cards[id]?.damage).toBe(2);
  });
});

describe("11079 Na'asiyah, the objective ally", () => {
  // Umbar Raider (3 Attack) attacks the first player; Na'asiyah (2 Defense, 1 resource), whom the last player (the only one) controls, defends. The run stops in the first window that offers her Action.
  function defended(effects: readonly Effect[]): { run: Run; ally: string; ctx: ReturnType<typeof tableFromLayout>["ctx"] } {
    const made = tableFromLayout(SCENARIO, { phase: "Encounter", engaged: ["11064"], play: [{ code: "11079", seat: 0, resources: 1 }], deck: ["f0", "f0"] }, { effects, extra: ["11079"] });
    const ally = idOf(made.state, "11079");
    let run: Run = start(made.state);
    for (let guard = 0; guard < 40 && run.state.window?.kind !== "defense"; guard += 1) {
      const next = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineEngage");
      if (!next) break;
      run = send(run, next, made.ctx);
    }
    run = send(run, { type: "DeclareDefender", defenderId: ally }, made.ctx);
    return { run, ally, ctx: made.ctx };
  }
  const actionOf = (state: ScenarioState, ctx: ReturnType<typeof tableFromLayout>["ctx"], ally: string) => legalIntents(state, ctx).find((intent) => intent.type === "Trigger" && intent.cardId === ally && intent.effectId === "11079:action:2");

  it("11079:A:2 spends 1 resource from her while she defends to give her +2 Defense for this attack", () => {
    let { run, ally, ctx } = defended(EFFECTS);
    for (let guard = 0; guard < 10 && !actionOf(run.state, ctx, ally) && run.state.pendingAttack; guard += 1) run = send(run, { type: "Pass" }, ctx);
    const action = actionOf(run.state, ctx, ally);
    expect(action).toBeDefined();
    run = send(run, { ...(action as PlayerIntent), payments: [{ heroId: ally, amount: 1 }] } as PlayerIntent, ctx);
    if (run.state.window?.kind === "choose") run = send(run, { type: "Choose", optionId: "defense" }, ctx);
    expect(run.state.cards[ally]?.resources).toBe(0);
    for (let guard = 0; guard < 10 && run.state.pendingAttack; guard += 1) run = send(run, { type: "Pass" }, ctx);
    // 3 Attack against 2 + 2 Defense: no damage.
    expect(run.state.cards[ally]?.damage ?? 0).toBe(0);
  });

  it("11079:A:2 is not offered while she neither attacks nor defends", () => {
    const made = tableFromLayout(SCENARIO, { phase: "Planning", play: [{ code: "11079", seat: 0, resources: 1 }] }, { extra: ["11079"] });
    expect(actionOf(made.state, made.ctx, idOf(made.state, "11079"))).toBeUndefined();
  });
});

describe("11188 Graxar", () => {
  const attackers = (effects: readonly Effect[]) => {
    const made = tableFromLayout(SCENARIO, { phase: "PlayerAttacks", engaged: ["11188"] }, { effects });
    const graxar = idOf(made.state, "11188");
    return { made, graxar, both: reduce(made.state, { type: "DeclareAttackers", enemyId: graxar, attackerIds: [made.hero, made.hero2] }, made.ctx) };
  };

  it("11188:A:2 refuses two characters attacking him, and a second character the same round", () => {
    const { made, graxar, both } = attackers(EFFECTS);
    expect(both.ok).toBe(false);
    const one = reduce(made.state, { type: "DeclareAttackers", enemyId: graxar, attackerIds: [made.hero] }, made.ctx);
    expect(one.ok).toBe(true);
    const again = one.ok ? reduce({ ...one.state, window: { kind: "playerAttack" }, declaredAttacks: [] }, { type: "DeclareAttackers", enemyId: graxar, attackerIds: [made.hero2] }, made.ctx) : one;
    expect(again.ok).toBe(false);
    expect(attackers(withoutLine(EFFECTS, "11188:A:2")).both.ok).toBe(true);
  });

  it("11188:A:4 gets 1 resource for the shadow card his immediate attack is dealt outside the combat phase", () => {
    // Battle-Hardened places 1 resource on each Raider (Graxar is one), then he attacks and is dealt a shadow card (faq.enemy-attacks-outside-combat).
    const layout: Layout = { engaged: ["11188"], deck: ["f0", "f0", "f0"] };
    expect(resources(played(layout, reveal("11067")), "11188")).toBe(2);
    expect(resources(played(layout, reveal("11067"), withoutLine(EFFECTS, "11188:A:4")), "11188")).toBe(1);
  });
});
