import { applyTrigger } from "./actions.ts";
import {
  applyDefense,
  applyPlayerAttack,
  applyUndefended,
  archeryRecipients,
  archeryTotal,
  assignArchery,
  beginEnemyAttack,
  dealShadows,
  hasLegalAttack,
  heroIds,
  nextEnemyGroup,
} from "./combat.ts";
import { applyChoice } from "./choices.ts";
import { advanceFrame, stagingStep } from "./frames.ts";
import { commitHide, pruneRoundRecords } from "./hide.ts";
import type { EngineStep, PlayerIntent } from "./intents.ts";
import { drawOne, gainSeatResources, type ReduceContext } from "./interpret.ts";
import { applyPass, modeAfterPass } from "./pass.ts";
import { playCard } from "./planning.ts";
import { doRefresh } from "./refresh.ts";
import { engagementStep, engageEnemy, stagingEnemies } from "./quest.ts";
import { travelIntent } from "./travel.ts";
import { resolutionStep } from "./stage-reveal.ts";
import { crossBoundary } from "./triggers.ts";
import { finishMulliganChoice, finishSetup, mulliganSeat } from "./setup.ts";
import { livingSeats, updateCard, withMode, type ScenarioState } from "./state.ts";

export function settle(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let current = handoffEliminated(state);
  for (let guard = 0; guard < 400; guard += 1) {
    if (current.lost || current.stageCleared || current.failure || current.window) return current;
    const crossed = crossBoundary(current, ctx, steps);
    const next = handoffEliminated(crossed !== current ? crossed : automatic(current, ctx, steps));
    if (next === current) return current;
    current = next;
  }
  throw new Error("Round engine exceeded its step limit");
}

export function applyIntent(
  state: ScenarioState,
  intent: PlayerIntent,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  switch (intent.type) {
    case "Keep":
      return finishMulliganChoice(state, false);
    case "Mulligan":
      return finishMulliganChoice(mulliganSeat(state, state.activeSeat, steps), true);
    case "Pass":
      return applyPass(state);
    case "PlayCard":
      return playCard(state, intent, ctx, steps);
    case "Commit":
      return commit(state, intent.cardIds, steps);
    case "CommitHide":
      return commitHide(state, intent.cardIds, steps);
    case "Trigger":
      return applyTrigger(state, intent, ctx, steps);
    case "Choose":
      return applyChoice(state, intent.optionId);
    case "Travel":
      return travelIntent(state, intent.locationId, ctx, steps);
    case "DeclineTravel":
      return { ...withMode(state, "optionalEngage"), window: null };
    case "Engage":
      return finishOptional(engageEnemy(state, state.activeSeat, intent.enemyId, steps), state.activeSeat);
    case "DeclineEngage":
      return finishOptional(state, state.activeSeat);
    case "ChooseEnemy":
      return chooseEnemy(state, intent.enemyId, ctx, steps);
    case "DeclareDefender":
      return applyDefense(state, intent.defenderId, ctx, steps);
    case "Undefended":
      return applyUndefended(state, undefendedHero(state, intent.heroId), ctx, steps);
    case "DeclareAttackers":
      return {
        ...applyPlayerAttack(state, state.activeSeat, intent.enemyId, intent.attackerIds, ctx, steps),
        window: { kind: "playerAttack" },
      };
    case "DeclineAttack":
      return { ...state, passed: [...state.passed, state.activeSeat], window: null };
    case "Distribute":
      return assignArchery(state, intent.assignments, ctx, steps);
    default:
      return state;
  }
}

function automatic(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.stack.length > 0) return advanceFrame(state, ctx, steps);
  switch (state.mode) {
    case "afterOpening":
      return finishSetup(state, ctx, steps);
    case "beginRound":
      return enterBegin(state, ctx);
    case "resourceGrant":
      return grant(state, steps);
    case "resourceActions":
    case "planning":
    case "questCommit":
      return openPass(state);
    case "staging":
      return stagingStep(state, ctx, steps);
    case "resolution":
      return resolutionStep(state, ctx, steps);
    case "travel": {
      const seat = livingSeats(state)[0];
      if (seat == null) {
        return state.lost
          ? state
          : { ...state, lost: true, lossReason: "No seats remain", window: null };
      }
      return { ...state, window: { kind: "travel" }, activeSeat: seat };
    }
    case "optionalEngage":
      return openOptional(state, ctx);
    case "engagement":
      return engagementStep(state, ctx.cards, steps);
    case "combatStart":
      return startCombat(state, ctx, steps);
    case "enemyAttacks":
      return enemyStep(state, ctx, steps);
    case "playerAttacks":
      return openPlayer(state, ctx);
    case "refresh":
      return doRefresh(state, steps);
    case "endRound":
      return hasTiming(state, ctx, "endOfRound") ? openPass(state) : withMode(state, "beginRound");
    default:
      return state;
  }
}

