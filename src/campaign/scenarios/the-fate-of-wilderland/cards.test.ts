// Rules: rr.engaged, rr.immune, mec109.immune-to-player-card-effects, rr.attacks-outside-the-combat-phase, rr.shadow-effects, rr.forced, rr.response, rr.victory, rr.effects (data/rules/entries.json); ledger lines 19155:A:1 to 19160:A:1.
// The Goblins' Assault, The Heroes' Defense, Urdug and the three enemies of the scenario's own set, on the scenario's scene: each record runs in a real state, and the triggers are announced the way the engine does.
import { beforeAll, describe, expect, it } from "vitest";

import { ruleCause } from "../../../rules/core/cause.ts";
import { modifiedStat, placeDamage, playerCardEffectCanChoose } from "../../../rules/core/keywords.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { CODES, FIGHT, fightTable, progressOn, resourcesOn, announce, codesIn, finish, idOf, legalIntents, legalTargets, loadWilderlandWorld, quest, resolveRecords, send, start, takes, wilderlandFight, wilderlandTable, type Run, type WilderlandWorld } from "../../../../test/scenarios/the-fate-of-wilderland/scene.ts";

let world: WilderlandWorld;
beforeAll(async () => {
  world = await loadWilderlandWorld();
}, 120_000);

type Layout = Parameters<typeof wilderlandTable>[1];
type Table = ReturnType<typeof wilderlandTable>;
const fight = (staging: NonNullable<Layout>["staging"] = [], extra: Layout = {}): Table => fightTable(world, staging, extra);
const stat = (state: ScenarioState, code: string, name: "attack" | "defense" | "engagementCost"): number => modifiedStat(state, state.cards[idOf(state, code)]!, name, world.cards);
const flags = (state: ScenarioState, code: string, ...names: Parameters<typeof flagged>[2][]): boolean[] => names.map((name) => flagged(state, idOf(state, code), name));
const damageTo = (state: ScenarioState, code: string, amount: number): number => placeDamage(state, idOf(state, code), amount, world.cards, [], "combat", ruleCause("rr.attacks-outside-the-combat-phase")).cards[idOf(state, code)]?.damage ?? 0;
const settled = (t: Table, state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, []);
// The state in the combat phase with the attacks resolved so far (the keys the engine writes: the enemy's id, or `id@seat` for an enemy that attacks each player).
const inCombat = (t: Table, resolved: readonly string[]): ScenarioState => syncConstants({ ...t.state, phase: "Combat", resolvedAttacks: resolved }, t.ctx);
// The combat phase played from its start, nobody defending, until the player attacks begin: the state the engine leaves once every enemy attack has resolved.
function enemyAttacksDone(t: Table): ScenarioState {
  let run: Run = start(t.state);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "playerAttack"; guard += 1) {
    const window = run.state.window;
    if (window?.kind === "defense") run = send(run, { type: "Undefended", heroId: run.state.seats[window.seat]?.heroes[0] ?? t.hero } as never, t.ctx);
    else if (window?.kind === "chooseEnemy") run = send(run, { type: "ChooseEnemy", enemyId: window.options[0] ?? "" }, t.ctx);
    else {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
      if (!pass) break;
      run = send(run, pass as never, t.ctx);
    }
  }
  expect(run.state.window?.kind).toBe("playerAttack");
  return run.state;
}
// Threat enough in the staging area to fail the quest: the heroes' two Willpowers come to less.
const FAILING = [CODES.goblinTroop, CODES.packOfWargs, CODES.strayGoblin];

