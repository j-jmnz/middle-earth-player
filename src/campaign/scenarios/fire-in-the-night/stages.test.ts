// Rules: emce.setup-fire-in-the-night, emce.side-quests, emce.side-quests-in-play, rr.quest-advancement, rr.attacks-outside-the-combat-phase, rr.damage, rr.first-player, rr.defending-player, rr.step-3-3, rr.cancel (data/rules/entries.json); ledger lines 19083:A:1 to 19083:B:2.
// Hrogar's Hill, the only stage of Fire in the Night, and the encounter side quests it reveals, on the scenario's scene: each record runs in a real state, and the side quest and stage changes go through the engine.
import { beforeAll, describe, expect, it } from "vitest";

import { effectsOf } from "../../../rules/windows/listen.ts";
import { whenRevealedUncancelable } from "../../../rules/families/wilderland/heath.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { currentSideQuest } from "../../../rules/families/wilderland/night-quest.ts";
import { askCurrentQuest } from "../../../rules/families/wilderland/night.ts";
import { CODES, STAGES, codesIn, finish, idOf, legalIntents, legalTargets, loadNightWorld, nightTable, resolveRecords, send, start, type NightWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/fire-in-the-night/scene.ts";

let world: NightWorld;
beforeAll(async () => {
  world = await loadNightWorld();
}, 120_000);

type Table = ReturnType<typeof nightTable>;
type Layout = Parameters<typeof nightTable>[1];
const SIDE_QUESTS = [CODES.drawHerFire, CODES.fortifyTheDefense, CODES.rallyTheWoodmen, CODES.douseTheFlames, CODES.holdTheDoor, CODES.defendTheTown, CODES.routTheGoblins, CODES.faceTheDragon];
const stageId = (state: ScenarioState): string => state.questStage ?? "";
const hill = (state: ScenarioState) => state.cards[stageId(state)]!;
const settled = (t: Table, state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, []);
const offered = (state: ScenarioState): string[] => (state.window?.kind === "choose" ? [...state.window.options] : []);
// Passes until the window is not a pass any more (a Response, a choice, an attack) or the phase has moved on; an attack is left undefended on the first hero.
const nobodyDefends = (run: Run, t: Table): Run => (run.state.window?.kind === "defense" ? send(run, { type: "Undefended", ...(legalTargets(run.state, { type: "Undefended" }, t.ctx).length > 1 ? { heroId: t.hero2 } : {}) } as PlayerIntent, t.ctx) : run);
// The planning phase ends: every seat has its planning window, in which every seat passes, and the Forced effect of the stage reveals the top side quest and Dagnir attacks Hrogar's Hill (the first player is asked for a defender).
const planningEnds = (t: Table): Run => {
  let run = start(t.state);
  for (let pass = 0; pass < 2 * t.state.seatCount * t.state.seatCount && run.state.phase === "Planning" && run.state.window?.kind === "pass"; pass += 1) run = send(run, { type: "Pass" }, t.ctx);
  return run;
};
const sideQuestOf = (state: ScenarioState, code: string) => state.cards[idOf(state, code)]!;

describe("19083 Hrogar's Hill, side A", () => {
  it("19083:A:1 Setup: the side quest deck is shuffled with the game's seed, the encounter deck is shuffled, and each other player reveals an encounter card", () => {
    const orders = [1, 2, 3, 4, 5].map((seed) => {
      const t = nightTable(world, { seed, sideQuests: SIDE_QUESTS, staging: [CODES.dagnir] });
      const run = resolveRecords(t.state, t.ctx, CODES.stage1, "setup", stageId(t.state));
      return (run.state.piles?.sideQuestDeck ?? []).map((id) => run.state.cards[id]?.code).join();
    });
    expect(new Set(orders).size).toBeGreaterThan(1);
    for (const order of orders) expect(order.split(",").sort()).toEqual([...SIDE_QUESTS].sort());
    // Alone nobody else reveals; with two players the second reveals one card, which lies in the staging area with Dagnir.
    const solo = resolveRecords(nightTable(world, { deck: ["f0", "f3"], staging: [CODES.dagnir] }).state, nightTable(world).ctx, CODES.stage1, "setup", stageId(nightTable(world).state));
    expect(codesIn(solo.state, "staging")).toEqual([CODES.dagnir]);
    const two = nightTable(world, { seats: 2, deck: ["f0", "f3"], staging: [CODES.dagnir] });
    const duo = resolveRecords(two.state, two.ctx, CODES.stage1, "setup", stageId(two.state));
    expect(codesIn(duo.state, "staging")).toHaveLength(2);
    expect(codesIn(duo.state, "staging")).toContain(CODES.dagnir);
    expect(duo.state.encounterDeck).toHaveLength(1);
  });

  it("emce.setup-fire-in-the-night the scenario deals the eight side quests as a deck of their own and Dagnir in the staging area, not in the encounter deck", () => {
    const dealt = world.definition;
    expect(dealt).toBeDefined();
    const sideQuests = SIDE_QUESTS.filter((code) => world.cards.get(code)?.type === "encounter-side-quest");
    expect(sideQuests).toHaveLength(8);
  });
});

describe("19083 Hrogar's Hill, side B: the end of the planning phase", () => {
  it("19083:B:1 the top side quest of the deck is revealed into the staging area, and Dagnir attacks Hrogar's Hill: the first player is asked for a defender", () => {
    const t = nightTable(world, { phase: "Planning", sideQuests: [CODES.holdTheDoor, CODES.faceTheDragon], staging: [CODES.dagnir] });
    const run = planningEnds(t);
    expect(codesIn(run.state, "staging")).toEqual([CODES.dagnir, CODES.holdTheDoor].sort());
    expect(codesIn(run.state, "sideQuestDeck")).toEqual([CODES.faceTheDragon]);
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 0 });
    expect(run.state.pendingAttack).toMatchObject({ enemyId: idOf(run.state, CODES.dagnir), seat: 0, toStage: true, excessToStage: true, fromStaging: true });
    expect(legalIntents(run.state, t.ctx).map((intent) => intent.type)).toEqual(["DeclareDefender", "Undefended"]);
  });

  it("19083:B:1 left undefended, the whole attack (Dagnir's 7 Attack) is dealt to Hrogar's Hill, and no hero takes it", () => {
    const t = nightTable(world, { phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir] });
    const run = nobodyDefends(planningEnds(t), t);
    expect(hill(run.state).damage).toBe(7);
    for (const hero of [t.hero, t.hero2]) expect(run.state.cards[hero]?.damage).toBe(0);
    expect(run.state.pendingAttack).toBeNull();
  });

  it("19083:B:1 no shadow card is dealt for the attack, even with Dagnir considered engaged with each player", () => {
    const t = nightTable(world, { phase: "Planning", deck: ["f3", "f3"], sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir], victory: [CODES.faceTheDragon, CODES.douseTheFlames, CODES.rallyTheWoodmen] });
    const run = nobodyDefends(planningEnds(t), t);
    expect(codesIn(run.state, "shadow")).toEqual([]);
    expect(run.state.encounterDeck).toHaveLength(2);
    expect(hill(run.state).damage).toBe(7);
  });

  it("19083:B:1 the first player may declare a defender: it takes the damage its Defense leaves, and the excess beyond its remaining hit points goes to Hrogar's Hill", () => {
    // A hero with 3 hit points left (6 - 3) and 2 Defense: 5 damage, 2 of them beyond what it can take (it is destroyed).
    const t = nightTable(world, { phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir] });
    const hurt = updateCard(t.state, t.hero, { damage: 3 });
    const run = send(start(hurt), { type: "Pass" }, t.ctx);
    const done = send(run, { type: "DeclareDefender", defenderId: t.hero }, t.ctx);
    expect(done.state.cards[t.hero]).toMatchObject({ zone: "discard", damage: 8 });
    expect(hill(done.state).damage).toBe(2);
    // A defender that is not hurt that badly takes it all, and the hill takes none.
    const fresh = send(planningEnds(t), { type: "DeclareDefender", defenderId: t.hero }, t.ctx);
    expect(fresh.state.cards[t.hero]?.damage).toBe(5);
    expect(hill(fresh.state).damage).toBe(0);
  });

  it("19083:B:1 only the first player is the defending player: with two players the second player's characters cannot defend it, and the first player passes the token with the round", () => {
    const t = nightTable(world, { seats: 2, phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir] });
    const run = planningEnds(t);
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 0 });
    const defenders = legalIntents(run.state, t.ctx).filter((intent) => intent.type === "DeclareDefender");
    expect(defenders).toHaveLength(1);
    // Player 2 is the first player in the round after: the attack is theirs.
    const second = nightTable(world, { seats: 2, phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir] });
    const shifted = planningEnds({ ...second, state: { ...second.state, firstPlayer: 1, activeSeat: 1 } });
    expect(shifted.state.window).toMatchObject({ kind: "defense", seat: 1 });
  });

  it("19083:B:1 with the side quest deck empty nothing is revealed and Dagnir still attacks", () => {
    const t = nightTable(world, { phase: "Planning", staging: [CODES.dagnir] });
    const run = nobodyDefends(planningEnds(t), t);
    expect(codesIn(run.state, "staging")).toEqual([CODES.dagnir]);
    expect(hill(run.state).damage).toBe(7);
  });

  it("19083:B:1 the attack is an attack outside the combat phase: it does not use up Dagnir's attack, and Wooden Palisade (the active location) gives him -2 Attack", () => {
    const t = nightTable(world, { phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir], active: CODES.woodenPalisade });
    const run = nobodyDefends(planningEnds(t), t);
    expect(hill(run.state).damage).toBe(5);
    expect(run.state.resolvedAttacks).toEqual([]);
  });

  it("emce.side-quests a side quest revealed by the stage resolves its When Revealed effects: Rout the Goblins brings a Goblin enemy engaged with each player", () => {
    const goblins = world.cards.get(CODES.goblinTroop)?.traits.includes("Goblin");
    expect(goblins).toBe(true);
    const t = nightTable(world, { seats: 2, phase: "Planning", sideQuests: [CODES.routTheGoblins], staging: [CODES.dagnir], deck: [CODES.goblinTroop, CODES.strayGoblin, "f0"] });
    const run = planningEnds(t);
    const done = finish(run, t.ctx);
    expect(done.state.seats[0]?.engaged.map((id) => done.state.cards[id]?.code)).toEqual([CODES.goblinTroop]);
    expect(done.state.seats[1]?.engaged.map((id) => done.state.cards[id]?.code)).toEqual([CODES.strayGoblin]);
    expect(codesIn(done.state, "staging")).toContain(CODES.routTheGoblins);
  });
});

