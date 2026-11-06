// Rules: rr.explored, rr.travel, rr.search, rr.engaged, rr.attacks-outside-the-combat-phase, rr.shadow-effects, rr.discard-pile-and-victory-display, rr.effects, rr.response (data/rules/entries.json); ledger lines 19161:A:2 to 19167:A:2.
// The locations and treacheries of The Fate of Wilderland's own set on the scenario's scene: each record runs in a real state, and the engine drives the explored locations, the quest and the attacks.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { expireModifiers, flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { pushEffectFrame } from "../../../rules/interpret/effect-frames.ts";
import { CODES, FIGHT, fightTable, progressOn, resourcesOn, STAGES, codesIn, finish, idOf, idsOf, legalIntents, loadWilderlandWorld, quest, resolveRecords, send, takes, wilderlandFight, wilderlandTable, type PlayerIntent, type Run, type WilderlandWorld } from "../../../../test/scenarios/the-fate-of-wilderland/scene.ts";

let world: WilderlandWorld;
beforeAll(async () => {
  world = await loadWilderlandWorld();
  world.cards.set("gear", definePrinted({ code: "gear", name: "gear", type: "attachment", sphere: "neutral", cost: 0 }));
}, 120_000);

type Layout = Parameters<typeof wilderlandTable>[1];
type Table = ReturnType<typeof wilderlandTable>;
const fight = (staging: NonNullable<Layout>["staging"] = [], extra: Layout = {}): Table => fightTable(world, staging, extra);
// The effect of a test runs as a frame of the card with this id, and the table settles: progress on the active location explores it.
function frame(state: ScenarioState, instructions: readonly Instruction[], sourceId: string, ctx: Table["ctx"], steps: EngineStep[] = []): ScenarioState {
  const pushed = pushEffectFrame(state, { frame: "ResolveEffect", sourceId, actor: 0, peril: false, effectId: "test", instructions, cancel: null, blockCancel: null }, steps);
  return settle({ ...pushed, window: null }, ctx, steps);
}
const explore = (t: Table): ScenarioState => frame(t.state, [{ verb: "PlaceProgressOn", amount: 99, target: "activeLocation" }], t.hero, t.ctx);
const offerOf = (state: ScenarioState, t: Table, cardId: string) => legalIntents(state, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === cardId);
// The attack in progress is played out: nobody defends, and each choice takes the first option.
function played(run: Run, t: Table): Run {
  let current = run;
  for (let guard = 0; guard < 40 && (current.state.pendingAttack != null || current.state.stack.length > 0 || current.state.window?.kind === "defense"); guard += 1) {
    if (current.state.window?.kind === "defense") current = send(current, { type: "Undefended", heroId: t.hero } as never, t.ctx);
    else if (current.state.window?.kind === "choose") current = send(current, { type: "Choose", optionId: current.state.window.options[0] ?? "" }, t.ctx);
    else {
      const pass = legalIntents(current.state, t.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      current = send(current, pass as PlayerIntent, t.ctx);
    }
  }
  return current;
}

describe("19161 Gate of Gundabad", () => {
  const placing = (t: Table): ScenarioState => resolveRecords(t.state, t.ctx, CODES.theHeroesDefense, "response", idOf(t.state, CODES.theHeroesDefense)).state;

  it("19161:A:2 while it is in the staging area resources cannot be placed on The Heroes' Defense", () => {
    expect(resourcesOn(placing(fight([CODES.gateOfGundabad])), CODES.theHeroesDefense)).toBe(0);
    expect(resourcesOn(placing(fight()), CODES.theHeroesDefense)).toBe(1);
    // As the active location it no longer bars them.
    expect(resourcesOn(placing(fight([], { active: CODES.gateOfGundabad })), CODES.theHeroesDefense)).toBe(1);
  });

  it("19161:A:2 resources already on The Heroes' Defense stay", () => {
    const t = wilderlandTable(world, { staging: [CODES.theGoblinsAssault, { code: CODES.theHeroesDefense, resources: 3 }, CODES.urdug, CODES.gateOfGundabad] });
    expect(flagged(t.state, idOf(t.state, CODES.theHeroesDefense), "noResourcesPlaced")).toBe(true);
    expect(resourcesOn(placing(t), CODES.theHeroesDefense)).toBe(3);
  });

  it("19161:A:3 Travel: a Goblin Troop is searched out of the encounter deck, its discard pile or the victory display and added to the staging area, and the encounter deck is shuffled", () => {
    for (const where of ["deck", "discard", "victory"] as const) {
      const t = fight([CODES.gateOfGundabad], { deck: where === "deck" ? ["f0", CODES.goblinTroop, "f3", "place"] : ["f0", "f3", "place"], discard: where === "discard" ? [CODES.goblinTroop] : [], victory: where === "victory" ? [CODES.goblinTroop] : [] });
      const run = resolveRecords(t.state, t.ctx, CODES.gateOfGundabad, "travel", idOf(t.state, CODES.gateOfGundabad));
      expect(codesIn(run.state, "staging").filter((code) => code === CODES.goblinTroop), where).toHaveLength(1);
      expect(codesIn(run.state, "encounterDeck").sort(), where).toEqual(["f0", "f3", "place"].sort());
      expect(run.state.cards[idOf(run.state, CODES.goblinTroop)]?.zone, where).toBe("staging");
      expect(codesIn(run.state, "victory"), where).not.toContain(CODES.goblinTroop);
      expect(codesIn(run.state, "encounterDiscard"), where).not.toContain(CODES.goblinTroop);
    }
  });

  it("19161:A:3 only one Goblin Troop is added, and nothing happens when there is none", () => {
    const many = fight([CODES.gateOfGundabad], { deck: [CODES.goblinTroop, CODES.goblinTroop], discard: [CODES.goblinTroop], victory: [CODES.goblinTroop] });
    const run = resolveRecords(many.state, many.ctx, CODES.gateOfGundabad, "travel", idOf(many.state, CODES.gateOfGundabad));
    expect(codesIn(run.state, "staging").filter((code) => code === CODES.goblinTroop)).toHaveLength(1);
    const none = fight([CODES.gateOfGundabad], { deck: ["f0", CODES.strayGoblin] });
    const unchanged = resolveRecords(none.state, none.ctx, CODES.gateOfGundabad, "travel", idOf(none.state, CODES.gateOfGundabad));
    expect(codesIn(unchanged.state, "staging").sort()).toEqual(codesIn(none.state, "staging").sort());
  });
});

describe("19162 Hilltop Battlements", () => {
  it("19162:A:1 while it is in the staging area each non-unique enemy gets -5 engagement cost", () => {
    const base = (code: string): number => world.cards.get(code)?.engagementCost ?? 0;
    const cost = (state: ScenarioState, code: string): number => modifiedStat(state, state.cards[idOf(state, code)]!, "engagementCost", world.cards);
    const t = fight([CODES.hilltopBattlements, CODES.goblinTroop]);
    expect(cost(t.state, CODES.goblinTroop)).toBe(base(CODES.goblinTroop) - 5);
    // A unique enemy is left alone, and so is an enemy when the location is not in the staging area.
    expect(cost(t.state, CODES.urdug)).toBe(base(CODES.urdug));
    const apart = fight([CODES.goblinTroop], { active: CODES.hilltopBattlements });
    expect(cost(apart.state, CODES.goblinTroop)).toBe(base(CODES.goblinTroop));
  });

  it("19162:A:2 Forced: when it is explored the top X cards of the encounter deck are discarded, X the number of players, and each enemy among them is added to the staging area", () => {
    for (const [seats, deck, staged, discarded] of [
      [1, [CODES.goblinTroop, "f0"], [CODES.goblinTroop], []],
      [1, ["place", CODES.goblinTroop], [], ["place"]],
      [2, [CODES.goblinTroop, CODES.strayGoblin, "f3"], [CODES.goblinTroop, CODES.strayGoblin], []],
      [2, ["place", "treachery", CODES.goblinTroop], [], ["place", "treachery"]],
    ] as const) {
      const t = fight([], { seats, active: CODES.hilltopBattlements, deck });
      const run = finish({ state: explore(t), steps: [] }, t.ctx);
      const after = codesIn(run.state, "staging").filter((code) => !FIGHT.includes(code));
      expect(after.sort(), `${seats} seats ${deck}`).toEqual([...staged].sort());
      // The explored location itself goes to the discard pile too.
      expect(codesIn(run.state, "encounterDiscard").filter((code) => code !== CODES.hilltopBattlements && !staged.includes(code as never)).sort(), `${seats} seats ${deck}`).toEqual([...discarded].sort());
      expect(codesIn(run.state, "encounterDeck"), `${seats} seats ${deck}`).toHaveLength(deck.length - seats);
    }
  });
});

describe("19163 Dwarven Watchtower", () => {
  const tower = (extra: Layout = {}, staging: NonNullable<Layout>["staging"] = []): Table => fight(staging, { active: CODES.dwarvenWatchtower, ...extra });

  it("19163:A:1 while it is the active location each hero gets +1 Defense", () => {
    const base = world.cards.get("dh1")?.defense ?? 2;
    const defense = (t: Table, hero: string): number => modifiedStat(t.state, t.state.cards[hero]!, "defense", world.cards);
    const active = tower();
    expect(defense(active, active.hero)).toBe(base + 1);
    expect(defense(active, active.hero2)).toBe(base + 1);
    const staged = fight([CODES.dwarvenWatchtower]);
    expect(defense(staged, staged.hero)).toBe(base);
  });

  it("19163:A:2 Response: after it is explored the first player chooses: either place 1 resource on The Heroes' Defense, or remove 1 progress from The Goblins' Assault", () => {
    const t = tower({ seats: 2 }, [CODES.goblinTroop]);
    const assault = idOf(t.state, CODES.theGoblinsAssault);
    const hurt = updateCard(t.state, assault, { progress: 3 });
    const explored = explore({ ...t, state: hurt });
    const offer = offerOf(explored, t, idOf(t.state, CODES.dwarvenWatchtower));
    expect(offer).toBeDefined();
    const pending = send({ state: explored, steps: [] }, offer as never, t.ctx);
    expect(pending.state.window).toMatchObject({ kind: "choose", seat: pending.state.firstPlayer, options: ["resource", "progress"] });
    const resource = finish(pending, t.ctx, takes("resource"));
    expect(resourcesOn(resource.state, CODES.theHeroesDefense)).toBe(1);
    expect(progressOn(resource.state, CODES.theGoblinsAssault)).toBe(3);
    const removed = finish(pending, t.ctx, takes("progress"));
    expect(progressOn(removed.state, CODES.theGoblinsAssault)).toBe(2);
    expect(resourcesOn(removed.state, CODES.theHeroesDefense)).toBe(0);
  });

  it("19163:A:2 an option that changes nothing is not offered: no progress to remove, or Gate of Gundabad barring the resource", () => {
    // The response is used and the one option that can change the game is taken with nobody asked.
    const used = (t: Table, progress: number): ScenarioState => {
      const loaded = updateCard(t.state, idOf(t.state, CODES.theGoblinsAssault), { progress });
      const explored = explore({ ...t, state: loaded });
      const offer = offerOf(explored, t, idOf(t.state, CODES.dwarvenWatchtower));
      expect(offer).toBeDefined();
      const run = send({ state: explored, steps: [] }, offer as never, t.ctx);
      expect(run.state.window?.kind).not.toBe("choose");
      return run.state;
    };
    const bare = used(tower(), 0);
    expect(resourcesOn(bare, CODES.theHeroesDefense)).toBe(1);
    const barred = used(tower({}, [CODES.gateOfGundabad]), 2);
    expect(progressOn(barred, CODES.theGoblinsAssault)).toBe(1);
    expect(resourcesOn(barred, CODES.theHeroesDefense)).toBe(0);
  });

  it("19163:A:2 with the Gate barring the resource and no progress to remove, the response changes nothing", () => {
    const t = tower({}, [CODES.gateOfGundabad]);
    const explored = explore(t);
    const offer = offerOf(explored, t, idOf(t.state, CODES.dwarvenWatchtower));
    const run = offer ? send({ state: explored, steps: [] }, offer as never, t.ctx) : { state: explored, steps: [] };
    expect(progressOn(run.state, CODES.theGoblinsAssault)).toBe(0);
    expect(resourcesOn(run.state, CODES.theHeroesDefense)).toBe(0);
  });
});

describe("19164 Slopes of Gundabad", () => {
  it("19164:A:1 When Revealed: either place 1 progress on The Goblins' Assault or reveal an additional encounter card", () => {
    const t = fight([], { deck: [CODES.goblinTroop, "f0"] });
    const progress = resolveRecords(t.state, t.ctx, CODES.slopesOfGundabad, "whenRevealed", undefined, takes("progress"));
    expect(progressOn(progress.state, CODES.theGoblinsAssault)).toBe(1);
    expect(codesIn(progress.state, "encounterDeck")).toEqual([CODES.goblinTroop, "f0"]);
    const reveal = resolveRecords(t.state, t.ctx, CODES.slopesOfGundabad, "whenRevealed", undefined, takes("reveal"));
    expect(progressOn(reveal.state, CODES.theGoblinsAssault)).toBe(0);
    expect(codesIn(reveal.state, "encounterDeck")).toEqual(["f0"]);
    expect(idsOf(reveal.state, CODES.goblinTroop)).toHaveLength(1);
    expect(reveal.state.cards[idOf(reveal.state, CODES.goblinTroop)]?.zone).not.toBe("encounterDeck");
  });

  it("19164:A:2 Shadow: the attacking enemy cannot take damage this phase", () => {
    const made = wilderlandFight(world, CODES.slopesOfGundabad, "f3", {}, { undefended: true });
    const enemy = idOf(made.run.state, "f3");
    expect(flagged(made.run.state, enemy, "cannotTakeDamage")).toBe(true);
    expect(made.run.state.modifiers.filter((modifier) => modifier.instanceId === enemy && modifier.stat === "cannotTakeDamage").every((modifier) => modifier.until === "endOfPhase")).toBe(true);
  });
});

describe("19165 Fierce Attack", () => {
  it("19165:A:2 When Revealed: X progress on The Goblins' Assault, X the stage number of the main quest", () => {
    STAGES.forEach((stage, index) => {
      const t = fight([], { stage });
      const run = resolveRecords(t.state, t.ctx, CODES.fierceAttack, "whenRevealed");
      expect(progressOn(run.state, CODES.theGoblinsAssault), stage).toBe(index + 1);
    });
  });

  it("19165:A:3 Shadow: the attacking enemy gets +X Attack, X the stage number of the main quest", () => {
    STAGES.forEach((stage, index) => {
      const made = wilderlandFight(world, CODES.fierceAttack, "f3", { stage }, { undefended: true });
      expect(made.run.state.cards[made.made.hero]?.damage, stage).toBe(1 + index + 1);
    });
  });
});

describe("19166 Urdug's Command", () => {
  const near = (state: ScenarioState, hero: string, left: number): ScenarioState => updateCard(state, hero, { damage: (world.cards.get("dh1")?.health ?? 6) - left });

  it("19166:A:1 When Revealed: Urdug makes an immediate attack against the first player; if it destroys a character The Goblins' Assault gets 1 progress", () => {
    const t = fight([], { deck: ["f0", "f0"] });
    const hp = world.cards.get("dh1")?.health ?? 6;
    // The attack lands on a hero with a single hit point left: it is destroyed.
    const doomed = near(t.state, t.hero, 1);
    const killed = played(resolveRecords(doomed, t.ctx, CODES.urdugSCommand, "whenRevealed"), t);
    expect(killed.state.cards[t.hero]?.zone).not.toBe("heroes");
    expect(progressOn(killed.state, CODES.theGoblinsAssault)).toBe(1);
    // The hero is hurt, not destroyed: no progress.
    const spared = played(resolveRecords(t.state, t.ctx, CODES.urdugSCommand, "whenRevealed"), t);
    expect(spared.state.cards[t.hero]?.damage).toBeGreaterThan(0);
    expect(spared.state.cards[t.hero]?.damage).toBeLessThan(hp);
    expect(progressOn(spared.state, CODES.theGoblinsAssault)).toBe(0);
  });

  it("19166:A:1 the attack is Urdug's, made against the first player (the attack discards the top card of the encounter deck for its Attack)", () => {
    // The shadow card is dealt first (a card with no effect), then the Forced effect discards the next card: the Goblin Troop, whose printed Threat is 3.
    const t = fight([], { seats: 2, deck: ["f0", CODES.goblinTroop, "f0"] });
    const run = played(resolveRecords(t.state, t.ctx, CODES.urdugSCommand, "whenRevealed"), t);
    expect(codesIn(run.state, "encounterDiscard")).toContain(CODES.goblinTroop);
    expect(run.state.cards[t.hero]?.damage).toBe((world.cards.get(CODES.urdug)?.attack ?? 0) + (world.cards.get(CODES.goblinTroop)?.threat ?? 0));
    expect(run.state.cards[t.seat1Hero ?? ""]?.damage).toBe(0);
    expect(run.state.cards[idOf(run.state, CODES.urdug)]?.zone).toBe("staging");
  });

  it("19166:A:2 Shadow: the attacking enemy gets +1 Attack, and if its attack destroys a character The Goblins' Assault gets 1 progress", () => {
    const hurt = (state: ScenarioState, made: Table) => near(state, made.hero, 2);
    const killed = wilderlandFight(world, CODES.urdugSCommand, "f3", { staging: FIGHT }, { undefended: true, tweak: hurt });
    expect(killed.run.state.cards[killed.made.hero]?.zone).not.toBe("heroes");
    expect(progressOn(killed.run.state, CODES.theGoblinsAssault)).toBe(1);
    const spared = wilderlandFight(world, CODES.urdugSCommand, "f3", { staging: FIGHT }, { undefended: true });
    expect(spared.run.state.cards[spared.made.hero]?.damage).toBe(2);
    expect(progressOn(spared.run.state, CODES.theGoblinsAssault)).toBe(0);
  });
});

describe("19167 Dark Clouds", () => {
  const threat = (state: ScenarioState, code: string): number => modifiedStat(state, state.cards[idOf(state, code)]!, "threat", world.cards);

  it("19167:A:1 When Revealed: each enemy and each location in the staging area gets +1 Threat until the end of the phase", () => {
    const t = fight([CODES.goblinTroop, CODES.hilltopBattlements]);
    const run = resolveRecords(t.state, t.ctx, CODES.darkClouds, "whenRevealed");
    for (const code of [CODES.goblinTroop, CODES.urdug, CODES.hilltopBattlements]) expect(threat(run.state, code), code).toBe((world.cards.get(code)?.threat ?? 0) + 1);
    // An encounter card's lasting effect holds for the cards that meet its criteria later too (rr.lasting-effects): an enemy that arrives in the staging area this phase has the +1, and one that leaves it loses it.
    const arrived = spawn(run.state, CODES.strayGoblin, { zone: "staging" });
    expect(threat(arrived.state, CODES.strayGoblin)).toBe((world.cards.get(CODES.strayGoblin)?.threat ?? 0) + 1);
    const engaged = spawn(run.state, CODES.strayGoblin, { zone: "engaged", seat: 0 });
    expect(threat(engaged.state, CODES.strayGoblin)).toBe(world.cards.get(CODES.strayGoblin)?.threat ?? 0);
    // It ends with the phase.
    const over = expireModifiers(arrived.state, ["endOfPhase"]);
    expect(threat(over, CODES.goblinTroop)).toBe(world.cards.get(CODES.goblinTroop)?.threat ?? 0);
    expect(threat(over, CODES.strayGoblin)).toBe(world.cards.get(CODES.strayGoblin)?.threat ?? 0);
  });

  it("19167:A:1 if the players quest unsuccessfully this phase, The Goblins' Assault gets 1 progress, once", () => {
    for (const seats of [1, 2] as const) {
      const t = fight([CODES.goblinTroop, CODES.packOfWargs], { seats, stage: "19168", threat: [30, 30] });
      const revealed = resolveRecords(t.state, t.ctx, CODES.darkClouds, "whenRevealed", undefined, undefined, false);
      expect(revealed.state.delayed.length, `${seats} seats`).toBe(1);
      const failed = quest(t, { ...revealed.state, window: t.state.window, mode: t.state.mode });
      expect(progressOn(failed.state, CODES.theGoblinsAssault), `${seats} seats`).toBeGreaterThanOrEqual(1);
      // The Assault's own Forced effect adds one for each player too: Dark Clouds adds exactly 1 more.
      const without = quest(t, t.state);
      expect(progressOn(failed.state, CODES.theGoblinsAssault) - progressOn(without.state, CODES.theGoblinsAssault), `${seats} seats`).toBe(1);
    }
  });

  it("19167:A:1 nothing is placed when the players quest successfully", () => {
    const t = fight([], { stage: "19168" });
    const revealed = resolveRecords(t.state, t.ctx, CODES.darkClouds, "whenRevealed", undefined, undefined, false);
    const run = quest(t, { ...revealed.state, window: t.state.window, mode: t.state.mode });
    expect(progressOn(run.state, CODES.theGoblinsAssault)).toBe(0);
    expect(run.state.delayed).toEqual([]);
  });

  it("19167:A:1 revealed in the encounter phase, the quest is behind it: a later quest that fails places nothing", () => {
    const encounter = fight([CODES.goblinTroop, CODES.packOfWargs], { phase: "Encounter", stage: "19168", threat: [30, 30] });
    const revealed = resolveRecords(encounter.state, encounter.ctx, CODES.darkClouds, "whenRevealed", undefined, undefined, false);
    expect(revealed.state.delayed.map((entry) => entry.phase)).toEqual(["Encounter"]);
    const t = fight([CODES.goblinTroop, CODES.packOfWargs], { stage: "19168", threat: [30, 30] });
    const failed = quest(t, { ...t.state, delayed: revealed.state.delayed });
    const without = quest(t, t.state);
    expect(progressOn(failed.state, CODES.theGoblinsAssault)).toBe(progressOn(without.state, CODES.theGoblinsAssault));
  });

  it("19167:A:2 Shadow: discard a non-objective attachment you control", () => {
    const gear = (state: ScenarioState, made: Table): ScenarioState => {
      const spawned = spawn(state, "gear", { zone: "play", seat: 0 });
      return attachTo(spawned.state, spawned.id, made.hero);
    };
    const made = wilderlandFight(world, CODES.darkClouds, "f3", {}, { undefended: true, tweak: gear });
    expect(made.run.state.cards[idOf(made.run.state, "gear")]?.zone).toBe("discard");
    const kept = wilderlandFight(world, "f0", "f3", {}, { undefended: true, tweak: gear });
    expect(kept.run.state.cards[idOf(kept.run.state, "gear")]?.zone).toBe("play");
  });
});
