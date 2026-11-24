// Rules: ats.setup-the-druadan-forest, ats.prowl, hon.siege, hon.archery, rr.travel, rr.discard-pile-and-victory-display, faq.progress-without-advancing (data/rules/entries.json). The engine facts of the flags, the verb, the pick filter and the amount The Drúadan Forest adds in the pelargir family that no printed line shows by itself: the attack
// read with Willpower, the attack damage placed as progress and only that damage, the enemy that fills with progress, the Travel cost every player pays, a hero with no resources, the archery of the highest Wose. The printed lines are tested in src/campaign/scenarios/the-druadan-forest/.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { type ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { attackStrength, strikeEnemy } from "../../combat/combat.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { finish, idOf, legalTargets, send, start as begin, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { CODES, run, table } from "../../../../test/scenarios/the-druadan-forest/table.ts";

const { passageOut: STAGE_3, druBuriDru: DRU, thief: THIEF, elite: ELITE, hunter: HUNTER, glade: GLADE, drummer: DRUMMER, garden: GARDEN } = CODES;
const HERO = "dh1";

// A hero whose Attack is high and whose Willpower is 2 (the stand-in's own): the attack is read with the stat the stage names.
const strong = (state: ScenarioState, hero: string, attack = 3): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: hero, sourceId: hero, stat: "attack", amount: attack, until: "endOfPhase" }] });
const strike = (made: LayoutTable, state: ScenarioState, enemy: string, attackers: string[]): { state: ScenarioState; steps: EngineStep[] } => {
  const steps: EngineStep[] = [];
  return { state: strikeEnemy(state, 0, enemy, attackers, made.ctx, steps), steps };
};

describe("attackWithWillpower (06044:B:2)", () => {
  it("reads the character's Willpower as the attack strength while stage 3 is current, with no Attack bonus added, and the Attack as usual on the other stages", () => {
    const stage3 = table({ stage: STAGE_3, engaged: [THIEF] });
    const enemy = idOf(stage3.state, THIEF);
    const hero = idOf(stage3.state, HERO);
    expect(attackStrength(strong(stage3.state, hero), [hero], enemy, stage3.ctx.cards)).toBe(2);
    const stage1 = table({ engaged: [THIEF] });
    expect(attackStrength(strong(stage1.state, idOf(stage1.state, HERO)), [idOf(stage1.state, HERO)], idOf(stage1.state, THIEF), stage1.ctx.cards)).toBe(5);
  });

  it("counts the +1 Willpower of Drû-buri-Drû in the victory display, as it counts any Willpower", () => {
    const made = table({ stage: STAGE_3, engaged: [THIEF], victory: [DRU] });
    const hero = idOf(made.state, HERO);
    expect(attackStrength(made.state, [hero], idOf(made.state, THIEF), made.ctx.cards)).toBe(3);
  });
});

describe("attackDamageAsProgress (06044:B:2)", () => {
  it("places the damage of a character's attack as progress tokens on the enemy, the Defense still subtracted, and no damage tokens", () => {
    const made = table({ stage: STAGE_3, engaged: [THIEF] });
    const enemy = idOf(made.state, THIEF);
    const after = strike(made, made.state, enemy, [idOf(made.state, HERO)]);
    expect(after.state.cards[enemy]).toMatchObject({ progress: 1, damage: 0 });
    expect(after.steps.some((step) => step.kind === "progress" && step.targetId === enemy && step.amount === 1)).toBe(true);
  });

  it("leaves damage from an effect as damage, and the same attack on another stage as damage", () => {
    const made = table({ stage: STAGE_3, engaged: [THIEF] });
    const enemy = idOf(made.state, THIEF);
    const hurt = run(made, made.state, { verb: "DamageCard", amount: 1, target: "picked" }, null);
    expect(hurt.cards[enemy]?.progress).toBe(0);
    const earlier = table({ engaged: [THIEF] });
    const struck = strike(earlier, earlier.state, idOf(earlier.state, THIEF), [idOf(earlier.state, HERO)]);
    expect(struck.state.cards[idOf(earlier.state, THIEF)]).toMatchObject({ progress: 0, damage: 1 });
  });
});