describe("19083 Hrogar's Hill, side B: the stage", () => {
  it("19083:B:2 the stage cannot be defeated while Dagnir has hit points remaining: its progress is not capped and it does not advance", () => {
    const t = nightTable(world, { progress: 50, staging: [CODES.dagnir] });
    expect(restricted(t.state, t.ctx, "advance").length).toBeGreaterThan(0);
    const gone = nightTable(world, { progress: 50 });
    expect(restricted(gone.state, gone.ctx, "advance")).toHaveLength(0);
    // Progress goes on past the quest points while it is held back.
    const more = send(start(t.state), { type: "Commit", cardIds: [t.hero, t.hero2] }, t.ctx);
    const quested = send(more, { type: "Pass" }, t.ctx);
    expect(hill(quested.state).progress).toBeGreaterThan(50);
    expect(quested.state.stageCleared).toBeFalsy();
  });

  it("19083:B:2 when Dagnir has no hit points remaining the players win the game", () => {
    const t = nightTable(world, { staging: [{ code: CODES.dagnir, damage: 19 }] });
    const dagnir = idOf(t.state, CODES.dagnir);
    const hit = placeDamage(t.state, dagnir, 1, t.ctx.cards, [], "combat", UNATTRIBUTED);
    const done = finish({ state: settle(hit, t.ctx, []), steps: [] }, t.ctx).state;
    expect(done.cards[dagnir]?.zone).toBe("victory");
    expect(done.stageCleared).toBe(true);
    expect(done.lost).toBeFalsy();
  });

  it("19083:B:2 with as much damage on the stage as it has quest points the players lose the game; with one less they do not", () => {
    const t = nightTable(world, { staging: [CODES.dagnir] });
    expect(settled(t, updateCard(t.state, stageId(t.state), { damage: 49 })).lost).toBeFalsy();
    const lost = settled(t, updateCard(t.state, stageId(t.state), { damage: 50 }));
    expect(lost.lost).toBe(true);
    expect(lost.lossReason).toContain("Hrogar's Hill");
  });

  it("19083:B:2 the stage is the only one: Hrogar's Hill has 50 quest points", () => {
    expect(STAGES).toEqual(["19083"]);
    expect(modifiedStat(nightTable(world).state, hill(nightTable(world).state), "questPoints", world.cards)).toBe(50);
  });
});

