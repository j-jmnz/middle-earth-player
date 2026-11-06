// Rules: emce.side-quests, emce.side-quests-in-play, emce.setup-fire-in-the-night, rr.damage, rr.hit-points, rr.travel, rr.engaged, rr.forced, rr.response, rr.attacks-outside-the-combat-phase, rr.shadow-effects, rr.victory, rr.search, rr.immune (data/rules/entries.json); ledger lines 19066:A:1 to 19082:A:2.
// The encounter side quests, Dagnir and the encounter cards of Fire in the Night on the scenario's scene: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { flagged, heldAmount, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { canAttack } from "../../../rules/combat/combat.ts";
import { lowerThreatByEffect } from "../../../rules/families/quest/threat.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { CODES, codesIn, finish, idOf, legalIntents, legalTargets, loadNightWorld, nightFight, nightTable, resolveRecords, send, start, type NightWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/fire-in-the-night/scene.ts";

let world: NightWorld;
beforeAll(async () => {
  world = await loadNightWorld();
}, 120_000);

type Table = ReturnType<typeof nightTable>;
const hill = (state: ScenarioState) => state.cards[state.questStage ?? ""]!;
const dagnirOf = (state: ScenarioState) => state.cards[idOf(state, CODES.dagnir)]!;
const take = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");
const stat = (state: ScenarioState, code: string, name: "threat" | "attack" | "defense" | "questPoints"): number => modifiedStat(state, state.cards[idOf(state, code)]!, name, world.cards);
const SIDE_QUEST_CODES = [CODES.drawHerFire, CODES.fortifyTheDefense, CODES.rallyTheWoodmen, CODES.douseTheFlames, CODES.holdTheDoor, CODES.defendTheTown, CODES.routTheGoblins, CODES.faceTheDragon];
// n side quests in the victory display.
const victory = (n: number): string[] => SIDE_QUEST_CODES.slice(0, n);
const settled = (t: Table, state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, []);
// The attack a record starts is made against the first player: left undefended on the first hero, it is read where it ends.
const undefendedOn = (run: Run, t: Table, hero: string = t.hero): Run => (run.state.window?.kind === "defense" ? send(run, { type: "Undefended", ...(legalTargets(run.state, { type: "Undefended" }, t.ctx).length > 1 ? { heroId: hero } : {}) } as PlayerIntent, t.ctx) : run);