describe("19155 The Goblins' Assault", () => {
  it("19155:A:1 Urdug gets +2 Defense for each other enemy in play, in the staging area or engaged", () => {
    const base = world.cards.get(CODES.urdug)?.defense ?? 0;
    expect(stat(fight().state, CODES.urdug, "defense")).toBe(base);
    expect(stat(fight([CODES.goblinTroop]).state, CODES.urdug, "defense")).toBe(base + 2);
    expect(stat(fight([CODES.goblinTroop, CODES.strayGoblin]).state, CODES.urdug, "defense")).toBe(base + 4);
    const engaged = wilderlandTable(world, { staging: [...FIGHT, CODES.strayGoblin], engaged: [{ code: CODES.goblinTroop, seat: 0 }, { code: CODES.packOfWargs, seat: 0 }] });
    expect(stat(engaged.state, CODES.urdug, "defense")).toBe(base + 6);
  });

  it("19155:A:1 Urdug cannot be dealt damage unless he has resolved an attack this phase", () => {
    const t = fight([CODES.goblinTroop]);
    // Out of the combat phase he has resolved none.
    expect(flags(t.state, CODES.urdug, "cannotTakeDamage")).toEqual([true]);
    expect(damageTo(t.state, CODES.urdug, 3)).toBe(0);
    // In the combat phase before he attacks, still none.
    expect(damageTo(inCombat(t, []), CODES.urdug, 3)).toBe(0);
    // After another enemy's attack, played for real, he has still not attacked.
    const other = enemyAttacksDone(wilderlandTable(world, { phase: "Combat", staging: [...FIGHT], engaged: [{ code: CODES.goblinTroop, seat: 0 }], deck: ["f0", "f0", "f0"] }));
    expect(other.resolvedAttacks).toEqual([idOf(other, CODES.goblinTroop)]);
    expect(damageTo(other, CODES.urdug, 3)).toBe(0);
    // After his own attack, played for real (5 resources for each player on The Heroes' Defense make him attack each player), the damage lands: against the one player, and against each.
    for (const seats of [1, 2] as const) {
      const attacked = enemyAttacksDone(wilderlandTable(world, { seats, phase: "Combat", staging: [CODES.theGoblinsAssault, { code: CODES.theHeroesDefense, resources: 5 * seats }, CODES.urdug], deck: ["f0", "f0", "f0", "f0"] }));
      expect(attacked.resolvedAttacks.map((key) => key.split("@")[0]), `${seats} seats`).toContain(idOf(attacked, CODES.urdug));
      expect(damageTo(attacked, CODES.urdug, 3), `${seats} seats`).toBe(3);
    }
    // The next phase is a new phase: the attacks of the combat phase do not count in it.
    const attacked = enemyAttacksDone(wilderlandTable(world, { phase: "Combat", staging: [CODES.theGoblinsAssault, { code: CODES.theHeroesDefense, resources: 5 }, CODES.urdug], deck: ["f0", "f0", "f0"] }));
    expect(flags(syncConstants({ ...attacked, phase: "Refresh" }, t.ctx), CODES.urdug, "cannotTakeDamage")).toEqual([true]);
  });

  it("19155:A:1 another enemy takes damage as usual", () => {
    const t = fight([CODES.goblinTroop]);
    expect(damageTo(t.state, CODES.goblinTroop, 2)).toBe(2);
  });

  it("19155:A:2 Forced: after the players quest unsuccessfully, it gets 1 progress for each player, once", () => {
    for (const seats of [1, 2] as const) {
      const t = fight(FAILING, { seats, stage: "19168", threat: [30, 30] });
      const run = quest(t, t.state);
      expect(progressOn(run.state, CODES.theGoblinsAssault), `${seats} seats`).toBe(seats);
    }
  });

  it("19155:A:2 it gets none when the players quest successfully", () => {
    const t = fight([], { stage: "19168" });
    expect(progressOn(quest(t, t.state).state, CODES.theGoblinsAssault)).toBe(0);
  });
});

describe("19156 The Heroes' Defense", () => {
  it("19156:A:1 with 5 resources for each player on it, Urdug is considered engaged with each player and adds no Threat to the staging area", () => {
    const names = ["engagedWithAll", "attackableByAny", "noThreatContribution"] as const;
    for (const [seats, needed] of [[1, 5], [2, 10]] as const) {
      const few = wilderlandTable(world, { seats, staging: [CODES.theGoblinsAssault, { code: CODES.theHeroesDefense, resources: needed - 1 }, CODES.urdug] });
      expect(flags(few.state, CODES.urdug, ...names), `${seats} seats, ${needed - 1} resources`).toEqual([false, false, false]);
      const enough = wilderlandTable(world, { seats, staging: [CODES.theGoblinsAssault, { code: CODES.theHeroesDefense, resources: needed }, CODES.urdug] });
      expect(flags(enough.state, CODES.urdug, ...names), `${seats} seats, ${needed} resources`).toEqual([true, true, true]);
    }
  });

  it("19156:A:1 Urdug engaged with each player can be attacked by any character, and attacks each player in the combat phase", () => {
    const t = wilderlandTable(world, { phase: "PlayerAttacks", staging: [CODES.theGoblinsAssault, { code: CODES.theHeroesDefense, resources: 5 }, CODES.urdug] });
    const attack = send(start(t.state), { type: "DeclareAttackers", enemyId: idOf(t.state, CODES.urdug), attackerIds: [t.hero] } as never, t.ctx);
    expect(attack.steps.flat().map((step) => step.kind)).toContain("attack");
    const few = wilderlandTable(world, { phase: "PlayerAttacks", staging: [CODES.theGoblinsAssault, { code: CODES.theHeroesDefense, resources: 4 }, CODES.urdug] });
    expect(() => send(start(few.state), { type: "DeclareAttackers", enemyId: idOf(few.state, CODES.urdug), attackerIds: [few.hero] } as never, few.ctx)).toThrow();
  });

  it("19156:A:2 Response: after an enemy is destroyed, the players may place 1 resource on it, whichever enemy it is", () => {
    for (const code of [CODES.goblinTroop, CODES.strayGoblin]) {
      const t = fight([code]);
      const id = idOf(t.state, code);
      const lethal = settled(t, updateCard(t.state, id, { damage: world.cards.get(code)?.health ?? 1 }));
      const offer = legalIntents(lethal, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(t.state, CODES.theHeroesDefense));
      expect(offer, code).toBeDefined();
      const run = finish(send({ state: lethal, steps: [] }, offer as never, t.ctx), t.ctx);
      expect(resourcesOn(run.state, CODES.theHeroesDefense), code).toBe(1);
    }
  });

  it("19156:A:2 the resource is placed on The Heroes' Defense itself", () => {
    const t = fight();
    const run = resolveRecords(t.state, t.ctx, CODES.theHeroesDefense, "response", idOf(t.state, CODES.theHeroesDefense));
    expect(resourcesOn(run.state, CODES.theHeroesDefense)).toBe(1);
  });
});

