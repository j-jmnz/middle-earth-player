import { modifiedStat } from "../../../src/rules/core/keywords.ts";
import { ELIMINATION_LEVEL } from "../../../src/rules/core/eliminate.ts";
import { printedOf } from "../../../src/rules/core/printed.ts";
import { victoryPointsOf } from "../../../src/rules/core/printed-stat.ts";
import { flagged, type CardInstance, type ScenarioState } from "../../../src/rules/core/state.ts";
import { engagementCostOf, questPointsOf, questStatOf, stagingThreat } from "../../../src/rules/quest/quest.ts";
import type { ReduceContext } from "../../../src/rules/engine/reduce.ts";

// The score the fixture search ranks a table by, read from the state alone (no scenario code in the default path): how far the quest is, what
// the players hold, and how close each seat and each must-survive card is to the end. A scenario adds a term through `ScoreHook`.
// The higher the better. A won game is above every other, a lost game below.

/** An extra term for one scenario: added to the generic score of a table. */
export type ScoreHook = (state: ScenarioState, ctx: ReduceContext) => number;

const WON = 1_000_000;
const LOST = -1_000_000;

/** The quest cards the players are at: the shared stage, or each living seat's own while the stages are separate. */
function questCards(state: ScenarioState): CardInstance[] {
  const ids = [state.questStage, ...state.seats.slice(0, state.seatCount).map((seat) => (seat.eliminated ? undefined : seat.stage))];
  return [...new Set(ids)].flatMap((id) => {
    const card = id ? state.cards[id] : undefined;
    return card ? [card] : [];
  });
}

/** How many stages the players have left behind: the stages reached, else the place of the current stage in the scenario's list. */
export function stageIndex(state: ScenarioState): number {
  const reached = state.stagesReached?.length;
  const places = questCards(state).map((card) => state.stages.findIndex((stage) => stage.code === card.code));
  return Math.max(reached != null ? reached - 1 : 0, ...places, 0);
}

/** A card the game is lost with: printed "if X leaves play, the players lose" or the flag a card gives its host. */
export function mustSurvive(state: ScenarioState, ctx: ReduceContext, id: string): boolean {
  const card = state.cards[id];
  return card != null && (printedOf(ctx.cards, card.code).leavesPlayLoses === true || flagged(state, id, "lossOnLeavingPlay"));
}

function hitPoints(state: ScenarioState, ctx: ReduceContext, card: CardInstance): number {
  return Math.max(1, modifiedStat(state, card, "hitPoints", ctx.cards));
}

/** The characters of the living seats: heroes first, then allies in play. */
function charactersOf(state: ScenarioState, ctx: ReduceContext): { hero: boolean; card: CardInstance }[] {
  const out: { hero: boolean; card: CardInstance }[] = [];
  for (const seat of state.seats.slice(0, state.seatCount)) {
    if (seat.eliminated) continue;
    for (const id of seat.heroes) {
      const card = state.cards[id];
      if (card) out.push({ hero: true, card });
    }
    for (const id of seat.play) {
      const card = state.cards[id];
      const type = card ? printedOf(ctx.cards, card.code).type : null;
      if (card && type === "ally" && card.host == null) out.push({ hero: false, card });
    }
  }
  return out;
}

/** What `scoreOf` read, term by term, for a report and for the tests. */
export type ScoreParts = { stage: number; progress: number; victory: number; heroes: number; damage: number; allies: number; threat: number; enemies: number; staging: number; life: number; trackers: number; objectives: number };