describe("19074 Dagnir", () => {
  it("19074:A:1 his Threat X is 1 more than the number of side quests in the victory display", () => {
    for (const n of [0, 1, 3, 8]) {
      const t = nightTable(world, { staging: [CODES.dagnir], victory: victory(n) });
      expect(stat(t.state, CODES.dagnir, "threat"), `${n} side quests`).toBe(n + 1);
    }
    expect(world.cards.get(CODES.dagnir)?.keywords.immuneToPlayerCardEffects).toBe(true);
  });

  it("19074:A:2 he cannot leave the staging area: no player engages him, by an engagement check or by choice", () => {
    const t = nightTable(world, { phase: "Encounter", staging: [CODES.dagnir], threat: [49, 49] });
    expect(flagged(t.state, idOf(t.state, CODES.dagnir), "cannotBeEngaged")).toBe(true);
    let run = start(t.state);
    for (let guard = 0; guard < 4 && run.state.window?.kind === "optionalEngage"; guard += 1) run = send(run, { type: "DeclineEngage" }, t.ctx);
    expect(run.state.cards[idOf(run.state, CODES.dagnir)]?.zone).toBe("staging");
  });

  it("19074:A:2 he takes at most X damage each round from effects other than a quest card's, X one more than the side quests in the victory display", () => {
    const t = nightTable(world, { staging: [CODES.dagnir], victory: victory(2) });
    const id = idOf(t.state, CODES.dagnir);
    // X is 3: 2 damage, then 4 more (only 1 is placed), then none.
    let state = placeDamage(t.state, id, 2, world.cards, [], "framework", UNATTRIBUTED);
    state = placeDamage(state, id, 4, world.cards, [], "combat", UNATTRIBUTED);
    expect(state.cards[id]?.damage).toBe(3);
    expect(placeDamage(state, id, 4, world.cards, [], "player", UNATTRIBUTED).cards[id]?.damage).toBe(3);
    // The cap is per round: the next round he takes more.
    const later = { ...state, roundDamage: {} };
    expect(placeDamage(later, id, 1, world.cards, [], "combat", UNATTRIBUTED).cards[id]?.damage).toBe(4);
  });

  it("19074:A:2 damage that a quest card or a side quest deals is no non-quest effect: it is not capped and does not count toward the cap", () => {
    const t = nightTable(world, { staging: [CODES.dagnir, CODES.faceTheDragon] });
    const id = idOf(t.state, CODES.dagnir);
    const run = resolveRecords(t.state, t.ctx, CODES.faceTheDragon, "forced", idOf(t.state, CODES.faceTheDragon), undefined, true);
    expect(run.state.cards[id]?.damage).toBeGreaterThanOrEqual(0);
    // Face the Dragon is defeated: 5 damage to Dagnir, though his cap is 1 with no side quest in the victory display.
    const defeated = settled(t, t.state);
    const quest = idOf(defeated, CODES.faceTheDragon);
    const hit = resolveRecords(defeated, t.ctx, CODES.faceTheDragon, "forced", quest);
    expect(hit.state.cards[id]?.damage).toBe(5);
    // The quest damage did not use up the cap: 1 more point is still placed this round.
    expect(placeDamage(hit.state, id, 4, world.cards, [], "combat", UNATTRIBUTED).cards[id]?.damage).toBe(6);
  });

  it("19074:A:3 with fewer than 3 side quests in the victory display he is in the staging area only, and adds his Threat to it", () => {
    for (const n of [0, 2]) {
      const t = nightTable(world, { staging: [CODES.dagnir], victory: victory(n) });
      const id = idOf(t.state, CODES.dagnir);
      for (const flag of ["engagedWithAll", "noThreatContribution", "attackableByAny"] as const) expect(flagged(t.state, id, flag), `${n} ${flag}`).toBe(false);
      expect(stagingThreat(t.state, world.cards)).toBe(n + 1);
    }
  });

  it("19074:A:3 with at least 3 side quests in the victory display he is considered engaged with each player, as the Watcher in the Water is: no Threat, every player's characters can attack him, and he attacks every player in the combat phase", () => {
    const t = nightTable(world, { seats: 2, phase: "Combat", staging: [CODES.dagnir], victory: victory(3), deck: ["f0", "f0", "f0"] });
    const id = idOf(t.state, CODES.dagnir);
    for (const flag of ["engagedWithAll", "noThreatContribution", "attackableByAny", "cannotBeEngaged"] as const) expect(flagged(t.state, id, flag), flag).toBe(true);
    expect(stagingThreat(t.state, world.cards)).toBe(0);
    expect(canAttack(t.state, 0, t.hero, id, world.cards)).toBe(true);
    expect(canAttack(t.state, 1, t.seat1Hero ?? "", id, world.cards)).toBe(true);
    // The combat phase: he attacks each of the two players in turn order.
    let run = start(t.state);
    let attacks = 0;
    for (let guard = 0; guard < 40 && run.state.phase === "Combat"; guard += 1) {
      if (run.state.window?.kind === "defense") {
        attacks += 1;
        run = send(run, { type: "Undefended", ...(run.state.pendingAttack?.seat === 0 ? { heroId: t.hero } : {}) } as PlayerIntent, t.ctx);
        continue;
      }
      const intents = legalIntents(run.state, t.ctx);
      const next = intents.find((intent) => intent.type === "Pass") ?? intents.find((intent) => intent.type === "DeclineAttack");
      if (!next) break;
      run = send(run, next as PlayerIntent, t.ctx);
    }
    expect(attacks).toBe(2);
  });

  it("19074:A:3 the 3rd side quest in the victory display changes it as it arrives, and the 2nd does not", () => {
    const t = nightTable(world, { staging: [CODES.dagnir, { code: CODES.holdTheDoor, progress: 9 }], victory: victory(2), current: CODES.holdTheDoor, threat: [30, 30] });
    let run = send(start(t.state), { type: "Commit", cardIds: [t.hero, t.hero2] }, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    expect(run.state.victory).toHaveLength(3);
    expect(flagged(run.state, idOf(run.state, CODES.dagnir), "engagedWithAll")).toBe(true);
  });
});

describe("19066 Draw Her Fire", () => {
  it("19066:A:1 the shadow cards dealt to Dagnir are immune to player card effects and their effects cannot be canceled: the flag is Dagnir's while it is in the staging area", () => {
    const t = nightTable(world, { staging: [CODES.dagnir, CODES.drawHerFire] });
    expect(flagged(t.state, idOf(t.state, CODES.dagnir), "shadowsImmune")).toBe(true);
    const gone = nightTable(world, { staging: [CODES.dagnir], victory: [CODES.drawHerFire] });
    expect(flagged(gone.state, idOf(gone.state, CODES.dagnir), "shadowsImmune")).toBe(false);
  });

  it("19066:A:2 after it becomes the current quest, Dagnir makes an immediate attack against the first player, who is dealt his shadow card", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.dagnir, CODES.drawHerFire], deck: ["f0", "f0"] });
    const run = resolveRecords(t.state, t.ctx, CODES.drawHerFire, "forced", idOf(t.state, CODES.drawHerFire));
    expect(run.state.pendingAttack).toMatchObject({ enemyId: idOf(t.state, CODES.dagnir), seat: 0, immediate: true });
    expect(run.state.pendingAttack?.toStage).toBeFalsy();
    const shifted = nightTable(world, { seats: 2, staging: [CODES.dagnir, CODES.drawHerFire], deck: ["f0", "f0"] });
    const other = resolveRecords({ ...shifted.state, firstPlayer: 1 }, shifted.ctx, CODES.drawHerFire, "forced", idOf(shifted.state, CODES.drawHerFire));
    expect(other.state.pendingAttack?.seat).toBe(1);
  });
});