describe("19157 Urdug", () => {
  it("19157:A:1 he is immune to player card effects and cannot be engaged: he cannot leave the staging area", () => {
    const t = fight();
    expect(playerCardEffectCanChoose(world.cards.get(CODES.urdug)!, t.state, idOf(t.state, CODES.urdug))).toBe(false);
    expect(flags(t.state, CODES.urdug, "cannotBeEngaged")).toEqual([true]);
    // The player's threat is high enough to engage anything: the Vanguard can be engaged, Urdug cannot.
    const open = wilderlandTable(world, { phase: "Encounter", threat: [49, 49], staging: [...FIGHT, CODES.fierceVanguard] });
    const targets = legalTargets(open.state, { type: "Engage" }, open.ctx);
    expect(targets).toContain(idOf(open.state, CODES.fierceVanguard));
    expect(targets).not.toContain(idOf(open.state, CODES.urdug));
  });

  it("19157:A:2 Forced: when he attacks, the top card of the encounter deck is discarded and its printed Threat is added to his Attack for this attack", () => {
    const base = world.cards.get(CODES.urdug)?.attack ?? 0;
    for (const [top, threat] of [[CODES.goblinTroop, 3], [CODES.packOfWargs, 4], [CODES.darkClouds, 0]] as const) {
      const t = fight([], { deck: [top, "f0"] });
      const run = announce(t, t.state, { trigger: "attacks", seat: 0, cardId: idOf(t.state, CODES.urdug) });
      expect(codesIn(run.state, "encounterDiscard"), top).toEqual([top]);
      expect(stat(run.state, CODES.urdug, "attack"), top).toBe(base + threat);
    }
  });

  it("19157:A:2 the bonus ends with the attack", () => {
    const t = fight([], { deck: [CODES.goblinTroop] });
    const urdug = idOf(t.state, CODES.urdug);
    const run = announce(t, t.state, { trigger: "attacks", seat: 0, cardId: urdug });
    expect(run.state.modifiers.some((modifier) => modifier.instanceId === urdug && modifier.stat === "attack" && modifier.until === "endOfAttack")).toBe(true);
  });

  it("19157:A:3 When he is destroyed, the players win the game", () => {
    const t = fight();
    const urdug = idOf(t.state, CODES.urdug);
    const hp = world.cards.get(CODES.urdug)?.health ?? 5;
    const alive = settled(t, updateCard(t.state, urdug, { damage: hp - 1 }));
    expect(alive.stageCleared).toBeFalsy();
    // Damage reaches him only after an attack this phase: the Assault bars the rest.
    const attacked = syncConstants({ ...t.state, phase: "Combat", resolvedAttacks: [urdug] }, t.ctx);
    const dealt = placeDamage(attacked, urdug, hp, world.cards, [], "combat", ruleCause("rr.attacks-outside-the-combat-phase"));
    const won = settled(t, dealt);
    expect(won.stageCleared).toBe(true);
    expect(won.lost).toBeFalsy();
  });
});