export function scorePartsOf(state: ScenarioState, ctx: ReduceContext): ScoreParts {
  const living = state.seats.slice(0, state.seatCount);
  const people = charactersOf(state, ctx);
  const questing = people.reduce((sum, { card }) => sum + (card.exhausted ? 0 : modifiedStat(state, card, questStatOf(state, card.id, ctx.cards), ctx.cards)), 0);
  const stagingPressure = living.some((seat) => !seat.eliminated) ? stagingThreat(state, ctx.cards) : 0;
  const stage = stageIndex(state) * 1000;
  const progress = questCards(state).reduce((sum, card) => {
    const points = questPointsOf(state, card, ctx.cards);
    return sum + (points != null && points > 0 ? Math.min(card.progress, points) : card.progress) * 20;
  }, 0);
  const active = state.activeLocation ? (state.cards[state.activeLocation]?.progress ?? 0) : 0;
  const victory = state.victory.reduce((sum, id) => sum + victoryPointsOf(state, id, ctx.cards), 0) * 30 + active * 4;
  const heroes = people.filter((person) => person.hero).length * 60;
  // Damage hurts a hero by the share of its hit points gone, and a card the game is lost with by that share squared.
  const damage = -people.reduce((sum, { hero, card }) => {
    const share = Math.min(1, card.damage / hitPoints(state, ctx, card));
    return sum + share * (hero ? 40 : 15) + (mustSurvive(state, ctx, card.id) ? share * share * 400 : 0);
  }, 0);
  const allies = people.filter((person) => !person.hero).reduce((sum, { card }) => sum + 8 + modifiedStat(state, card, "willpower", ctx.cards) * 4, 0);
  // Each seat's distance to its elimination: a slow rise, then a steep one near the level.
  const threat = -living.reduce((sum, seat) => {
    if (seat.eliminated) return sum + 600;
    const near = Math.max(0, seat.threat - (ELIMINATION_LEVEL - 12));
    return sum + seat.threat * 1.5 + near * near * 6;
  }, 0);
  const engaged = living.flatMap((seat) => seat.engaged);
  // The enemies engaged now count in full, the ones the next engagement check will take (cost no higher than a seat's threat) by two thirds.
  const reach = Math.max(0, ...living.filter((seat) => !seat.eliminated).map((seat) => seat.threat));
  const weigh = (id: string) => {
    const card = state.cards[id];
    if (!card) return 0;
    // An enemy already hurt weighs less: a card that wounds it is worth something even when it does not kill.
    const share = Math.min(1, Math.max(0, card.damage / Math.max(1, modifiedStat(state, card, "hitPoints", ctx.cards))));
    return (10 + Math.max(0, modifiedStat(state, card, "attack", ctx.cards)) * 5) * (1 - 0.5 * share);
  };
  const coming = state.staging.filter((id) => {
    const card = state.cards[id];
    return card != null && printedOf(ctx.cards, card.code).type === "enemy" && (engagementCostOf(state, card, ctx.cards) ?? 99) <= reach;
  });
  const enemies = -engaged.reduce((sum, id) => sum + weigh(id), 0) - (coming.reduce((sum, id) => sum + weigh(id), 0) * 2) / 3;
  // The questing the table can field against the threat waiting in the staging area.
  const staging = 15 * Math.max(-12, Math.min(12, questing - stagingPressure));
  const life = state.life == null ? 0 : state.life * 15;
  return { stage, progress, victory, heroes, damage, allies, threat, enemies, staging, life, trackers: trackersOf(state), objectives: objectivesOf(state, ctx) };
}

/**
 * The trackers the scenario's data declares (`state.widgets`): a tracker that ends the game when it reaches its limit (the pursuit value) costs more as it
 * nears it, and one that advances the quest when it does (the tokens on The Defense of Helm's Deep) pays more as it nears it.
 */
function trackersOf(state: ScenarioState): number {
  let sum = 0;
  const lose = state.widgets.pursuitTracker;
  if (lose != null && state.pursuit != null) sum -= 800 * Math.min(1, state.pursuit / lose) ** 2;
  const win = state.widgets.defenseTracker;
  if (win) {
    const tokens = Object.values(state.cards).filter((card) => card.code === win.code && card.zone !== "discard").reduce((total, card) => total + card.resources, 0);
    sum += 150 * Math.min(1, tokens / win.limit);
  }
  return sum;
}

/** Damage on an objective in play (a card the scenario can end the game over, "Protect the Innocent holds 10 damage"): each token costs the table, whatever the scenario's card says. */
function objectivesOf(state: ScenarioState, ctx: ReduceContext): number {
  let damage = 0;
  for (const card of Object.values(state.cards)) {
    if (card.damage > 0 && (card.zone === "play" || card.zone === "staging" || card.zone === "attached") && printedOf(ctx.cards, card.code).type === "objective") damage += card.damage;
  }
  return -25 * damage;
}

/** The score of a table (higher is better): the sum of the terms above, plus the scenario's hook. */
export function scoreOf(state: ScenarioState, ctx: ReduceContext, hook?: ScoreHook): number {
  if (state.lost) return LOST;
  if (state.stageCleared) return WON;
  const parts = scorePartsOf(state, ctx);
  return Object.values(parts).reduce((sum, part) => sum + part, 0) - state.round * 2 + (hook ? hook(state, ctx) : 0);
}

/** The safe half of the beam's order: every hero standing, low threat, then progress; scenario 1's search keeps half of its beam by it. */
export function safetyOf(state: ScenarioState, ctx: ReduceContext): number {
  if (state.lost) return LOST;
  if (state.stageCleared) return WON;
  const heroes = charactersOf(state, ctx).filter((person) => person.hero).length;
  const threat = Math.max(0, ...state.seats.slice(0, state.seatCount).map((seat) => seat.threat));
  const progress = questCards(state).reduce((sum, card) => sum + card.progress, 0);
  return heroes * 100 - threat * 3 + progress;
}
