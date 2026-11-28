// Rules: rr.framework-steps, ltp.playing-the-game, ltp.phase-1-resource, ltp.gain-resources, ltp.draw-cards,
// ltp.phase-6-combat, mec109.archery, rr.hit-points, rr.player-elimination (data/rules/entries.json).
import { applyTrigger } from "../player/actions.ts";
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
} from "../combat/combat.ts";
import { applyChoice } from "../windows/choices.ts";
import { ruleCause } from "../core/cause.ts";
import { canAnnounce, drainEvents } from "../windows/events.ts";
import { advanceFrame, stagingStep } from "../windows/frames.ts";
import { commitHide, pruneRoundRecords } from "../quest/hide.ts";
import { commitFortitude } from "../families/mount-doom/commit.ts";
import { commitEscape } from "../families/escape/commit.ts";
import type { EngineStep, PlayerIntent } from "../core/intents.ts";
import { queueEvent } from "../windows/queue.ts";
import { exhaustAnnounced } from "../windows/exhaust.ts";
import { drawMany, gainSeatResources, type ReduceContext } from "../interpret/interpret.ts";
import { applyPass, modeAfterPass } from "../windows/pass.ts";
import { applyResolution, openResolution } from "../setup/resolution.ts";
import { playCard } from "../player/planning.ts";
import { afterPlay } from "../families/costs/play.ts";
import { gameReads } from "../core/game-reads.ts";
import { playSweep } from "../families/play/sweep.ts";
import { syncDire } from "../families/black-gate/dire.ts";
import { afterPaying } from "../families/deck/play.ts";
import { doRefresh } from "./refresh.ts";
import { askReadyPayments } from "../families/attachments/ready.ts";
import { engagementStep, engageEnemy, optionalEnemies } from "../quest/quest.ts";
import { declineTravel, travelIntent, travelTaken } from "../quest/travel.ts";
import { advanceFreed, resolutionStep } from "../quest/stage-reveal.ts";
import { pushDue } from "../windows/delayed.ts";
import { crossBoundary } from "../windows/triggers.ts";
import { constantWin, heldStat, NO_COUNTS } from "../interpret/constants.ts";
import { finishMulliganChoice, finishSetup, mulliganSeat, openMulligan } from "../setup/setup.ts";
import { attackResumes, discardShadows, resolveAttack, resumeAttack } from "../combat/shadow.ts";
import { stepWindow, stepWindowResumes } from "./step-window.ts";
import { areaSeats } from "../families/breaking/areas.ts";
import { flagged, inPlay, livingSeats, reached, updateCard, withMode, type ModeName, type ScenarioState } from "../core/state.ts";
import { runSettle } from "../interpret/family-hooks.ts";
import { heldByLapsedStage } from "../families/grapple/values.ts";
import { heldBySettingAside } from "../families/wilderland/heath.ts";
import { damageHeld, destroyOverwhelmed } from "../core/keywords.ts";
import { NO_SEATS_REMAIN, clearEliminated, eliminateHeroless } from "../core/eliminate.ts";
import { effectsOf } from "../windows/listen.ts";
import { engagesAgain, optionallyEngaged } from "../families/quest/engage.ts";
import { noteOptionalEngage } from "../families/pelargir/optional-engage.ts";
import { syncThreatSaves } from "../families/quest/threat.ts";
import { attachedHearsHostDamage, eventWaits } from "../families/defense/listen.ts";
import { announceShadowsDealt } from "../families/defense/shadow.ts";
import { attackedEarly, earlyAttacks } from "../families/defense/order.ts";
import { strikeResumes } from "../families/attack/flow.ts";
import { pruneRoundCaps } from "../families/dreamchaser/index.ts";
import { refillEncounterDeck } from "../interpret/verbs.ts";
import { committedTo } from "../families/stormcaller/commit.ts";
import { announceCollected } from "../families/aflame/attack.ts";
import { chooseLookDone, chooseShift, performSailing, sailingStep } from "../families/sea/sailing.ts";
import { askSmaug } from "../families/smaug/deck.ts";
import { askingToCommit, askingToLook, askingToShift } from "../families/sea/sailing-legal.ts";
import { askCurrentQuest } from "../families/wilderland/night.ts";
import { askCurrentStage } from "../families/armies/stages.ts";
import { phaseEnds } from "../families/angmar/phase.ts";
import { discardToCommit } from "../families/ring-maker/player-bars.ts";