describe("19067 Fortify the Defense", () => {
  it("19067:A:1 characters do not count their Defense when defending against Dagnir, and count it against any other enemy", () => {
    const attack = (side: string[]) => {
      const fight = nightFight(world, "f0", CODES.dagnir, { engaged: [{ code: CODES.dagnir, seat: 0 }], staging: side });
      return fight.run.state.cards[fight.made.hero]?.damage;
    };
    // Dagnir has 7 Attack; the hero 2 Defense.
    expect(attack([])).toBe(5);
    expect(attack([CODES.fortifyTheDefense])).toBe(7);
    const other = nightFight(world, "f0", CODES.goblinTroop, { staging: [CODES.fortifyTheDefense, CODES.dagnir] });
    expect(other.run.state.cards[other.made.hero]?.damage).toBe(Math.max(0, (world.cards.get(CODES.goblinTroop)?.attack ?? 0) - 2));
  });

  it("19067:A:2 defeated, each player chooses in turn: draw 3 cards, or each hero he controls gains 1 resource", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.dagnir], victory: [CODES.fortifyTheDefense], deckOf: ["f0", "f0", "f0", "f0"] });
    const run = resolveRecords(t.state, t.ctx, CODES.fortifyTheDefense, "response", idOf(t.state, CODES.fortifyTheDefense), (state) => (state.window?.kind === "choose" && state.window.seat === 0 ? "draw" : "resources"));
    expect(run.state.seats[0]?.hand).toHaveLength(3);
    expect(run.state.seats[1]?.hand).toHaveLength(0);
    expect(run.state.cards[t.seat1Hero ?? ""]?.resources).toBe(1);
    expect(run.state.cards[t.hero]?.resources).toBe(0);
  });

  it("19067:A:2 alone nobody is asked which player: the one player chooses, and a choice of resources gives each of their heroes 1", () => {
    const t = nightTable(world, { staging: [CODES.dagnir], victory: [CODES.fortifyTheDefense] });
    const run = resolveRecords(t.state, t.ctx, CODES.fortifyTheDefense, "response", idOf(t.state, CODES.fortifyTheDefense), take("resources"));
    expect([t.hero, t.hero2].map((id) => run.state.cards[id]?.resources)).toEqual([1, 1]);
  });
});

describe("19068 Rally the Woodmen", () => {
  it("19068:A:1 allies cannot be declared as attackers against Dagnir, and a hero can", () => {
    const t = nightTable(world, { phase: "PlayerAttacks", staging: [CODES.dagnir, CODES.rallyTheWoodmen], victory: [CODES.drawHerFire, CODES.fortifyTheDefense, CODES.douseTheFlames], play: ["ally"] });
    const dagnir = idOf(t.state, CODES.dagnir);
    const ally = idOf(t.state, "ally");
    expect(canAttack(t.state, 0, t.hero, dagnir, world.cards)).toBe(true);
    expect(canAttack(t.state, 0, ally, dagnir, world.cards)).toBe(false);
    const free = nightTable(world, { phase: "PlayerAttacks", staging: [CODES.dagnir], victory: victory(3), play: ["ally"] });
    expect(canAttack(free.state, 0, idOf(free.state, "ally"), idOf(free.state, CODES.dagnir), world.cards)).toBe(true);
  });

  it("19068:A:2 defeated, each player searches the top 5 cards of their deck for an ally, puts it into play and shuffles their deck", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.dagnir], victory: [CODES.rallyTheWoodmen], deckOf: ["filler", "filler", "ally", "filler", "filler", "filler", "ally"] });
    const run = resolveRecords(t.state, t.ctx, CODES.rallyTheWoodmen, "response", idOf(t.state, CODES.rallyTheWoodmen));
    for (const seat of [0, 1]) {
      const allies = run.state.seats[seat]?.play.map((id) => run.state.cards[id]?.code) ?? [];
      expect(allies, `seat ${seat}`).toEqual(["ally"]);
      expect(run.state.seats[seat]?.deck, `seat ${seat}`).toHaveLength(6);
    }
  });
});