describe("19158 Urdug's Elite", () => {
  const elite = (): Table => fight([CODES.urdugSElite]);
  const engaged = (t: Table, seat = 0) => ({ trigger: "engaged" as const, seat, cardId: idOf(t.state, CODES.urdugSElite) });

  it("19158:A:1 Forced: after it engages you, you either exhaust a character you control or place 1 progress on The Goblins' Assault", () => {
    const t = elite();
    const exhaust = announce(t, t.state, engaged(t), takes("exhaust"));
    expect(exhaust.state.cards[t.hero]?.exhausted || exhaust.state.cards[t.hero2]?.exhausted).toBe(true);
    expect(progressOn(exhaust.state, CODES.theGoblinsAssault)).toBe(0);
    const progress = announce(t, t.state, engaged(t), takes("progress"));
    expect(progressOn(progress.state, CODES.theGoblinsAssault)).toBe(1);
    expect(progress.state.cards[t.hero]?.exhausted).toBe(false);
  });

  it("19158:A:1 with no ready character to exhaust the progress is placed", () => {
    const t = elite();
    const tired = updateCard(updateCard(t.state, t.hero, { exhausted: true }), t.hero2, { exhausted: true });
    const run = announce(t, tired, engaged(t));
    expect(progressOn(run.state, CODES.theGoblinsAssault)).toBe(1);
  });

  it("19158:A:2 Shadow: exhaust a character you control", () => {
    const made = wilderlandFight(world, CODES.urdugSElite, "f3", { staging: FIGHT }, { undefended: true });
    expect([made.run.state.cards[made.made.hero]?.exhausted, made.run.state.cards[made.made.hero2]?.exhausted].filter(Boolean)).toHaveLength(1);
  });
});

describe("19159 Fierce Vanguard", () => {
  const vanguard = (): Table => fight([CODES.fierceVanguard]);
  const engaged = (t: Table) => ({ trigger: "engaged" as const, seat: 0, cardId: idOf(t.state, CODES.fierceVanguard) });

  it("19159:A:1 Forced: after it engages you, either it gets +2 Attack until the end of the round or you place 1 progress on The Goblins' Assault", () => {
    const t = vanguard();
    const base = world.cards.get(CODES.fierceVanguard)?.attack ?? 0;
    const attack = announce(t, t.state, engaged(t), takes("attack"));
    expect(stat(attack.state, CODES.fierceVanguard, "attack")).toBe(base + 2);
    expect(progressOn(attack.state, CODES.theGoblinsAssault)).toBe(0);
    const progress = announce(t, t.state, engaged(t), takes("progress"));
    expect(stat(progress.state, CODES.fierceVanguard, "attack")).toBe(base);
    expect(progressOn(progress.state, CODES.theGoblinsAssault)).toBe(1);
  });

  it("19159:A:2 Shadow: the attacking enemy gets +2 Attack and +2 Defense until the end of the phase", () => {
    const made = wilderlandFight(world, CODES.fierceVanguard, "f3", {}, { undefended: true });
    const enemy = idOf(made.run.state, "f3");
    const bonus = (name: string): number => made.run.state.modifiers.filter((modifier) => modifier.instanceId === enemy && modifier.stat === name).reduce((sum, modifier) => sum + modifier.amount, 0);
    expect(bonus("attack")).toBe(2);
    expect(bonus("defense")).toBe(2);
    expect(made.run.state.modifiers.filter((modifier) => modifier.instanceId === enemy).every((modifier) => modifier.until === "endOfPhase")).toBe(true);
  });
});

describe("19160 Warg-rider", () => {
  it("19160:A:1 Forced: after it is dealt a shadow card with no effect, it returns to the staging area or The Goblins' Assault gets 1 progress", () => {
    const t = wilderlandTable(world, { staging: FIGHT, engaged: [{ code: CODES.wargRider, seat: 0 }] });
    const id = idOf(t.state, CODES.wargRider);
    const event = { trigger: "attackResolved" as const, seat: 0, cardId: id, shadowBlank: true as const };
    const back = announce(t, t.state, event, takes("staging"));
    expect(back.state.cards[id]?.zone).toBe("staging");
    expect(progressOn(back.state, CODES.theGoblinsAssault)).toBe(0);
    const stays = announce(t, t.state, event, takes("progress"));
    expect(stays.state.cards[id]?.zone).toBe("engaged");
    expect(progressOn(stays.state, CODES.theGoblinsAssault)).toBe(1);
  });

  it("19160:A:1 a shadow card with an effect (or none dealt) asks nothing", () => {
    const t = wilderlandTable(world, { staging: FIGHT, engaged: [{ code: CODES.wargRider, seat: 0 }] });
    const run = announce(t, t.state, { trigger: "attackResolved", seat: 0, cardId: idOf(t.state, CODES.wargRider) });
    expect(run.state.window?.kind).not.toBe("choose");
    expect(progressOn(run.state, CODES.theGoblinsAssault)).toBe(0);
    expect(run.state.cards[idOf(t.state, CODES.wargRider)]?.zone).toBe("engaged");
  });
});
