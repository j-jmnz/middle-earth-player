// Rules: emce.dragon-signs, emce.caves-deck, emce.deep, emce.immune, rr.victory, rr.quest-advancement, rr.engaged, rr.search, rr.attacks-outside-the-combat-phase, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 19022:A:1 to 19025:B:3.
// The four stages of The Withered Heath on the scenario's scene: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { placeDamage } from "../../../rules/core/keywords.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { CODES, codesIn, finish, heathTable, idOf, legalIntents, legalTargets, loadHeathWorld, resolveRecords, send, start, type HeathWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/the-withered-heath/scene.ts";

let world: HeathWorld;
beforeAll(async () => {
  world = await loadHeathWorld();
}, 120_000);

type Layout = Parameters<typeof heathTable>[1];
const SIGNS = (n: number): string[] => Array.from({ length: n }, () => CODES.dragonSign);
const CAVES = [CODES.lostArmory, CODES.ancientTreasury, CODES.frightfulDen, CODES.lightlessGrotto, CODES.crumblingCavern, CODES.undergroundLake];
const cavesOf = (state: ScenarioState): (string | undefined)[] => (state.piles?.cavesDeck ?? []).map((id) => state.cards[id]?.code);
// The option the card with this code stands for, among the cards a choice offers.
const takes = (code: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((id) => state.cards[id]?.code === code) ?? state.window.options[0] ?? "") : "");
const damageOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.damage ?? 0;
const hurt = (state: ScenarioState, id: string, amount: number, source: "combat" | "framework" = "combat"): ScenarioState => placeDamage(state, id, amount, world.cards, [], source, UNATTRIBUTED);

describe("19022 Searching for Dragon Sign (stage 1)", () => {
  it("19022:A:1 Setup: the Caves deck is created, 2 of the 4 set-aside Dragon Signs are shuffled into it and a location for each player is added to the staging area", () => {
    for (const seats of [1, 2] as const) {
      const t = heathTable(world, { seats, setAside: [CODES.coldDrake, ...SIGNS(4)], caves: CAVES, deck: ["f0", CODES.mountainPass, "f3", CODES.caveEntrance, "treachery", CODES.creatureDen] });
      const run = resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? undefined);
      const caves = cavesOf(run.state);
      expect(caves, `${seats} seats`).toHaveLength(8);
      expect(caves.filter((code) => code === CODES.dragonSign)).toHaveLength(2);
      expect(codesIn(run.state, "setAside").filter((code) => code === CODES.dragonSign)).toHaveLength(2);
      expect(codesIn(run.state, "setAside")).toContain(CODES.coldDrake);
      const staged = codesIn(run.state, "staging");
      expect(staged, `${seats} seats`).toHaveLength(seats);
      for (const code of staged) expect(world.cards.get(code)?.type).toBe("location");
    }
  });

  it("19022:A:1 the Caves deck is shuffled with the game's seed: the same cards, in an order the seed decides", () => {
    const orders = [3, 4, 5].map((seed) => {
      const t = heathTable(world, { seed, setAside: SIGNS(4), caves: CAVES, deck: [CODES.mountainPass] });
      return cavesOf(resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? undefined).state).join();
    });
    expect(new Set(orders).size).toBeGreaterThan(1);
    const again = heathTable(world, { seed: 3, setAside: SIGNS(4), caves: CAVES, deck: [CODES.mountainPass] });
    expect(cavesOf(resolveRecords(again.state, again.ctx, CODES.stage1, "setup", again.state.questStage ?? undefined).state).join()).toBe(orders[0]);
  });

  it("19022:B:1 after the active location is explored the first player looks at the top 3 cards of the encounter deck, reveals 1 and discards the rest", () => {
    const t = heathTable(world, { deck: [CODES.heavySnow, "f3", "treachery", "f0", "place"] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage1, "forced", t.state.questStage ?? undefined, takes("f3"));
    // The other two looked at are discarded, the one chosen is revealed (an enemy: added to the staging area), and the cards below stay.
    expect(codesIn(run.state, "encounterDiscard")).toEqual([CODES.heavySnow, "treachery"].sort());
    expect(codesIn(run.state, "staging")).toContain("f3");
    expect(codesIn(run.state, "encounterDeck")).toEqual(["f0", "place"].sort());
  });

  it("19022:B:1 fires after the active location is explored by questing", () => {
    const qp = world.cards.get(CODES.lostArmory)?.questPoints ?? 3;
    const t = heathTable(world, { stage: "19022", active: CODES.lostArmory, deck: ["f0", "f3", "place", "treachery", "f0"], victory: SIGNS(0) });
    const armory = idOf(t.state, CODES.lostArmory);
    const nearly = updateCard(t.state, armory, { progress: qp - 1 });
    let run = send(start(nearly), { type: "Commit", cardIds: [t.hero, t.hero2] }, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    for (let guard = 0; guard < 12 && run.state.window?.kind !== "choose" && run.state.cards[armory]?.zone === "activeLocation"; guard += 1) {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, t.ctx);
    }
    // The location was explored (the victory display or the discard pile), and the stage's Forced effect asks which of the 3 cards looked at is revealed.
    expect(run.state.cards[armory]?.zone).not.toBe("activeLocation");
    expect(run.state.window?.kind).toBe("look");
    run = send(run, { type: "Pass" }, t.ctx);
    expect(run.state.window?.kind).toBe("choose");
    const asked = run.state.window?.kind === "choose" ? run.state.window.options.map((id) => run.state.cards[id]?.code) : [];
    expect(asked.length).toBeGreaterThan(0);
  });

  it("19022:B:2 the stage cannot be defeated unless at least 1 Dragon Sign is in the victory display", () => {
    const none = heathTable(world, { stage: "19022" });
    expect(restricted(none.state, none.ctx, "advance").length).toBeGreaterThan(0);
    const one = heathTable(world, { stage: "19022", victory: SIGNS(1) });
    expect(restricted(one.state, one.ctx, "advance")).toEqual([]);
    const other = heathTable(world, { stage: "19022", victory: [CODES.lostArmory] });
    expect(restricted(other.state, other.ctx, "advance").length).toBeGreaterThan(0);
  });
});