describe("19069 Douse the Flames", () => {
  it("19069:A:1 at the end of the quest phase it deals 5 damage to Hrogar's Hill", () => {
    const t = nightTable(world, { staging: [CODES.dagnir, CODES.douseTheFlames], threat: [30, 30] });
    const run = resolveRecords(t.state, t.ctx, CODES.douseTheFlames, "forced", idOf(t.state, CODES.douseTheFlames));
    expect(hill(run.state).damage).toBe(5);
    // Through the engine: the quest phase ends.
    let phased = send(start(t.state), { type: "Commit", cardIds: [t.hero2] }, t.ctx);
    phased = send(phased, { type: "Pass" }, t.ctx);
    expect(hill(phased.state).damage).toBe(5);
  });

  it("19069:A:2 defeated, it removes 10 damage from Hrogar's Hill, and no more than the stage has", () => {
    const t = nightTable(world, { staging: [CODES.dagnir], victory: [CODES.douseTheFlames] });
    const hurt = updateCard(t.state, t.state.questStage ?? "", { damage: 14 });
    expect(hill(resolveRecords(hurt, t.ctx, CODES.douseTheFlames, "response", idOf(hurt, CODES.douseTheFlames)).state).damage).toBe(4);
    const light = updateCard(t.state, t.state.questStage ?? "", { damage: 6 });
    expect(hill(resolveRecords(light, t.ctx, CODES.douseTheFlames, "response", idOf(light, CODES.douseTheFlames)).state).damage).toBe(0);
  });
});

describe("19070 Hold the Door", () => {
  it("19070:A:1 each player's threat cannot be reduced while it is in the staging area", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.dagnir, CODES.holdTheDoor], threat: [35, 35] });
    for (const seat of [0, 1]) {
      expect(heldAmount(t.state, `seat:${seat}`, "threatReductionBarred"), `seat ${seat}`).toBeGreaterThan(0);
      expect(lowerThreatByEffect(t.state, seat, 3, null, t.ctx, [], UNATTRIBUTED).seats[seat]?.threat).toBe(35);
    }
    const gone = nightTable(world, { staging: [CODES.dagnir], victory: [CODES.holdTheDoor], threat: [35, 35] });
    expect(lowerThreatByEffect(gone.state, 0, 3, null, gone.ctx, [], UNATTRIBUTED).seats[0]?.threat).toBe(32);
  });

  it("19070:A:2 defeated, each player's threat is reduced by 5", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.dagnir], victory: [CODES.holdTheDoor], threat: [35, 22] });
    const run = resolveRecords(t.state, t.ctx, CODES.holdTheDoor, "response", idOf(t.state, CODES.holdTheDoor));
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([30, 17]);
  });
});

describe("19071 Defend the Town", () => {
  it("19071:A:1 while it is the current quest one more encounter card is revealed during the quest phase; otherwise not", () => {
    const reveals = (current: boolean): number => {
      const t = nightTable(world, { staging: [CODES.dagnir, CODES.defendTheTown], deck: ["f0", "f3", "f0", "f3", "f0"], ...(current ? { current: CODES.defendTheTown } : {}), threat: [30, 30] });
      let run = send(start(t.state), { type: "Commit", cardIds: [t.hero2] }, t.ctx);
      run = send(run, { type: "Pass" }, t.ctx);
      return run.steps.filter((step) => step.kind === "reveal").length;
    };
    expect(reveals(false)).toBe(1);
    expect(reveals(true)).toBe(2);
  });

  it("19071:A:2 at the end of the encounter phase it deals 1 damage to Hrogar's Hill for each enemy in the staging area", () => {
    const t = nightTable(world, { phase: "Encounter", staging: [CODES.dagnir, CODES.defendTheTown, CODES.goblinTroop, CODES.strayGoblin] });
    const run = resolveRecords(t.state, t.ctx, CODES.defendTheTown, "forced", idOf(t.state, CODES.defendTheTown));
    expect(hill(run.state).damage).toBe(3);
    const none = nightTable(world, { phase: "Encounter", staging: [CODES.defendTheTown] });
    expect(hill(resolveRecords(none.state, none.ctx, CODES.defendTheTown, "forced", idOf(none.state, CODES.defendTheTown)).state).damage).toBe(0);
  });
});