export function settle(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let current = handoffEliminated(state);
  for (let guard = 0; guard < 400; guard += 1) {
    // The Corsair deck that ran out is refilled from its discard pile at once (dcce.corsair-deck).
    // The Stormcaller's area stands in the staging area or out of it as the players' stage says (families/stormcaller/area.ts); the Island Map's locations as the active location says (families/island/map.ts).
    // Core: the constant win check, then the families' `before` hooks (burden, island, south), the encounter deck refill, the families' `after` hooks (sea, stormcaller, island): SETTLE_ORDER.
    const beforeRefill = runSettle("before", constantWin(current, ctx), ctx, steps);
    const refilled = refillEncounterDeck(beforeRefill, steps, ctx);
    current = runSettle("after", refilled, ctx, steps);
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
    // The main quest's Dire keyword (mec113.dire) is kept on the state for the elimination level.
    current = syncDire(current, ctx);
    // A cancel already resolving holds the damage too, even when paying for it discarded the last card that could answer
    // (Loyal Hound, 19148).
    const resolving = current.stack.some((frame) => frame.data.kind === "effect" && frame.data.hold != null);
    // The Stormcaller Elite whose indestructible lapsed with the stage (12039:B:1) wait, lethal, for the When Revealed that flips them (12040:B:1), and Cold-Drake for the one that sets it aside (19024:A:1): advancing is immediate.
    const held = (candidate: ScenarioState, id: string): boolean => ((answerable || resolving) && damageHeld(candidate, id)) || heldByLapsedStage(candidate, id, ctx) || heldBySettingAside(candidate, id, ctx);
    // The play family's constants (families/play/sweep.ts): hero card type, first player control, discard at a stat.
    const swept = current.lost || current.failure ? current : runSettle("sweep", destroyOverwhelmed(playSweep(clearEliminated(eliminateHeroless(current, ctx.cards, steps), ctx.cards, ctx, steps), ctx, steps), ctx.cards, steps, held), ctx, steps);
    if (swept !== current) {
      // A seat a sweep eliminated (an empty hand on stage 3B) hands its open window on at once, as one eliminated by an intent does.
      current = handoffEliminated(swept);
      continue;
    }
    if (current.lost || current.stageCleared || current.failure || current.window) return current;
    // A full stage held back advances once nothing holds it (stage-reveal.ts).
    const freed = advanceFreed(current, ctx, steps);
    if (freed !== current) {
      current = freed;
      continue;
    }
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
      return finishMulliganChoice(mulliganSeat(state, state.activeSeat, steps, ctx), true);
    case "Resign":
      return { ...state, lost: true, lossReason: "The players resigned", window: null, pendingAttack: null };
    case "Pass":
      // A Pass while the first player is asked what to commit to the Sailing test commits no one (dcce.sailing-tests).
      return askingToCommit(state) ? performSailing(state, [], ctx, steps) : applyPass(state);
    case "PlayCard": {
      // A play is an action opportunity taken: every seat may act again before the window closes (rr.action-windows).
      // What the play adds beyond moving the card (families/costs/play.ts): its discount's riders, its additional costs.
      // A Response that lowered its cost as it was played is paid for (families/deck/play.ts).
      const played = afterPaying(state, afterPlay(state, playCard(state, intent, ctx, steps), intent, ctx, steps), intent, ctx, steps);
      return played.window?.kind === "pass" ? { ...played, passed: [] } : played;
    }
    case "Commit":
      // The first player commits characters to the Sailing test, not to the quest (families/sea/sailing.ts).
      return askingToCommit(state) ? performSailing(state, intent.cardIds, ctx, steps) : commit(state, intent.cardIds, ctx, steps);
    case "CommitHide":
      return commitHide(state, intent.cardIds, steps);
    case "CommitFortitude":
      return commitFortitude(state, intent.cardIds, steps);
    case "CommitEscape":
      return commitEscape(state, intent.cardIds, steps);
    case "Trigger":
      return applyTrigger(state, intent, ctx, steps);
    case "Choose":
      if (askingToLook(state)) return chooseLookDone(state);
      return askingToShift(state) ? chooseShift(state, intent.optionId) : applyChoice(state, intent.optionId);
    case "ChooseResolution":
      return applyResolution(state, intent.optionId);
    case "Travel":
      return travelIntent(state, intent.locationId, ctx, steps);
    case "DeclineTravel":
      return declineTravel(state, ctx, steps);
    case "Engage": {
      // "After you optionally engage an enemy", and a seat that may optionally engage an additional enemy (09002:A:2).
      // The engagement is marked optional first (a Forced effect of the enemy asks, 05042:A:1), in a game with a record that reads the mark.
      const engaged = optionallyEngaged(engageEnemy(noteOptionalEngage(state, intent.enemyId, ctx), state.activeSeat, intent.enemyId, steps), state.activeSeat, intent.enemyId, ctx);
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
  // A player attack an effect made during an enemy attack's window goes on first (families/attack/flow.ts).
  if (stepWindowResumes(state)) return strikeResumes(state) ? continueStrike(state, ctx, steps) : resumeAttack(state, ctx, steps);
  if (state.stack.length > 0) return advanceFrame(state, ctx, steps);
  // The Forced effects of an attack's start are done: the defender is declared (141069:A:2).
  if (state.pendingAttack?.defenseWaits) return openDefense(state, ctx, steps);
  // The Responses to a shadow effect, or a shadow effect that asked a player, are done: the attack goes on.
  if (attackResumes(state)) return resolveAttack(state, ctx, steps);
  // "End the current phase" (09070:A:1): once the effect has finished, the round goes to the end of the phase in progress.
  const phaseOver = phaseEnds(state);
  if (phaseOver) return phaseOver;
  switch (state.mode) {
    // A Setup that fires before the opening hands (The One Ring) has resolved: the hands are drawn and the mulligan opens (setup/setup.ts).
    case "openingHands":
      return openMulligan(state, ctx, steps);
    case "afterOpening": {
      // A Setup entry still waiting here (a checkpoint saved before The One Ring's Setup moved ahead of the opening hands, state-version.ts) resolves first.
      const waiting = pushDue(state, "Setup", "beforeOpeningHand", steps);
      return waiting !== state ? waiting : finishSetup(state, ctx, steps);
    }
    case "beginRound":
      // The end-of-round effects are done (they held the table in the End of round phase): the round begins.
      return state.phase === "End of round" ? { ...state, phase: "Beginning of round", boundaryPhase: "Beginning of round" } : enterBegin(state, ctx);
    case "resourceGrant":
      return askCurrentStage(state, steps) ?? grant(state, steps, ctx);
    case "resourceActions":
      return openPass(state);
    // The Sailing test comes before the characters are committed to the quest (dcce.sailing).
    case "questCommit":
      return askCurrentQuest(state, ctx, steps) ?? askSmaug(state, ctx, steps) ?? sailingStep(state, ctx) ?? openPass(state);
    case "planning": {
      // "Each player skips the next planning phase" (50302:B:1): no window opens and no card is played from the hand.
      if (flagged(state, "table", "skipPlanning")) return withMode(state, "questCommit");
      const opened = openPass(state);
      return { ...opened, planningSeat: opened.activeSeat };
    }
    case "staging":
      return stagingStep(state, ctx, steps);
    case "resolution":
      // The windows after staging (3.3) and after quest resolution (3.4).
      return stepWindow(state, ctx, state.questResolved ? "3.4" : "3.3") ?? resolutionStep(state, ctx, steps);
    case "travel": {
      // "Skip the travel phase this round" (142062:A:1): no window opens and no location is traveled to.
      if (flagged(state, "table", "skipTravel")) return withMode(state, nextAfterTravel(state));
      // The travel opportunity was taken or declined: the window after it (4.2), still in the Travel phase.
      if (reached(state, "traveled")) return stepWindow(state, ctx, "4.2") ?? withMode(state, nextAfterTravel(state));
      const seat = state.separate ? areaSeats(state).find((index) => !(state.travelDone ?? []).includes(index)) : livingSeats(state)[0];
      if (seat == null) {
        // Stages are separate and every seat has had its opportunity (families/breaking/areas.ts).
        if (state.separate && livingSeats(state).length > 0) return travelTaken({ ...state, travelDone: areaSeats(state) });
        return state.lost
          ? state
          : { ...state, lost: true, lossReason: NO_SEATS_REMAIN, window: null };
      }
      // Each seat in player order may travel to a location of its own staging area, to its own active location (mec109.multiple-staging-areas).
      if (state.separate) return { ...state, travelDone: [...(state.travelDone ?? []), seat], window: { kind: "travel" }, activeSeat: seat };
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
      // "Skip the combat phase" (142075:A:2): the round goes on to the refresh phase.
      return flagged(state, "table", "skipCombat") ? withMode({ ...state, engagement: null }, "refresh") : startCombat(state, ctx);
    case "combatShadows":
      return withMode(announceShadowsDealt(dealShadows(state, ctx, steps), ctx), "combatActions");
    case "combatActions":
      return stepWindow(state, ctx, "6.2") ?? withMode(state, "enemyAttacks");
    case "enemyAttacks":
      return enemyStep(state, ctx, steps);
    case "playerAttacks":
      return openPlayer(state, ctx);
    case "refresh":
      // A hero that does not ready unless its pool pays (01080:A:1) asks its controller first.
      return askReadyPayments(state, ctx, steps) ?? doRefresh(state, ctx, steps);
    case "endRound":
      return stepWindow(state, ctx, "7.4") ?? withMode(state, "beginRound");
    default:
      return state;
  }
}

function enterBegin(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const bumped = pruneRoundCaps(pruneRoundRecords({ ...state, round: state.round + 1 }));
  if (hasTiming(bumped, ctx, "beginningOfPhase")) return openPass(bumped);
  return withMode(bumped, "resourceGrant");
}

function grant(state: ScenarioState, steps: EngineStep[], ctx: ReduceContext): ScenarioState {
  let next = state;
  // "Heroes do not collect resources during the resource phase this round" (50302:B:1): the collection is skipped; effects that add resources still work.
  if (!flagged(next, "table", "noCollect")) for (const seat of livingSeats(next)) next = gainSeatResources(next, seat, steps, ruleCause("rr.step-1-2"));
  next = announceCollected(next, ctx);
  const drawn: Record<number, string[]> = {};
  for (const seat of livingSeats(next)) {
    // A card that lets its player draw additional cards in the resource phase holds an extraDraw on the seat.
    const draws = 1 + heldStat(next, seat, "extraDraw", NO_COUNTS);
    const before = new Set(next.seats[seat]?.hand ?? []);
    next = drawMany(next, seat, draws, steps, ruleCause("rr.step-1-3"), ctx, false, false, true);
    drawn[seat] = (next.seats[seat]?.hand ?? []).filter((id) => !before.has(id));
  }
  // The draw step is done: Forced effects hear it ("After drawing cards at the beginning of the resource phase", misc family),
  // and the cards drawn are kept for the Pick that names them. Both only in a game that has a card which reads them.
  if (gameReads(next, ctx, '"trigger":"resourceDrawn"')) {
    next = { ...next, resourceDrawn: drawn };
    for (const seat of livingSeats(next)) next = queueEvent(next, { trigger: "resourceDrawn", seat, phase: "Resource" });
  }
  return openPass(withMode(next, "resourceActions"));
}

// The phase after Travel: the Encounter phase, which "Skip the encounter phase" (142061:B:1) leaves out.
function nextAfterTravel(state: ScenarioState): ModeName {
  return flagged(state, "table", "skipEncounter") ? "combatStart" : "optionalEngage";
}

function openOptional(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  // No enemy a player could optionally engage (rr.optional-engagement): the step has nothing to offer. Stages that are separate offer each seat
  // the enemies in its own staging area (mec109.multiple-staging-areas).
  const offered = state.separate ? areaSeats(state).some((seat) => optionalEnemies(state, ctx.cards, seat).length > 0) : optionalEnemies(state, ctx.cards).length > 0;
  if (!offered) {
    return { ...withMode(state, "engagement"), window: null, engagement: { ordinal: 0, engagedThisPass: false } };
  }
  const seated = state.mode === "optionalEngage" ? state : withMode(state, "optionalEngage");
  return { ...seated, window: { kind: "optionalEngage" }, activeSeat: livingSeats(seated)[0] ?? seated.firstPlayer };
}

// Archery damage is dealt as the combat phase begins (mec109.archery, rr.step-6-1), before the shadow cards
// (rr.step-6-2).
function startCombat(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (state.separate) return startSeparateCombat(state, ctx);
  const total = archeryTotal(state, ctx.cards);
  const next = { ...withMode(state, "combatShadows"), resolvedAttacks: [], declaredAttacks: [], pendingAttack: null };
  if (total > 0 && archeryRecipients(next, ctx.cards).length > 0) {
    return { ...next, window: { kind: "archery", total }, activeSeat: livingSeats(next)[0] ?? next.firstPlayer };
  }
  return next;
}

// Archery is totaled at each stage and only the player at that stage assigns it (mec109.multiple-staging-areas): the seats in player order, each with
// its own window, and the combat phase goes on once every stage has dealt its archery.
function startSeparateCombat(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const done = state.archeryDone ?? [];
  for (const seat of livingSeats(state)) {
    if (done.includes(seat)) continue;
    const total = archeryTotal(state, ctx.cards, seat);
    if (total <= 0 || archeryRecipients(state, ctx.cards, seat).length === 0) continue;
    return { ...state, archeryDone: [...done, seat], window: { kind: "archery", total, seat }, activeSeat: seat };
  }
  const { archeryDone: _done, ...rest } = state;
  return { ...withMode(rest, "combatShadows"), resolvedAttacks: [], declaredAttacks: [], pendingAttack: null };
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

function commit(state: ScenarioState, cardIds: readonly string[], ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = discardToCommit(state, state.activeSeat, ctx);
  // One commit is one occurrence: its characters' Responses share a window (rr.triggering-condition), the ones that hear
  // them exhaust ("After ~ exhausts", 12166:A:2) among them.
  const occurrence = `commit:${state.round}:${state.activeSeat}`;
  for (const id of cardIds) {
    // "Does not exhaust to commit to a quest" (a flag) leaves the character ready.
    next = flagged(next, id, "noExhaustQuest") ? updateCard(next, id, { committed: true, exhausted: false }) : exhaustAnnounced(next, id, ctx, { committed: true }, { occurrence });
    steps.push({ kind: "commit", cardId: id });
    next = queueEvent(next, { trigger: "committed", seat: state.activeSeat, cardId: id, occurrence });
  }
  return committedTo(next, state.activeSeat, cardIds.length);
}

// The hero the intent names for the undefended attack's damage: the one card that may take it, "" when none may (the attack deals no damage), or undefined
// while more than one may and the intent names none: the attack is left undefended (6.4.1) and the defending player names the hero at the damage step, once
// the shadow effect has resolved (rr.step-6-4-3).
function undefendedHero(state: ScenarioState, heroId: string | undefined, ctx: ReduceContext): string | undefined {
  const heroes = undefendedTargets(state, state.pendingAttack?.seat ?? state.activeSeat, ctx.cards);
  // No hero is left to take the attack (every hero of the seat is held, 18074): nobody does.
  if (heroes.length === 0) return "";
  if (heroes.length === 1) return heroes[0] ?? "";
  return heroId;
}

// Whether any card that could answer damage just dealt (a damageDealt Response or Forced effect) is in play or in a hand.
function damageAnswerable(state: ScenarioState, ctx: ReduceContext): boolean {
  return Object.values(state.cards).some(
    (card) => ((inPlay(card.zone) || card.zone === "hand") && effectsOf(ctx, card.code).some((effect) => effect.trigger === "damageDealt")) || attachedHearsHostDamage(state, card, ctx),
  );
}