describe("19023 The Cold-Drake Attacks! (stage 2)", () => {
  const second = (layout: Layout = {}) => heathTable(world, { stage: "19023", ...layout });

  it("19023:A:1 the set-aside Cold-Drake is added to the staging area", () => {
    const t = heathTable(world, { stage: "19022", setAside: [CODES.coldDrake], staging: [] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage2, "whenRevealed", t.state.questStage ?? undefined);
    expect(codesIn(run.state, "staging")).toEqual([CODES.coldDrake]);
    expect(codesIn(run.state, "setAside")).toEqual([]);
  });

  it("19023:B:1 the Deep keyword is ignored", () => {
    const t = second({ phase: "Travel", staging: [CODES.dwarvenDoor], caves: [CODES.lostArmory] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.dwarvenDoor) }, t.ctx), t.ctx);
    expect(run.state.cards[run.state.activeLocation ?? ""]?.code).toBe(CODES.dwarvenDoor);
    expect(cavesOf(run.state)).toEqual([CODES.lostArmory]);
    // From stage 3 on it is not ignored.
    const later = heathTable(world, { stage: "19024", phase: "Travel", staging: [CODES.dwarvenDoor], caves: [CODES.lostArmory] });
    const replaced = finish(send(start(later.state), { type: "Travel", locationId: idOf(later.state, CODES.dwarvenDoor) }, later.ctx), later.ctx);
    expect(replaced.state.cards[replaced.state.activeLocation ?? ""]?.code).toBe(CODES.lostArmory);
  });

  it("19023:B:2 Cold-Drake stays in the staging area, adds no Threat to it and is considered engaged with each player", () => {
    const t = second({ staging: [CODES.coldDrake] });
    const drake = idOf(t.state, CODES.coldDrake);
    for (const flag of ["engagedWithAll", "cannotBeEngaged", "noThreatContribution", "attackableByAny", "indestructible"] as const) expect(flagged(t.state, drake, flag), flag).toBe(true);
    expect(stagingThreat(t.state, world.cards)).toBe(0);
    const first = heathTable(world, { stage: "19022", staging: [CODES.coldDrake] });
    expect(flagged(first.state, idOf(first.state, CODES.coldDrake), "engagedWithAll")).toBe(false);
    expect(stagingThreat(first.state, world.cards)).toBeGreaterThan(0);
  });

  it("19023:B:2 it attacks every player once in the combat phase and stays in the staging area", () => {
    const t = second({ seats: 2, phase: "Combat", staging: [CODES.coldDrake], deck: ["f0", "f0", "f0", "f0"] });
    const drake = idOf(t.state, CODES.coldDrake);
    let run: Run = start(t.state);
    const attacked: number[] = [];
    for (let guard = 0; guard < 80 && run.state.phase === "Combat"; guard += 1) {
      if (run.state.pendingAttack?.enemyId === drake && !attacked.includes(run.state.pendingAttack.seat)) attacked.push(run.state.pendingAttack.seat);
      if (run.state.window?.kind === "defense") {
        const target = legalTargets(run.state, { type: "Undefended" }, t.ctx)[0];
        run = send(run, { type: "Undefended", heroId: target }, t.ctx);
        continue;
      }
      const intent = legalIntents(run.state, t.ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack");
      if (!intent) break;
      run = send(run, intent as PlayerIntent, t.ctx);
    }
    expect(attacked).toEqual([0, 1]);
    expect(run.state.cards[drake]?.zone).toBe("staging");
  });

  it("19023:B:3 no more than 6 damage can be placed on Cold-Drake each round", () => {
    const t = second({ staging: [CODES.coldDrake] });
    const drake = idOf(t.state, CODES.coldDrake);
    const first = hurt(t.state, drake, 4);
    expect(first.cards[drake]?.damage).toBe(4);
    const second4 = hurt(first, drake, 4);
    expect(second4.cards[drake]?.damage).toBe(6);
    expect(hurt(second4, drake, 3).cards[drake]?.damage).toBe(6);
  });

  it("19023:B:3 it cannot have more than 18 damage, and is not destroyed at 18 (it cannot leave the staging area)", () => {
    const t = second({ staging: [{ code: CODES.coldDrake, damage: 16 }] });
    const drake = idOf(t.state, CODES.coldDrake);
    const full = hurt(t.state, drake, 5);
    expect(full.cards[drake]?.damage).toBe(18);
    expect(full.cards[drake]?.zone).toBe("staging");
    expect(hurt(full, drake, 5).cards[drake]?.damage).toBe(18);
    // From stage 3 and 4 the ceiling and the indestructibility are gone.
    const later = heathTable(world, { stage: "19025", staging: [{ code: CODES.coldDrake, damage: 16 }], victory: SIGNS(4) });
    expect(flagged(later.state, idOf(later.state, CODES.coldDrake), "indestructible")).toBe(false);
    expect(flagged(later.state, idOf(later.state, CODES.coldDrake), "damageCeiling")).toBe(false);
  });

  it("19023:B:4 the stage cannot be defeated while Cold-Drake has hit points remaining", () => {
    const wounded = second({ staging: [{ code: CODES.coldDrake, damage: 17 }] });
    expect(restricted(wounded.state, wounded.ctx, "advance").length).toBeGreaterThan(0);
    const dead = second({ staging: [{ code: CODES.coldDrake, damage: 18 }] });
    expect(restricted(dead.state, dead.ctx, "advance")).toEqual([]);
  });
});