describe("19072 Rout the Goblins", () => {
  it("19072:A:1 it gets +5 quest points for each Goblin enemy in play, in the staging area or engaged", () => {
    expect(stat(nightTable(world, { staging: [CODES.routTheGoblins] }).state, CODES.routTheGoblins, "questPoints")).toBe(5);
    const t = nightTable(world, { staging: [CODES.routTheGoblins, CODES.goblinTroop], engaged: [CODES.strayGoblin] });
    expect(stat(t.state, CODES.routTheGoblins, "questPoints")).toBe(15);
    const one = nightTable(world, { staging: [CODES.routTheGoblins, CODES.dagnir, CODES.goblinTroop] });
    expect(stat(one.state, CODES.routTheGoblins, "questPoints")).toBe(10);
  });

  it("19072:A:2 When Revealed: each player searches the encounter deck and discard pile for a different Goblin enemy and puts it into play engaged with them; the deck is shuffled", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.routTheGoblins], deck: ["f0", CODES.goblinTroop, "f3"], discard: [CODES.strayGoblin, CODES.goblinTroop] });
    const run = resolveRecords(t.state, t.ctx, CODES.routTheGoblins, "whenRevealed", idOf(t.state, CODES.routTheGoblins));
    const engaged = [0, 1].map((seat) => run.state.seats[seat]?.engaged.map((id) => run.state.cards[id]?.code));
    expect(engaged[0]).toHaveLength(1);
    expect(engaged[1]).toHaveLength(1);
    expect(engaged[0]).not.toEqual(engaged[1]);
    // The deck holds what was not found; no Goblin is left in it that was not found by a different title.
    expect(codesIn(run.state, "encounterDeck")).toEqual(expect.arrayContaining(["f0", "f3"]));
  });

  it("19072:A:1 the quest points it needs rise with each Goblin: a side quest that is full without the Goblin is not defeated while the Goblin is in play", () => {
    const quest = (layout: string[]) => {
      const base = nightTable(world, { staging: [CODES.dagnir, { code: CODES.routTheGoblins, progress: 4 }, ...layout], current: CODES.routTheGoblins, threat: [30, 30] });
      const t = { ...base, state: { ...base.state, modifiers: [...base.state.modifiers, { instanceId: base.hero2, sourceId: base.hero2, stat: "willpower" as const, amount: 20, until: "endOfPhase" as const }] } };
      let run = send(start(t.state), { type: "Commit", cardIds: [t.hero2] }, t.ctx);
      run = send(run, { type: "Pass" }, t.ctx);
      return run.state.cards[idOf(run.state, CODES.routTheGoblins)]!;
    };
    expect(quest([])).toMatchObject({ zone: "victory" });
    // With a Goblin in the staging area it needs 10; with five of them 30, which the quest does not make this round.
    expect(quest([CODES.goblinTroop])).toMatchObject({ zone: "victory" });
    const many = quest([CODES.goblinTroop, CODES.strayGoblin, CODES.goblinTroop, CODES.strayGoblin, CODES.goblinTroop]);
    expect(many.zone).toBe("staging");
    expect(many.progress).toBeGreaterThan(4);
  });
});

describe("19073 Face the Dragon", () => {
  // The combat phase: Dagnir (considered engaged with each player once 3 side quests are in the victory display) attacks the first hero, who is left undefended and has too few hit points; or another enemy does.
  const combat = (attacker: string): Run => {
    const t = nightTable(world, { phase: "Combat", staging: [CODES.faceTheDragon, { code: CODES.dagnir, damage: 9 }], victory: [CODES.drawHerFire, CODES.fortifyTheDefense, CODES.douseTheFlames], engaged: attacker === CODES.dagnir ? [] : [{ code: attacker, seat: 0 }], deck: ["f0", "f0", "f0"], threat: [30, 30] });
    let run = start(updateCard(t.state, t.hero, { damage: 5 }));
    for (let guard = 0; guard < 40 && run.state.phase === "Combat"; guard += 1) {
      if (run.state.window?.kind === "defense") {
        run = send(run, { type: "Undefended", heroId: t.hero }, t.ctx);
        continue;
      }
      const intents = legalIntents(run.state, t.ctx);
      const next = intents.find((intent) => intent.type === "Pass") ?? intents.find((intent) => intent.type === "DeclineAttack");
      if (!next) break;
      run = send(run, next as PlayerIntent, t.ctx);
    }
    return run;
  };

  it("19073:A:1 after Dagnir attacks and destroys a character, 5 damage are healed from him", () => {
    const run = combat(CODES.dagnir);
    expect(run.state.cards[idOf(run.state, CODES.dagnir)]?.damage).toBe(4);
    expect(run.steps.some((step) => step.kind === "damage" && step.amount === -5)).toBe(true);
  });

  it("19073:A:1 an attack by another enemy that destroys a character heals nothing", () => {
    const run = combat(CODES.goblinTroop);
    expect(run.state.cards[idOf(run.state, CODES.dagnir)]?.damage).toBe(9);
  });

  it("19073:A:2 after it is defeated 5 damage are dealt to Dagnir", () => {
    const t = nightTable(world, { staging: [CODES.dagnir], victory: [CODES.faceTheDragon] });
    const run = resolveRecords(t.state, t.ctx, CODES.faceTheDragon, "forced", idOf(t.state, CODES.faceTheDragon));
    expect(dagnirOf(run.state).damage).toBe(5);
  });
});

