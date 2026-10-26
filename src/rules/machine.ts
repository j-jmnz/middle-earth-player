// Rules: rr.framework-steps, ltp.playing-the-game, ltp.phase-1-resource, ltp.gain-resources, ltp.draw-cards,
// ltp.phase-6-combat, mec109.archery, rr.hit-points, rr.player-elimination (data/rules/entries.json).
import { applyTrigger } from "./actions.ts";
import {
  applyDefense,
  applyPlayerAttack,
  applyUndefended,
  archeryRecipients,
  archeryTotal,
  assignArchery,
  beginEnemyAttack,
  continueStrike,
  dealShadows,
  hasLegalAttack,
  undefendedTargets,
  nextEnemyGroup,
  openDefense,
} from "./combat.ts";
import { applyChoice } from "./choices.ts";
import { ruleCause } from "./cause.ts";
import { canAnnounce, drainEvents } from "./events.ts";
import { advanceFrame, stagingStep } from "./frames.ts";
import { commitHide, pruneRoundRecords } from "./hide.ts";
import type { EngineStep, PlayerIntent } from "./intents.ts";
import { queueEvent } from "./queue.ts";
import { drawOne, gainSeatResources, type ReduceContext } from "./interpret.ts";
import { applyPass, modeAfterPass } from "./pass.ts";
import { applyResolution, openResolution } from "./resolution.ts";
import { playCard } from "./planning.ts";
import { afterPlay } from "./families/costs-play.ts";
import { playSweep } from "./families/play-sweep.ts";
import { afterPaying } from "./families/deck-play.ts";
import { doRefresh } from "./refresh.ts";
import { engagementStep, engageEnemy, optionalEnemies } from "./quest.ts";
import { travelIntent } from "./travel.ts";
import { resolutionStep } from "./stage-reveal.ts";
import { crossBoundary } from "./triggers.ts";
import { constantWin, heldStat, NO_COUNTS } from "./constants.ts";
import { finishMulliganChoice, finishSetup, mulliganSeat } from "./setup.ts";
import { attackResumes, discardShadows, resolveAttack, resumeAttack } from "./shadow.ts";
import { stepWindow, stepWindowResumes } from "./step-window.ts";
import { flagged, inPlay, livingSeats, markReached, reached, updateCard, withMode, type ScenarioState } from "./state.ts";
import { clearEliminated, damageHeld, destroyOverwhelmed } from "./keywords.ts";
import { effectsOf } from "./listen.ts";
import { engagesAgain, optionallyEngaged } from "./families/quest-engage.ts";
import { syncThreatSaves } from "./families/quest-threat.ts";
import { eventWaits } from "./families/defense-listen.ts";
import { announceShadowsDealt } from "./families/defense-shadow.ts";
import { attackedEarly, earlyAttacks } from "./families/defense-order.ts";
import { strikeResumes } from "./families/attack-flow.ts";
import { announceProgress } from "./families/burden-effects.ts";