describe("19024 Hunting the Beast (stage 3)", () => {
  const third = (layout: Layout = {}) => heathTable(world, { stage: "19024", ...layout });

  it("19024:A:1 two set-aside Dragon Signs are shuffled into the Caves deck, Cold-Drake is set aside with its damage, and a location for each player is added to the staging area", () => {
    for (const seats of [1, 2] as const) {
      const t = heathTable(world, { seats, stage: "19023", setAside: SIGNS(2), caves: [CODES.lostArmory, CODES.dragonSign, CODES.dragonSign], staging: [{ code: CODES.coldDrake, damage: 18, resources: 1 }, "f3"], discard: [CODES.mountainPass, CODES.creatureDen, "treachery"], deck: [CODES.caveEntrance] });
      const run = resolveRecords(t.state, t.ctx, CODES.stage3, "whenRevealed", t.state.questStage ?? undefined);
      expect(cavesOf(run.state).filter((code) => code === CODES.dragonSign), `${seats} seats`).toHaveLength(4);
      const drake = run.state.cards[idOf(run.state, CODES.coldDrake)]!;
      expect(drake).toMatchObject({ zone: "setAside", damage: 18, resources: 0 });
      // The discard pile was shuffled into the deck before the locations were found: a location for each player is added.
      expect(codesIn(run.state, "staging").filter((code) => world.cards.get(code)?.type === "location"), `${seats} seats`).toHaveLength(seats);
      expect(codesIn(run.state, "staging")).toContain("f3");
    }
  });

  it("19024:A:1 Cold-Drake in play again keeps the damage it was set aside with, and loses the tokens (but the damage) it had", () => {
    const t = heathTable(world, { stage: "19023", staging: [{ code: CODES.coldDrake, damage: 11, resources: 2, progress: 1 }], caves: [CODES.lostArmory], deck: [CODES.mountainPass] });
    const aside = resolveRecords(t.state, t.ctx, CODES.stage3, "whenRevealed", t.state.questStage ?? undefined);
    const drake = idOf(aside.state, CODES.coldDrake);
    expect(aside.state.cards[drake]).toMatchObject({ zone: "setAside", damage: 11, resources: 0, progress: 0 });
    const back = resolveRecords(aside.state, t.ctx, CODES.stage2, "whenRevealed", aside.state.questStage ?? undefined);
    expect(back.state.cards[drake]).toMatchObject({ zone: "staging", damage: 11 });
    // A card set aside by any other means (damage put on it by hand here) enters play clean, as every set-aside card does.
    const plain = heathTable(world, { stage: "19022", setAside: [CODES.coldDrake] });
    const hurtAside = updateCard(plain.state, idOf(plain.state, CODES.coldDrake), { damage: 5 });
    const entered = resolveRecords(hurtAside, plain.ctx, CODES.stage2, "whenRevealed", hurtAside.questStage ?? undefined);
    expect(damageOf(entered.state, CODES.coldDrake)).toBe(0);
  });

  it("19024:B:1 after the active location is explored the first player looks at the top 3 cards of the encounter deck, reveals 1 and discards the rest", () => {
    const t = third({ deck: ["f0", CODES.heavySnow, "f3", "place"] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage3, "forced", t.state.questStage ?? undefined, takes(CODES.heavySnow));
    // The treachery chosen is revealed and resolved (it goes to the discard pile after); the other two looked at were discarded before it.
    expect(codesIn(run.state, "encounterDiscard").sort()).toEqual(["f0", "f3", CODES.heavySnow].sort());
    expect(codesIn(run.state, "encounterDeck")).toEqual(["place"]);
  });

  it("19024:B:2 at the end of the round 3 damage tokens come off the set-aside Cold-Drake, to 0", () => {
    const t = third({ setAside: [CODES.coldDrake] });
    const drake = idOf(t.state, CODES.coldDrake);
    const rounds = [18, 15, 12, 9, 6, 3, 0, 0];
    let state = updateCard(t.state, drake, { damage: 18 });
    const seen: number[] = [];
    for (let round = 0; round < rounds.length; round += 1) {
      seen.push(state.cards[drake]?.damage ?? -1);
      state = resolveRecords(state, t.ctx, CODES.stage3, "forced", t.state.questStage ?? undefined, undefined, true).state;
    }
    // The Forced effect with the "endOfRound" trigger is the one under test; the Forced effect of "activeExplored" ran too and changed no damage.
    expect(seen).toEqual(rounds);
  });

  it("19024:B:2 a Cold-Drake in play is not healed by it", () => {
    const t = third({ staging: [{ code: CODES.coldDrake, damage: 9 }] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage3, "forced", t.state.questStage ?? undefined);
    expect(damageOf(run.state, CODES.coldDrake)).toBe(9);
  });

  it("19024:B:3 the stage cannot be defeated unless at least 3 Dragon Signs are in the victory display", () => {
    for (const [signs, blocked] of [[2, true], [3, false], [4, false]] as const) {
      const t = third({ victory: SIGNS(signs) });
      expect(restricted(t.state, t.ctx, "advance").length > 0, `${signs} signs`).toBe(blocked);
    }
  });
});

describe("19025 A Cornered Dragon (stage 4)", () => {
  const fourth = (layout: Layout = {}) => heathTable(world, { stage: "19025", ...layout });
  // Players attack the drake in the staging area or engaged: the rounds of attacks it makes, by the seat that defends.
  const attacksOf = (run: Run, t: ReturnType<typeof heathTable>, drake: string): { run: Run; seats: number[] } => {
    let current = run;
    const seats: number[] = [];
    for (let guard = 0; guard < 80 && (current.state.pendingAttack != null || current.state.stack.length > 0 || current.state.window?.kind === "defense"); guard += 1) {
      if (current.state.window?.kind === "defense") {
        if (current.state.pendingAttack?.enemyId === drake) seats.push(current.state.pendingAttack.seat);
        const target = legalTargets(current.state, { type: "Undefended" }, t.ctx)[0];
        current = send(current, { type: "Undefended", heroId: target }, t.ctx);
        continue;
      }
      const pass = legalIntents(current.state, t.ctx).find((item) => item.type === "Pass");
      if (!pass) break;
      current = send(current, pass as PlayerIntent, t.ctx);
    }
    return { run: current, seats };
  };

  it("19025:A:1 Cold-Drake is added to the staging area, keeping its damage, and makes an immediate attack against each player in turn order", () => {
    const t = heathTable(world, { seats: 2, stage: "19023", staging: [{ code: CODES.coldDrake, damage: 6 }], caves: [CODES.lostArmory], deck: ["f0", "f0", "f0", "f0"] });
    const away = resolveRecords(t.state, t.ctx, CODES.stage3, "whenRevealed", t.state.questStage ?? undefined);
    const drake = idOf(away.state, CODES.coldDrake);
    expect(away.state.cards[drake]).toMatchObject({ zone: "setAside", damage: 6 });
    const resolved = resolveRecords(away.state, t.ctx, CODES.stage4, "whenRevealed", away.state.questStage ?? undefined, undefined, true);
    expect(resolved.state.cards[drake]).toMatchObject({ zone: "staging", damage: 6 });
    const attacked = attacksOf(resolved, t, drake);
    expect(attacked.seats).toEqual([0, 1]);
  });

  it("19025:B:1 Cold-Drake cannot take more than X damage each round, X the Dragon Signs in the victory display", () => {
    for (const signs of [3, 4]) {
      const t = fourth({ staging: [CODES.coldDrake], victory: SIGNS(signs) });
      const drake = idOf(t.state, CODES.coldDrake);
      const first = hurt(t.state, drake, 2);
      expect(first.cards[drake]?.damage, `${signs} signs`).toBe(2);
      expect(hurt(first, drake, 9).cards[drake]?.damage, `${signs} signs`).toBe(signs);
    }
  });

  it("19025:B:2 at the beginning of the quest phase Cold-Drake returns to the staging area and makes an immediate attack against each player in turn order", () => {
    const t = fourth({ seats: 2, engaged: [{ code: CODES.coldDrake, seat: 0 }], deck: ["f0", "f0", "f0", "f0"] });
    const drake = idOf(t.state, CODES.coldDrake);
    const resolved = resolveRecords(t.state, t.ctx, CODES.stage4, "forced", t.state.questStage ?? undefined);
    expect(resolved.state.cards[drake]?.zone).toBe("staging");
    expect(attacksOf(resolved, t, drake).seats).toEqual([0, 1]);
  });

  it("19025:B:3 the stage cannot be defeated while Cold-Drake is in play", () => {
    const t = fourth({ engaged: [{ code: CODES.coldDrake, seat: 0 }] });
    expect(restricted(t.state, t.ctx, "advance").length).toBeGreaterThan(0);
    const staged = fourth({ staging: [CODES.coldDrake] });
    expect(restricted(staged.state, staged.ctx, "advance").length).toBeGreaterThan(0);
    // Before its When Revealed brings Cold-Drake in (it is set aside) the stage is not met either: it prints 0 quest points.
    const waiting = fourth({ setAside: [CODES.coldDrake] });
    expect(restricted(waiting.state, waiting.ctx, "advance").length).toBeGreaterThan(0);
    const defeated = fourth({ victory: [CODES.coldDrake] });
    expect(restricted(defeated.state, defeated.ctx, "advance")).toEqual([]);
  });

  it("19025:B:3 when Cold-Drake is defeated the players win the game, at the end of the phase", () => {
    const t = fourth({ phase: "PlayerAttacks", victory: SIGNS(4), engaged: [{ code: CODES.coldDrake, seat: 0, damage: 17 }] });
    const drake = idOf(t.state, CODES.coldDrake);
    const strong: ScenarioState = { ...t.state, modifiers: [...t.state.modifiers, { instanceId: t.hero, sourceId: t.hero, stat: "attack", amount: 9, until: "endOfPhase" }] };
    let run = finish(send(start(strong), { type: "DeclareAttackers", enemyId: drake, attackerIds: [t.hero] }, t.ctx), t.ctx);
    expect(run.state.cards[drake]?.zone).toBe("victory");
    expect(run.state.stageCleared).toBe(false);
    for (let guard = 0; guard < 30 && !run.state.stageCleared; guard += 1) {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
      if (!pass) break;
      run = finish(send(run, pass as PlayerIntent, t.ctx), t.ctx);
    }
    expect(run.state.stageCleared).toBe(true);
    expect(run.state.lost).toBe(false);
  });
});