describe("19075 The Dragon's Thrall and 19076 Orc of the Flame", () => {
  it("19075:A:1 after it engages you, either 3 damage to Hrogar's Hill or it makes an immediate attack against you", () => {
    const engaged = (option: string): Run => {
      const t = nightTable(world, { phase: "Encounter", staging: [CODES.theDragonSThrall, CODES.dagnir], threat: [35, 35], deck: ["f0", "f0"] });
      let run = start(t.state);
      for (let guard = 0; guard < 4 && run.state.window?.kind === "optionalEngage"; guard += 1) run = send(run, { type: "DeclineEngage" }, t.ctx);
      expect(run.state.window).toMatchObject({ kind: "choose", seat: 0, options: ["hill", "attack"] });
      return send(run, { type: "Choose", optionId: option }, t.ctx);
    };
    const damaged = engaged("hill");
    expect(hill(damaged.state).damage).toBe(3);
    expect(damaged.state.pendingAttack?.immediate).toBeFalsy();
    const attack = engaged("attack");
    expect(hill(attack.state).damage).toBe(0);
    expect(attack.state.pendingAttack).toMatchObject({ enemyId: idOf(attack.state, CODES.theDragonSThrall), seat: 0, immediate: true });
  });

  it("19075:A:2 Shadow: if the attack destroys a character, 3 damage to Hrogar's Hill", () => {
    const killing = nightFight(world, CODES.theDragonSThrall, CODES.goblinTroop, { staging: [CODES.dagnir] }, { tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    expect(hill(killing.run.state).damage).toBe(3);
    const harmless = nightFight(world, CODES.theDragonSThrall, CODES.goblinTroop, { staging: [CODES.dagnir] });
    expect(hill(harmless.run.state).damage).toBe(0);
  });

  it("19076:A:1 When Revealed: the first player chooses 2 damage to a hero he controls, or 3 damage to Hrogar's Hill", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.orcOfTheFlame, CODES.dagnir] });
    const orc = idOf(t.state, CODES.orcOfTheFlame);
    const hero = resolveRecords(t.state, t.ctx, CODES.orcOfTheFlame, "whenRevealed", orc, take("hero"));
    expect(hero.state.cards[t.hero]?.damage === 2 || hero.state.cards[t.hero2]?.damage === 2).toBe(true);
    expect(hill(hero.state).damage).toBe(0);
    expect(hero.state.cards[t.seat1Hero ?? ""]?.damage).toBe(0);
    const stage = resolveRecords(t.state, t.ctx, CODES.orcOfTheFlame, "whenRevealed", orc, take("hill"));
    expect(hill(stage.state).damage).toBe(3);
  });

  it("19076:A:1 the first player chooses, whoever reveals it: with the token on the second player their heroes take the damage", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.orcOfTheFlame, CODES.dagnir] });
    const run = resolveRecords({ ...t.state, firstPlayer: 1 }, t.ctx, CODES.orcOfTheFlame, "whenRevealed", idOf(t.state, CODES.orcOfTheFlame), take("hero"));
    expect(run.state.cards[t.seat1Hero ?? ""]?.damage).toBe(2);
    expect(run.state.cards[t.hero]?.damage).toBe(0);
  });

  it("19076:A:2 Shadow: the attacker gets +1 Attack, +2 with at least 25 damage on Hrogar's Hill", () => {
    const attackOf = (damage: number) => {
      const fight = nightFight(world, CODES.orcOfTheFlame, CODES.goblinTroop, { staging: [CODES.dagnir] }, { tweak: (state) => updateCard(state, state.questStage ?? "", { damage }) });
      return fight.run.state.cards[fight.made.hero]?.damage;
    };
    const base = (world.cards.get(CODES.goblinTroop)?.attack ?? 0) - 2;
    expect(attackOf(0)).toBe(base + 1);
    expect(attackOf(24)).toBe(base + 1);
    expect(attackOf(25)).toBe(base + 2);
  });
});