function enterBegin(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const bumped = pruneRoundRecords({ ...state, round: state.round + 1 });
  if (hasTiming(bumped, ctx, "beginningOfPhase")) return openPass(bumped);
  return withMode(bumped, "resourceGrant");
}

function grant(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const seat of livingSeats(next)) next = gainSeatResources(next, seat, steps);
  for (const seat of livingSeats(next)) next = drawOne(next, seat, steps);
  return openPass(withMode(next, "resourceActions"));
}

function openOptional(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (stagingEnemies(state, ctx.cards).length === 0) {
    return { ...withMode(state, "engagement"), window: null, engagement: { ordinal: 0, engagedThisPass: false } };
  }
  const seated = state.mode === "optionalEngage" ? state : withMode(state, "optionalEngage");
  return { ...seated, window: { kind: "optionalEngage" }, activeSeat: livingSeats(seated)[0] ?? seated.firstPlayer };
}

function startCombat(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const dealt = dealShadows(state, steps);
  const total = archeryTotal(dealt, ctx.cards);
  const next = { ...withMode(dealt, "enemyAttacks"), resolvedAttacks: [], pendingAttack: null };
  if (total > 0 && archeryRecipients(next, ctx.cards).length > 0) {
    return { ...next, window: { kind: "archery", total }, activeSeat: livingSeats(next)[0] ?? next.firstPlayer };
  }
  return next;
}

function enemyStep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const group = nextEnemyGroup(state);
  if (!group) return { ...withMode(state, "playerAttacks"), pendingAttack: null };
  if (group.enemies.length > 1) {
    return {
      ...state,
      activeSeat: group.seat,
      window: { kind: "chooseEnemy", reason: "attack", seat: group.seat, options: group.enemies },
    };
  }
  const enemyId = group.enemies[0];
  if (!enemyId) return withMode(state, "playerAttacks");
  return beginEnemyAttack(state, group.seat, enemyId, ctx, steps);
}

function openPlayer(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const seat = livingSeats(state).find(
    (index) => !state.passed.includes(index) && hasLegalAttack(state, index, ctx.cards),
  );
  if (seat == null) return withMode(state, "refresh");
  return { ...state, window: { kind: "playerAttack" }, activeSeat: seat };
}

function handoffEliminated(state: ScenarioState): ScenarioState {
  if (state.lost) return state.window == null ? state : { ...state, window: null };
  if (state.window == null || !state.seats[state.activeSeat]?.eliminated) return state;
  const nextSeat = livingSeats(state).find((index) => !state.passed.includes(index));
  if (nextSeat != null) return { ...state, activeSeat: nextSeat };
  if (state.window.kind === "pass") {
    return { ...withMode(state, modeAfterPass(state.mode)), window: null };
  }
  if (state.window.kind === "optionalEngage") {
    return {
      ...withMode(state, "engagement"),
      window: null,
      engagement: { ordinal: 0, engagedThisPass: false },
    };
  }
  return { ...state, window: null };
}

function openPass(state: ScenarioState): ScenarioState {
  const seats = livingSeats(state);
  return { ...state, window: { kind: "pass" }, passed: [], activeSeat: seats[0] ?? state.firstPlayer };
}

function hasTiming(state: ScenarioState, ctx: ReduceContext, timing: ReduceContext["effects"][number]["timing"]): boolean {
  if (ctx.effects.length === 0) return false;
  return ctx.effects.some((effect) => effect.timing === timing);
}

function finishOptional(state: ScenarioState, seat: number): ScenarioState {
  const passed = state.passed.includes(seat) ? state.passed : [...state.passed, seat];
  const nextSeat = livingSeats(state).find((index) => !passed.includes(index));
  if (nextSeat == null) {
    return {
      ...withMode(state, "engagement"),
      window: null,
      engagement: { ordinal: 0, engagedThisPass: false },
    };
  }
  return { ...state, passed, activeSeat: nextSeat };
}

function chooseEnemy(
  state: ScenarioState,
  enemyId: string,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const window = state.window;
  if (window?.kind !== "chooseEnemy") return state;
  if (window.reason === "attack") return beginEnemyAttack({ ...state, window: null }, window.seat, enemyId, ctx, steps);
  const engaged = engageEnemy(state, window.seat, enemyId, steps);
  const cursor = engaged.engagement ?? { ordinal: 0, engagedThisPass: false };
  return { ...engaged, window: null, engagement: { ordinal: cursor.ordinal + 1, engagedThisPass: true } };
}

function commit(state: ScenarioState, cardIds: readonly string[], steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of cardIds) {
    next = updateCard(next, id, { committed: true, exhausted: true });
    steps.push({ kind: "commit", cardId: id });
  }
  return next;
}

function undefendedHero(state: ScenarioState, heroId: string | undefined): string {
  const heroes = heroIds(state, state.pendingAttack?.seat ?? state.activeSeat);
  if (heroes.length === 1) return heroes[0] ?? "";
  return heroId ?? "";
}