export function settle(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let current = handoffEliminated(state);
  for (let guard = 0; guard < 400; guard += 1) {
    current = announceProgress(constantWin(current, ctx), steps, ctx);
    if (current.stageCleared && !current.window && !current.failure) {
      const asking = openResolution(current, ctx);
      if (asking !== current) {
        current = asking;
        continue;
      }
    }
    // An event waits behind the damage it follows while that damage is still being answered (rr.cancel).
    if (current.pendingEvents?.length && !current.lost && !current.stageCleared && !current.failure && canAnnounce(current) && !eventWaits(current)) {
      const announced = drainEvents(current, ctx, steps);
      if (announced !== current) {
        current = announced;
        continue;
      }
    }
    // A character's lethal damage waits for the Responses that could cancel it, when some card in play or in hand has one.
    const answerable = damageAnswerable(current, ctx);
    if (answerable !== (current.holdLethal === true)) {
      const { holdLethal: _was, ...rest } = current;
      current = answerable ? { ...rest, holdLethal: true } : rest;
    }
    // The seats a card keeps in the game at the threat elimination level (10124:A:2).
    current = syncThreatSaves(current, ctx, steps);
    // A cancel already resolving holds the damage too, even when paying for it discarded the last card that could answer
    // (Loyal Hound, 19148).
    const resolving = current.stack.some((frame) => frame.data.kind === "effect" && frame.data.hold != null);
    const held = answerable || resolving ? damageHeld : undefined;
    // The play family's constants (families/play-sweep.ts): hero card type, first player control, discard at a stat.
    const swept = current.lost || current.failure ? current : destroyOverwhelmed(playSweep(clearEliminated(current, ctx.cards), ctx, steps), ctx.cards, steps, held);
    if (swept !== current) {
      current = swept;
      continue;
    }
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
    case "PlayCard": {
      // A play is an action opportunity taken: every seat may act again before the window closes (rr.action-windows).
      // What the play adds beyond moving the card (families/costs-play.ts): its discount's riders, its additional costs.
      // A Response that lowered its cost as it was played is paid for (families/deck-play.ts).
      const played = afterPaying(state, afterPlay(state, playCard(state, intent, ctx, steps), intent, ctx, steps), intent, ctx, steps);
      return played.window?.kind === "pass" ? { ...played, passed: [] } : played;
    }
    case "Commit":
      return commit(state, intent.cardIds, steps);
    case "CommitHide":
      return commitHide(state, intent.cardIds, steps);
    case "Trigger":
      return applyTrigger(state, intent, ctx, steps);
    case "Choose":
      return applyChoice(state, intent.optionId);
    case "ChooseResolution":
      return applyResolution(state, intent.optionId);
    case "Travel":
      return travelIntent(state, intent.locationId, ctx, steps);
    case "DeclineTravel":
      return { ...markReached(state, "traveled"), window: null };
    case "Engage": {
      // "After you optionally engage an enemy", and a seat that may optionally engage an additional enemy (09002:A:2).
      const engaged = optionallyEngaged(engageEnemy(state, state.activeSeat, intent.enemyId, steps), state.activeSeat, intent.enemyId, ctx);
      return engagesAgain(engaged, state.activeSeat, ctx) ? engaged : finishOptional(engaged, state.activeSeat);
    }
    case "DeclineEngage":
      return finishOptional(state, state.activeSeat);
    case "ChooseEnemy":
      return chooseEnemy(state, intent.enemyId, ctx, steps);
    case "DeclareDefender":
      return applyDefense(state, intent.defenderId, ctx, steps);
    case "Undefended":
      return applyUndefended(state, undefendedHero(state, intent.heroId, ctx), ctx, steps);
    case "DeclareAttackers":
      return applyPlayerAttack(state, state.activeSeat, intent.enemyId, intent.attackerIds, ctx, steps);
    case "DeclineAttack":
      return { ...state, passed: [...state.passed, state.activeSeat], window: null };
    case "Distribute":
      return assignArchery(state, intent.assignments, ctx, steps);
    default:
      return state;
  }
}