describe("19077 Town Gate, 19078 Wooden Palisade and 19079 Burning Watchtower", () => {
  it("19077:A:1 in the staging area, at the end of the quest phase it gets 1 resource; with 3 it is discarded and 4 damage are dealt to Hrogar's Hill", () => {
    const t = nightTable(world, { staging: [{ code: CODES.townGate, resources: 1 }, CODES.dagnir] });
    const gate = idOf(t.state, CODES.townGate);
    const second = resolveRecords(t.state, t.ctx, CODES.townGate, "forced", gate);
    expect(second.state.cards[gate]).toMatchObject({ zone: "staging", resources: 2 });
    expect(hill(second.state).damage).toBe(0);
    const third = resolveRecords(second.state, t.ctx, CODES.townGate, "forced", gate);
    expect(third.state.cards[gate]?.zone).toBe("encounterDiscard");
    expect(hill(third.state).damage).toBe(4);
  });

  it("19077:A:1 the Forced effect is gained in the staging area only: the active location does not hear it", () => {
    const t = nightTable(world, { active: CODES.townGate, staging: [CODES.dagnir], phase: "Quest" });
    let run = send(start(t.state), { type: "Commit", cardIds: [t.hero2] }, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    expect(run.state.cards[idOf(run.state, CODES.townGate)]?.resources ?? 0).toBe(0);
  });

  it("19077:A:2 Travel: Dagnir makes an immediate attack against the first player", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.dagnir, CODES.townGate], phase: "Travel", deck: ["f0", "f0"] });
    const run = resolveRecords({ ...t.state, firstPlayer: 1 }, t.ctx, CODES.townGate, "travel", idOf(t.state, CODES.townGate));
    expect(run.state.pendingAttack).toMatchObject({ enemyId: idOf(t.state, CODES.dagnir), seat: 1, immediate: true });
  });

  it("19078:A:1 while Wooden Palisade is the active location Dagnir gets -2 Attack, and not while it is in the staging area", () => {
    expect(stat(nightTable(world, { staging: [CODES.dagnir], active: CODES.woodenPalisade }).state, CODES.dagnir, "attack")).toBe(5);
    expect(stat(nightTable(world, { staging: [CODES.dagnir, CODES.woodenPalisade] }).state, CODES.dagnir, "attack")).toBe(7);
  });

  it("19078:A:2 Travel: the first player readies a hero he controls", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.woodenPalisade] });
    const tired = updateCard(updateCard(t.state, t.seat1Hero ?? "", { exhausted: true }), t.hero, { exhausted: true });
    const run = resolveRecords({ ...tired, firstPlayer: 1 }, t.ctx, CODES.woodenPalisade, "travel", idOf(t.state, CODES.woodenPalisade));
    expect(run.state.cards[t.seat1Hero ?? ""]?.exhausted).toBe(false);
    expect(run.state.cards[t.hero]?.exhausted).toBe(true);
  });

  it("19079:A:1 its Threat X is 1 more than the number of side quests in the victory display", () => {
    expect(stat(nightTable(world, { staging: [CODES.burningWatchtower], victory: victory(2) }).state, CODES.burningWatchtower, "threat")).toBe(3);
  });

  it("19079:A:2 Travel: each player assigns X damage among characters he controls", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.burningWatchtower], victory: victory(1) });
    const run = resolveRecords(t.state, t.ctx, CODES.burningWatchtower, "travel", idOf(t.state, CODES.burningWatchtower), (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const damage = (id: string | null) => run.state.cards[id ?? ""]?.damage ?? 0;
    expect(damage(t.hero) + damage(t.hero2)).toBe(2);
    expect(damage(t.seat1Hero)).toBe(2);
  });
});