describe("progressToVictory (06044:B:2)", () => {
  it("moves an enemy whose progress equals its printed hit points to the victory display and puts all its progress on the quest", () => {
    const made = table({ stage: STAGE_3, progress: 3, staging: [{ code: HUNTER, progress: 3 }, { code: THIEF, progress: 2 }] });
    const settled = settle(made.state, made.ctx, []);
    // The Hunter (3 hit points) holds 3 progress and goes; the Thief (2 hit points) holds 2 and goes too.
    expect(settled.cards[idOf(made.state, HUNTER)]).toMatchObject({ zone: "victory", progress: 0 });
    expect(settled.cards[idOf(made.state, THIEF)]?.zone).toBe("victory");
    expect(settled.cards[settled.questStage ?? ""]?.progress).toBe(3 + 3 + 2);
  });

  it("keeps an enemy with fewer progress than its hit points where it is, and takes progress above the hit points whole", () => {
    const made = table({ stage: STAGE_3, staging: [{ code: HUNTER, progress: 2 }, { code: ELITE, progress: 5 }] });
    const settled = settle(made.state, made.ctx, []);
    expect(settled.cards[idOf(made.state, HUNTER)]).toMatchObject({ zone: "staging", progress: 2 });
    expect(settled.cards[idOf(made.state, ELITE)]?.zone).toBe("victory");
    expect(settled.cards[settled.questStage ?? ""]?.progress).toBe(5);
  });

  it("does nothing on a stage without the flag", () => {
    const made = table({ staging: [{ code: HUNTER, progress: 3 }] });
    expect(settle(made.state, made.ctx, []).cards[idOf(made.state, HUNTER)]?.zone).toBe("staging");
  });

  it("wins only with Drû-buri-Drû in the victory display: his progress comes first, and a stage full of progress waits for him", () => {
    // He fills with 6 progress: he is in the display when the tokens land, so the stage (12 and 6 on 14) is defeated at once.
    const him = table({ stage: STAGE_3, progress: 12, staging: [{ code: DRU, progress: 6 }] });
    const won = settle(him.state, him.ctx, []);
    expect(won.cards[idOf(him.state, DRU)]?.zone).toBe("victory");
    expect(won.stageCleared).toBe(true);
    // Another enemy fills the stage while Drû-buri-Drû is in the staging area: the progress piles up and the stage is not defeated.
    const other = table({ stage: STAGE_3, progress: 12, staging: [DRU, { code: ELITE, progress: 4 }] });
    const held = settle(other.state, other.ctx, []);
    expect(held.cards[held.questStage ?? ""]?.progress).toBe(16);
    expect(held.stageCleared).toBeFalsy();
    expect(restricted(held, other.ctx, "advance").length).toBeGreaterThan(0);
    // When he is then destroyed (in the discard pile) the stage's own bar still holds.
    const gone = settle({ ...held, cards: { ...held.cards, [idOf(other.state, DRU)]: { ...held.cards[idOf(other.state, DRU)]!, zone: "encounterDiscard" } } }, other.ctx, []);
    expect(restricted(gone, other.ctx, "advance").length).toBeGreaterThan(0);
  });
});

describe("EachPlayerSpends (06051:A:2)", () => {
  // Two seats in the travel phase with the Garden of Poisons in the staging area: the first seat's hero holds `first` resources and the second seat's `second`.
  const garden = (first: number, second: number): LayoutTable => {
    const made = table({ seats: 2, phase: "Travel", staging: [GARDEN] });
    const held = [first, second];
    const cards = { ...made.state.cards };
    made.state.seats.slice(0, 2).forEach((seat, index) => seat.heroes.forEach((id, at) => (cards[id] = { ...cards[id]!, resources: at === 0 ? (held[index] ?? 0) : 0 })));
    return { ...made, state: { ...made.state, cards } };
  };
  const heroPools = (state: ScenarioState): number[] => state.seats.slice(0, 2).map((seat) => seat.heroes.reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0), 0));
  const travels = (made: LayoutTable): boolean => legalTargets(made.state, { type: "Travel" }, made.ctx).includes(idOf(made.state, GARDEN));

  it("is a Travel the players can pay while every player holds the resource, and takes 1 from each player's own heroes", () => {
    const made = garden(1, 1);
    expect(travels(made)).toBe(true);
    const sent = send(begin(made.state), { type: "Travel", locationId: idOf(made.state, GARDEN) }, made.ctx);
    const state = finish(sent, made.ctx).state;
    expect(heroPools(state)).toEqual([heroPools(made.state)[0]! - 1, heroPools(made.state)[1]! - 1]);
    expect(state.activeLocation).toBe(idOf(made.state, GARDEN));
  });

  it("cannot be traveled to when any one player holds none: another player's resources do not pay for him", () => {
    const made = garden(3, 0);
    expect(heroPools(made.state)[1]).toBe(0);
    expect(travels(made)).toBe(false);
    expect(travels(garden(0, 3))).toBe(false);
  });
});

describe("hasResources: false (06048:A:2, 06053:A:2)", () => {
  it("leaves out each hero with a resource, so a count reads the heroes with none", () => {
    const made = table({ seats: 2, heroResources: 2 });
    const spec = { type: "hero" as const, control: "any" as const, hasResources: false };
    const empty = pickCandidates(made.state, spec, 0, [], null, made.ctx);
    const holding = pickCandidates(made.state, { ...spec, hasResources: true }, 0, [], null, made.ctx);
    expect(empty.every((id) => (made.state.cards[id]?.resources ?? 0) === 0)).toBe(true);
    expect(holding.every((id) => (made.state.cards[id]?.resources ?? 0) > 0)).toBe(true);
    expect(empty.length + holding.length).toBe(pickCandidates(made.state, { type: "hero", control: "any" }, 0, [], null, made.ctx).length);
  });
});

describe("archeryOf (06052:A:2)", () => {
  const amount = { archeryOf: { type: "enemy" as const, control: "any" as const, trait: "Wose", staging: true as const }, max: true as const };
  const read = (made: LayoutTable): number => resolveAmount(made.state, amount, { actor: 0, sourceId: null }, made.ctx);

  it("is 0 with no Wose, and the total archery of the Wose with the most otherwise: printed Archery plus the Glade's gain, not the sum of them all", () => {
    expect(read(table({ staging: [GLADE] }))).toBe(0);
    // The Elite prints Archery 2 and gains 1 from the Glade: 3. The Drummer prints none and gains 1.
    expect(read(table({ staging: [GLADE, DRUMMER] }))).toBe(1);
    expect(read(table({ staging: [GLADE, ELITE, DRUMMER] }))).toBe(3);
  });

  it("reads what a card gives itself too, so the Hunter counts the heroes with no resources, and two Glades add their gains", () => {
    const hunter = table({ staging: [GLADE, HUNTER] });
    const heroesWithNone = hunter.state.seats[0]?.heroes.filter((id) => (hunter.state.cards[id]?.resources ?? 0) === 0).length ?? 0;
    expect(read(hunter)).toBe(heroesWithNone + 1);
    expect(read(table({ staging: [GLADE, GLADE, ELITE] }))).toBe(4);
  });
});