describe("emce.side-quests-in-play the current quest", () => {
  const sideInStaging = (extra: Layout = {}) => nightTable(world, { phase: "Planning", sideQuests: [CODES.holdTheDoor], staging: [CODES.dagnir, CODES.drawHerFire, CODES.defendTheTown], ...extra });
  // The planning phase ends and the stage's attack is left undefended: the quest phase begins with the first player's question.
  const questBegins = (t: Table): Run => nobodyDefends(planningEnds(t), t);

  it("at the beginning of the quest phase the first player may choose a side quest in the staging area to be the current quest, or keep the main quest", () => {
    const t = sideInStaging();
    const run = questBegins(t);
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    // The side quests in the staging area now: the one the stage revealed and the two already there.
    expect(offered(run.state)).toEqual(["main", ...run.state.staging.filter((id) => ["encounter-side-quest"].includes(world.cards.get(run.state.cards[id]?.code ?? "")?.type ?? ""))]);
    expect(offered(run.state)).toHaveLength(4);
    const declined = send(run, { type: "Choose", optionId: "main" }, t.ctx);
    expect(currentSideQuest(declined.state)).toBeNull();
    expect(declined.state.window).toMatchObject({ kind: "pass" });
  });

  it("only the first player is asked, in a game of two players, and once a round", () => {
    const t = sideInStaging({ seats: 2 });
    const run = questBegins(t);
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    const next = send(run, { type: "Choose", optionId: "main" }, t.ctx);
    expect(next.state.window?.kind).toBe("pass");
    expect(next.state.sideAsked).toBe(next.state.round);
  });

  it("a game with no side quest in the staging area asks nothing", () => {
    const t = nightTable(world, { phase: "Planning", staging: [CODES.dagnir] });
    const run = nobodyDefends(planningEnds(t), t);
    expect(run.state.window).toMatchObject({ kind: "pass" });
    expect(currentSideQuest(run.state)).toBeNull();
  });

  it("the side quest chosen is the current quest until the end of the phase, and the cards that hear it are told: Draw Her Fire makes Dagnir attack the first player", () => {
    const t = sideInStaging();
    const run = questBegins(t);
    const draw = idOf(run.state, CODES.drawHerFire);
    const chosen = send(run, { type: "Choose", optionId: draw }, t.ctx);
    expect(currentSideQuest(chosen.state)).toBe(draw);
    // The Forced effect of Draw Her Fire: Dagnir makes an immediate attack against the first player (a shadow card is dealt to him: none is left in this deck).
    expect(chosen.state.pendingAttack).toMatchObject({ enemyId: idOf(chosen.state, CODES.dagnir), seat: 0, immediate: true });
    expect(chosen.state.pendingAttack?.toStage).toBeFalsy();
    const attacked = send(chosen, { type: "Undefended", heroId: t.hero2 }, t.ctx);
    expect(attacked.state.cards[t.hero2]?.damage).toBeGreaterThan(0);
    expect(hill(attacked.state).damage).toBe(7);
  });

  it("progress that the quest makes goes on the active location first, then on the current side quest instead of the main quest; the rest of it is discarded", () => {
    const base = nightTable(world, { staging: [CODES.dagnir, { code: CODES.defendTheTown, progress: 3 }], active: CODES.woodenPalisade, current: CODES.defendTheTown });
    const quest = (willpower: number) => {
      const t = { ...base, state: { ...base.state, modifiers: [...base.state.modifiers, { instanceId: base.hero, sourceId: base.hero, stat: "willpower" as const, amount: willpower, until: "endOfPhase" as const }] } };
      let run = send(start(t.state), { type: "Commit", cardIds: [t.hero] }, t.ctx);
      run = send(run, { type: "Pass" }, t.ctx);
      return run.state;
    };
    // The hero has 2 Willpower (+n) against Dagnir's Threat 1: with 2 progress on top of the Palisade's 3 quest points, 3 go on the Palisade and the rest on the side quest.
    const after = quest(3);
    const palisade = Object.values(after.cards).filter((card) => card.code === CODES.woodenPalisade);
    expect(palisade.every((card) => card.zone !== "activeLocation")).toBe(true);
    const defend = sideQuestOf(after, CODES.defendTheTown);
    expect(defend.progress).toBe(3 + 1);
    expect(hill(after).progress).toBe(0);
    // Far more than the side quest needs (5 quest points): the excess is discarded and the main quest takes none.
    const plenty = quest(40);
    expect(plenty.cards[idOf(plenty, CODES.defendTheTown)]?.zone).toBe("victory");
    expect(hill(plenty).progress).toBe(0);
  });

  it("only progress is redirected: an effect that names the quest card still reads Hrogar's Hill while a side quest is the current quest", () => {
    // Douse the Flames deals 5 damage to Hrogar's Hill at the end of the quest phase, and Defend the Town is the current quest: the damage is the Hill's, and the side quest holds none.
    const t = nightTable(world, { staging: [CODES.dagnir, CODES.douseTheFlames, CODES.defendTheTown], current: CODES.defendTheTown, threat: [30, 30] });
    const defend = idOf(t.state, CODES.defendTheTown);
    expect(currentSideQuest(t.state)).toBe(defend);
    let run = send(start(t.state), { type: "Commit", cardIds: [t.hero2] }, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    expect(hill(run.state).damage).toBe(5);
    expect(run.state.cards[defend]?.damage).toBe(0);
    // Healing the quest card heals the Hill's damage, not a side quest's.
    const healed = resolveRecords(updateCard(t.state, stageId(t.state), { damage: 14 }), t.ctx, CODES.douseTheFlames, "response", idOf(t.state, CODES.douseTheFlames));
    expect(hill(healed.state).damage).toBe(4);
  });

  it("without a current side quest the progress goes on the main quest as ever", () => {
    const t = nightTable(world, { staging: [CODES.dagnir, CODES.defendTheTown] });
    let run = send(start(t.state), { type: "Commit", cardIds: [t.hero, t.hero2] }, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    expect(hill(run.state).progress).toBe(3);
    expect(sideQuestOf(run.state, CODES.defendTheTown).progress).toBe(0);
  });

  it("a side quest that holds its quest points is defeated: it is added to the victory display, the quest deck does not advance, and its Response is offered to the first player", () => {
    const t = nightTable(world, { staging: [CODES.dagnir, { code: CODES.holdTheDoor, progress: 8 }], current: CODES.holdTheDoor, threat: [30, 30] });
    let run = send(start(t.state), { type: "Commit", cardIds: [t.hero, t.hero2] }, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    const door = idOf(run.state, CODES.holdTheDoor);
    expect(run.state.cards[door]).toMatchObject({ zone: "victory", progress: 0 });
    expect(run.state.victory).toContain(door);
    expect(run.state.questStage).toBe(stageId(t.state));
    expect(hill(run.state).progress).toBe(0);
    expect(run.state.window).toMatchObject({ kind: "response", seat: 0 });
    expect(legalIntents(run.state, t.ctx)).toContainEqual({ type: "Trigger", cardId: door, effectId: "19070:response:1" });
    // Taking it: each player's threat is reduced by 5 (the card is in the victory display, so it no longer bars it).
    const used = send(run, { type: "Trigger", cardId: door, effectId: "19070:response:1" }, t.ctx);
    expect(used.state.seats[0]?.threat).toBe(25);
  });

  it("the current quest is the current quest until the end of the phase only, and the first player is asked again in the next round", () => {
    const t = nightTable(world, { staging: [CODES.dagnir, CODES.defendTheTown], current: CODES.defendTheTown, threat: [30, 30] });
    const defend = idOf(t.state, CODES.defendTheTown);
    expect(currentSideQuest(t.state)).toBe(defend);
    let run = send(start(t.state), { type: "Commit", cardIds: [t.hero2] }, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    expect(run.state.phase).toBe("Travel");
    expect(currentSideQuest(run.state)).toBeNull();
    // The next round: the question is asked again.
    expect(askCurrentQuest({ ...run.state, round: run.state.round + 1 }, t.ctx, [])?.stack).toHaveLength(1);
    expect(askCurrentQuest(run.state, t.ctx, [])).toBeNull();
  });

  it("a game that deals no side quest deck never reads a current quest", () => {
    const t = nightTable(world, { staging: [CODES.defendTheTown], current: CODES.defendTheTown });
    expect(currentSideQuest({ ...t.state, piles: undefined })).toBeNull();
  });
});

describe("emce.side-quests the When Revealed effects of a side quest cannot be canceled", () => {
  it("a Response that cancels the When Revealed effects of a side quest is barred, and of an enemy it is not", () => {
    const t = nightTable(world, { staging: [CODES.routTheGoblins, CODES.goblinTroop] });
    const cancel = { id: "cancel", cardCode: "x", lines: ["x:A:1"], timing: "response", instructions: [{ verb: "CancelEffect" }] } as never;
    const event = (code: string) => ({ trigger: "whenRevealedPending", seat: 0, subject: idOf(t.state, code) }) as never;
    expect(whenRevealedUncancelable(t.state, event(CODES.routTheGoblins), cancel, t.ctx)).toBe(true);
    expect(whenRevealedUncancelable(t.state, event(CODES.goblinTroop), cancel, t.ctx)).toBe(false);
    expect(effectsOf(t.ctx, CODES.routTheGoblins).some((effect) => effect.timing === "whenRevealed")).toBe(true);
  });
});