describe("19080 Powerful in Wrath, 19081 The Dragon's Fury and 19082 Bright Flames", () => {
  it("19080:A:2 When Revealed: the active location is discarded and its Threat is dealt as damage to Hrogar's Hill", () => {
    const t = nightTable(world, { staging: [CODES.powerfulInWrath, CODES.dagnir], active: CODES.woodenPalisade });
    const run = resolveRecords(t.state, t.ctx, CODES.powerfulInWrath, "whenRevealed", idOf(t.state, CODES.powerfulInWrath));
    expect(hill(run.state).damage).toBe(2);
    expect(run.state.cards[idOf(run.state, CODES.woodenPalisade)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[idOf(run.state, CODES.powerfulInWrath)]?.zone).toBe("staging");
  });

  it("19080:A:2 with no damage dealt (no active location) Powerful in Wrath gains surge: another card is revealed", () => {
    const t = nightTable(world, { staging: [CODES.dagnir], deck: ["f0", "f3"] });
    const run = send(start({ ...t.state, ...{ phase: "Quest" as const } }), { type: "Pass" }, t.ctx);
    void run;
    const revealed = nightTable(world, { staging: [CODES.dagnir], deck: [CODES.powerfulInWrath, "f3", "f0"] });
    let phased = send(start(revealed.state), { type: "Commit", cardIds: [revealed.hero2] }, revealed.ctx);
    phased = finish(send(phased, { type: "Pass" }, revealed.ctx), revealed.ctx);
    expect(codesIn(phased.state, "staging")).toContain("f3");
    expect(hill(phased.state).damage).toBe(0);
  });

  it("19080:A:3 Shadow: the excess damage of the attack goes to Hrogar's Hill", () => {
    // The defender has 1 hit point left: the attack's damage beyond it (Goblin Troop's attack less 2 Defense, less the 1) lands on the stage.
    const fight = nightFight(world, CODES.powerfulInWrath, CODES.goblinTroop, { staging: [CODES.dagnir] }, { tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    const dealt = Math.max(0, (world.cards.get(CODES.goblinTroop)?.attack ?? 0) - 2);
    expect(hill(fight.run.state).damage).toBe(Math.max(0, dealt - 1));
    const without = nightFight(world, "f0", CODES.goblinTroop, { staging: [CODES.dagnir] }, { tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    expect(hill(without.run.state).damage).toBe(0);
  });

  it("19081:A:1 When Revealed: Dagnir makes an immediate attack against the first player, and the damage left undefended goes on Hrogar's Hill", () => {
    const t = nightTable(world, { staging: [CODES.theDragonSFury, CODES.dagnir], deck: ["f0", "f0"] });
    const run = resolveRecords(t.state, t.ctx, CODES.theDragonSFury, "whenRevealed", idOf(t.state, CODES.theDragonSFury));
    expect(run.state.pendingAttack).toMatchObject({ enemyId: idOf(t.state, CODES.dagnir), seat: 0, immediate: true, toStage: true });
    expect(run.state.pendingAttack?.excessToStage).toBeFalsy();
    const undefended = undefendedOn(run, t);
    expect(hill(undefended.state).damage).toBe(7);
    expect(undefended.state.cards[t.hero]?.damage).toBe(0);
    // A defender takes the damage as usual, and the stage none.
    const defended = send(run, { type: "DeclareDefender", defenderId: t.hero }, t.ctx);
    expect(hill(defended.state).damage).toBe(0);
    expect(defended.state.cards[t.hero]?.damage).toBe(5);
  });

  it("19081:A:2 Shadow: the attacking enemy makes an additional attack against you after this one", () => {
    const fight = nightFight(world, CODES.theDragonSFury, CODES.goblinTroop, { staging: [CODES.dagnir] });
    expect(fight.run.steps.filter((step) => step.kind === "attack" && step.side === "enemy")).toHaveLength(2);
  });

  it("19082:A:1 When Revealed: each player assigns X damage among characters he controls, X one more than the side quests in the victory display", () => {
    const t = nightTable(world, { seats: 2, staging: [CODES.brightFlames], victory: victory(2) });
    const run = resolveRecords(t.state, t.ctx, CODES.brightFlames, "whenRevealed", idOf(t.state, CODES.brightFlames), (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    expect((run.state.cards[t.hero]?.damage ?? 0) + (run.state.cards[t.hero2]?.damage ?? 0)).toBe(3);
    expect(run.state.cards[t.seat1Hero ?? ""]?.damage).toBe(3);
  });

  it("19082:A:2 Shadow: the attacker gets +1 Attack for each side quest in the victory display", () => {
    const damageWith = (n: number) => {
      const fight = nightFight(world, CODES.brightFlames, CODES.goblinTroop, { staging: [CODES.dagnir], victory: victory(n) });
      return fight.run.state.cards[fight.made.hero]?.damage;
    };
    expect((damageWith(3) ?? 0) - (damageWith(0) ?? 0)).toBe(3);
  });
});