function automatic(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // An attack waits on the action window between two of its steps; once it closes, the attack goes on before any frame
  // under it (an attack a Hide test started).
  // A player attack an effect made during an enemy attack's window goes on first (families/attack-flow.ts).
  if (stepWindowResumes(state)) return strikeResumes(state) ? continueStrike(state, ctx, steps) : resumeAttack(state, ctx, steps);
  if (state.stack.length > 0) return advanceFrame(state, ctx, steps);
  // The Forced effects of an attack's start are done: the defender is declared (141069:A:2).
  if (state.pendingAttack?.defenseWaits) return openDefense(state, ctx);
  // The Responses to a shadow effect, or a shadow effect that asked a player, are done: the attack goes on.
  if (attackResumes(state)) return resolveAttack(state, ctx, steps);
  switch (state.mode) {
    case "afterOpening":
      return finishSetup(state, ctx, steps);
    case "beginRound":
      return enterBegin(state, ctx);
    case "resourceGrant":
      return grant(state, steps);
    case "resourceActions":
    case "questCommit":
      return openPass(state);
    case "planning": {
      const opened = openPass(state);
      return { ...opened, planningSeat: opened.activeSeat };
    }
    case "staging":
      return stagingStep(state, ctx, steps);
    case "resolution":
      // The windows after staging (3.3) and after quest resolution (3.4).
      return stepWindow(state, ctx, state.questResolved ? "3.4" : "3.3") ?? resolutionStep(state, ctx, steps);
    case "travel": {
      // The travel opportunity was taken or declined: the window after it (4.2), still in the Travel phase.
      if (reached(state, "traveled")) return stepWindow(state, ctx, "4.2") ?? withMode(state, "optionalEngage");
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
    case "engagement": {
      const opened = stepWindow(state, ctx, "5.2");
      if (opened) return opened;
      const next = engagementStep(state, ctx.cards, steps);
      // The checks are done: the window after them (5.3) opens in the Encounter phase, before combat begins.
      return next.mode === "combatStart" ? (stepWindow(state, ctx, "5.3") ?? next) : next;
    }
    case "combatStart":
      return startCombat(state, ctx);
    case "combatShadows":
      return withMode(announceShadowsDealt(dealShadows(state, ctx.cards), ctx), "combatActions");
    case "combatActions":
      return stepWindow(state, ctx, "6.2") ?? withMode(state, "enemyAttacks");
    case "enemyAttacks":
      return enemyStep(state, ctx, steps);
    case "playerAttacks":
      return openPlayer(state, ctx);
    case "refresh":
      return doRefresh(state, ctx, steps);
    case "endRound":
      return stepWindow(state, ctx, "7.4") ?? withMode(state, "beginRound");
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
  for (const seat of livingSeats(next)) next = gainSeatResources(next, seat, steps, ruleCause("rr.step-1-2"));
  for (const seat of livingSeats(next)) {
    // A card that lets its player draw additional cards in the resource phase holds an extraDraw on the seat.
    const draws = 1 + heldStat(next, seat, "extraDraw", NO_COUNTS);
    for (let draw = 0; draw < draws; draw += 1) next = drawOne(next, seat, steps, ruleCause("rr.step-1-3"));
  }
  return openPass(withMode(next, "resourceActions"));
}

function openOptional(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  // No enemy a player could optionally engage (rr.optional-engagement): the step has nothing to offer.
  if (optionalEnemies(state, ctx.cards).length === 0) {
    return { ...withMode(state, "engagement"), window: null, engagement: { ordinal: 0, engagedThisPass: false } };
  }
  const seated = state.mode === "optionalEngage" ? state : withMode(state, "optionalEngage");
  return { ...seated, window: { kind: "optionalEngage" }, activeSeat: livingSeats(seated)[0] ?? seated.firstPlayer };
}

// Archery damage is dealt as the combat phase begins (mec109.archery, rr.step-6-1), before the shadow cards
// (rr.step-6-2).
function startCombat(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const total = archeryTotal(state, ctx.cards);
  const next = { ...withMode(state, "combatShadows"), resolvedAttacks: [], declaredAttacks: [], pendingAttack: null };
  if (total > 0 && archeryRecipients(next, ctx.cards).length > 0) {
    return { ...next, window: { kind: "archery", total }, activeSeat: livingSeats(next)[0] ?? next.firstPlayer };
  }
  return next;
}

function enemyStep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // A player who attacks before enemy attacks resolve does so first (17085).
  const early = earlyAttacks(state, ctx);
  if (early) return early;
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
    (index) => !state.passed.includes(index) && !attackedEarly(state, index) && hasLegalAttack(state, index, ctx.cards),
  );
  if (seat == null) return withMode(discardShadows(state), "refresh");
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
    // "Does not exhaust to commit to a quest" (a flag) leaves the character ready.
    next = updateCard(next, id, { committed: true, exhausted: !flagged(next, id, "noExhaustQuest") });
    steps.push({ kind: "commit", cardId: id });
    next = queueEvent(next, { trigger: "committed", seat: state.activeSeat, cardId: id });
  }
  return next;
}

function undefendedHero(state: ScenarioState, heroId: string | undefined, ctx: ReduceContext): string {
  const heroes = undefendedTargets(state, state.pendingAttack?.seat ?? state.activeSeat, ctx.cards);
  if (heroes.length === 1) return heroes[0] ?? "";
  return heroId ?? "";
}

// Whether any card that could answer damage just dealt (a damageDealt Response or Forced effect) is in play or in a hand.
function damageAnswerable(state: ScenarioState, ctx: ReduceContext): boolean {
  return Object.values(state.cards).some(
    (card) => (inPlay(card.zone) || card.zone === "hand") && effectsOf(ctx, card.code).some((effect) => effect.trigger === "damageDealt"),
  );
}
