import type { ModifierUntil, ScenarioDefinition } from "../../catalog/boundary.ts";

import type { CardInstance, ModeName, Modifier, Phase, ScenarioState, Seat, ZoneName } from "./state-types.ts";

// The scenario state's helpers: a blank state, its seats and phase, modifiers, and the immutable updates every reducer step
// makes (updateCard, updateCards). The types are in state-types.ts; this file re-exports them, so callers import both from here.
export type { CancelOffer, CardFace, CardInstance, DelayedEffect, Discount, EffectData, Frame, FrameData, FrameName, GameEvent, HideData, HideFailure, HideResult, ModeName, Modifier, PendingAttack, PendingStrike, Phase, QueueItem, ResponseOffer, ResumeData, ScenarioState, Seat, UndoLog, UsedEffect, Window, ZoneName } from "./state-types.ts";

export function emptySeat(eliminated: boolean): Seat {
  return {
    threat: 0,
    deck: [],
    hand: [],
    discard: [],
    heroes: [],
    play: [],
    engaged: [],
    staging: [],
    questStage: null,
    eliminated,
  };
}

export function phaseOf(mode: ModeName): Phase {
  switch (mode) {
    case "mulligan":
      return "Mulligan";
    case "afterOpening":
      return "Setup";
    case "beginRound":
      return "Beginning of round";
    case "resourceGrant":
    case "resourceActions":
      return "Resource";
    case "planning":
      return "Planning";
    case "questCommit":
    case "staging":
    case "resolution":
    case "stopped":
      return "Quest";
    case "travel":
      return "Travel";
    case "optionalEngage":
    case "engagement":
      return "Encounter";
    case "combatStart":
    case "combatShadows":
    case "combatActions":
    case "enemyAttacks":
    case "playerAttacks":
      return "Combat";
    case "refresh":
      return "Refresh";
    case "endRound":
      return "End of round";
  }
}

export function blankScenario(input: {
  seatCount: 1 | 2;
  seed: number;
  definition: ScenarioDefinition;
}): ScenarioState {
  const undoPhase: Phase = "Setup";
  return {
    scenarioId: input.definition.id,
    seatCount: input.seatCount,
    seats: [emptySeat(false), emptySeat(input.seatCount === 1)],
    staging: [],
    activeLocation: null,
    secondActiveLocation: null,
    questDeck: [],
    questStage: null,
    encounterDeck: [],
    encounterDiscard: [],
    ...(input.definition.burdenDeck ? { burdenDeck: [] } : {}),
    ...(input.definition.life != null ? { life: input.definition.life } : {}),
    ...(input.definition.modeCard ? { modeCard: input.definition.modeCard } : {}),
    victory: [],
    setAside: [],
    removed: [],
    cards: {},
    nextId: 1,
    seed: input.seed,
    seedCursor: 0,
    phase: "Setup",
    mode: "afterOpening",
    round: 0,
    firstPlayer: 0,
    activeSeat: 0,
    window: null,
    passed: [],
    mulliganTaken: false,
    openingHandReduction: 0,
    mulliganSeats: [],
    lost: false,
    lossReason: null,
    failure: null,
    stageCleared: false,
    perilSeat: null,
    modifiers: [],
    stack: [],
    frameSeq: 0,
    boundaryPhase: "Setup",
    clock: 0,
    hideFailures: [],
    delayed: [],
    uses: [],
    revealCursor: null,
    questResolved: false,
    stages: input.definition.stages,
    setup: input.definition.setup,
    widgets: input.definition.widgets,
    resolution: input.definition.resolution,
    ...(input.definition.part != null ? { part: input.definition.part } : {}),
    ...(input.definition.afterSetup && input.definition.afterSetup.length > 0 && input.definition.campaignCard ? { afterSetup: { card: input.definition.campaignCard, instructions: input.definition.afterSetup } } : {}),
    resolutionAt: 0,
    resolutionSeat: 0,
    resolutionLog: { earned: [], fallen: [], captives: [] },
    engagement: null,
    resolvedAttacks: [],
    declaredAttacks: [],
    planningSeat: null,
    stepWindows: [],
    pendingAttack: null,
    pendingStrike: null,
    undo: { phase: undoPhase, snapshot: null, cards: null, intents: [], steps: [] },
  };
}

export function withSeat(state: ScenarioState, index: number, seat: Seat): ScenarioState {
  if (state.seats[index] === seat) return state;
  const seats: [Seat, Seat] = [state.seats[0], state.seats[1]];
  seats[index] = seat;
  return { ...state, seats };
}

export function withThreat(state: ScenarioState, index: number, threat: number): ScenarioState {
  const seat = state.seats[index];
  if (!seat || seat.threat === threat) return state;
  return withSeat(state, index, { ...seat, threat });
}

// The mode an additional instance of a phase starts at, and the framework steps it opens a window at (stepWindow keys), which the instance opens again ("there is an additional instance of
// the chosen phase", 11213:A:2).
const EXTRA_PHASES: Readonly<Partial<Record<Phase, { mode: ModeName; steps: readonly string[] }>>> = {
  Resource: { mode: "resourceGrant", steps: [] },
  Planning: { mode: "planning", steps: [] },
  Combat: { mode: "combatStart", steps: ["6.2"] },
  Refresh: { mode: "refresh", steps: [] },
};

// Leaving a phase for `mode`: an additional instance asked for runs first, and the round goes on at `extraResume` once the last one is done. Null when no instance is owed or running. An instance that
// ends gives its framework steps back, so the phase that comes after it (or the one it was added to) opens its windows too.
function afterExtra(state: ScenarioState, mode: ModeName): { state: ScenarioState; mode: ModeName } | null {
  const [next, ...rest] = state.extraPhases ?? [];
  if (next == null && state.extraResume == null) return null;
  const { extraPhases: _owed, extraResume: _resume, extraFollowed: _followed, ...plain } = state;
  const resume = state.extraResume ?? mode;
  const start = next ? EXTRA_PHASES[next] : undefined;
  const reopen = [...(state.extraResume != null ? (EXTRA_PHASES[state.phase]?.steps ?? []) : []), ...(start?.steps ?? [])].map((step) => `${state.round}:${step}`);
  const stepWindows = reopen.length > 0 ? plain.stepWindows.filter((key) => !reopen.includes(key)) : plain.stepWindows;
  if (!next || !start) return { state: { ...plain, stepWindows }, mode: resume };
  return { state: { ...plain, stepWindows, ...(rest.length > 0 ? { extraPhases: rest } : {}), extraResume: resume, extraFollowed: state.phase }, mode: start.mode };
}

/** The first step of an additional instance of a phase (the mode it starts at), or undefined for a phase that cannot be added. */
export function extraPhaseMode(phase: Phase): ModeName | undefined {
  return EXTRA_PHASES[phase]?.mode;
}

export function withMode(state: ScenarioState, mode: ModeName): ScenarioState {
  // A phase ends: an additional instance of a phase takes its place before the next one begins (the instance's own end comes back here).
  const extra = state.phase !== phaseOf(mode) ? afterExtra(state, mode) : null;
  return extra ? enterMode(extra.state, extra.mode, true) : enterMode(state, mode, false);
}

function enterMode(state: ScenarioState, mode: ModeName, crossed: boolean): ScenarioState {
  const phase = phaseOf(mode);
  if (!crossed && state.mode === mode && state.phase === phase) return state;
  // A phase that begins is announced ("At the beginning of the quest phase"), with the phase it is.
  const entering = crossed || state.phase !== phase;
  const begun = entering ? { pendingEvents: [...(state.pendingEvents ?? []), { trigger: "beginningOfPhase" as const, seat: null, phase }] } : {};
  const instance = crossed ? { phaseSeq: (state.phaseSeq ?? 0) + 1 } : {};
  const changed: ScenarioState = { ...state, mode, phase, passed: [], ...begun, ...instance };
  const expiring: ModifierUntil[] = [];
  if (entering) expiring.push("endOfPhase");
  if (mode === "beginRound" && state.mode !== "beginRound") expiring.push("endOfRound");
  if (expiring.length === 0) return changed;
  const discounts = (changed.discounts ?? []).filter((discount) => discount.until === "used" || !expiring.includes(discount.until));
  const kept = discounts.length === (changed.discounts ?? []).length ? changed : { ...changed, discounts };
  return expireModifiers(kept, expiring);
}

// The seat a Peril card's staging is locked to, or null. An enemy attack that card starts is open to every player
// (faq.peril-attacks): the lock does not hold while the attack resolves.
export function perilLock(state: ScenarioState): number | null {
  return state.pendingAttack ? null : state.perilSeat;
}

// A framework point reached this round (stepWindows).
export function reached(state: ScenarioState, step: string): boolean {
  return state.stepWindows.includes(`${state.round}:${step}`);
}

export function markReached(state: ScenarioState, step: string): ScenarioState {
  const at = `${state.round}:${step}`;
  if (state.stepWindows.includes(at)) return state;
  return { ...state, stepWindows: [...state.stepWindows.filter((key) => key.startsWith(`${state.round}:`)), at] };
}

export function inPlay(zone: ZoneName): boolean {
  return (
    zone === "heroes" ||
    zone === "play" ||
    zone === "engaged" ||
    zone === "staging" ||
    zone === "seatStaging" ||
    zone === "activeLocation" ||
    zone === "secondActiveLocation" || zone === "stormcallerArea" || zone === "islandMap" ||
    zone === "questStage" ||
    zone === "seatQuest" ||
    zone === "attached" ||
    zone === "campaign" ||
    zone === "nightmare" ||
    zone === "modeCard" ||
    zone === "captive" || zone === "grappled"
  );
}

export function modifierActive(state: ScenarioState, modifier: Modifier): boolean {
  if (modifier.until === "whileSourceInVictory") return state.cards[modifier.sourceId]?.zone === "victory";
  if (modifier.until !== "whileSourceInPlay") return true;
  const source = state.cards[modifier.sourceId];
  return source != null && inPlay(source.zone);
}

// A flag modifier (cannotAttack, cannotTakeDamage, ...) is on the card.
export function flagged(state: ScenarioState, id: string, stat: Modifier["stat"]): boolean {
  return state.modifiers.some((modifier) => modifier.stat === stat && modifier.instanceId === id && modifier.amount > 0 && modifierActive(state, modifier));
}

// The sum of a number modifier held by one card ("collects 1 additional resource", extraResource).
export function heldAmount(state: ScenarioState, id: string, stat: Modifier["stat"]): number {
  let total = 0;
  for (const modifier of state.modifiers) if (modifier.stat === stat && modifier.instanceId === id && modifierActive(state, modifier)) total += modifier.amount;
  return total;
}

// The smallest positive amount of a number modifier held by one card, 0 with none: a cap that several holders set does not add up, the tightest one holds.
export function heldLeast(state: ScenarioState, id: string, stat: Modifier["stat"]): number {
  let least = 0;
  for (const modifier of state.modifiers) if (modifier.stat === stat && modifier.instanceId === id && modifier.amount > 0 && modifierActive(state, modifier) && (least === 0 || modifier.amount < least)) least = modifier.amount;
  return least;
}

// Drops modifiers that end at one of these boundaries, and any that outlived their source.
export function expireModifiers(state: ScenarioState, untils: readonly ModifierUntil[]): ScenarioState {
  const kept = state.modifiers.filter((modifier) => !untils.includes(modifier.until) && modifierActive(state, modifier));
  return kept.length === state.modifiers.length ? state : { ...state, modifiers: kept };
}

export function updateCard(
  state: ScenarioState,
  id: string,
  patch: Partial<CardInstance>,
): ScenarioState {
  const current = state.cards[id];
  if (!current) return state;
  return { ...state, cards: { ...state.cards, [id]: { ...current, ...patch } } };
}

// Several cards patched at once: the card map is copied one time, not once for each card. The patches apply in order, so a card
// named twice gets both, and an id with no card is skipped, as `updateCard` does. The result equals a chain of `updateCard`s.
export function updateCards(state: ScenarioState, patches: readonly (readonly [string, Partial<CardInstance>])[]): ScenarioState {
  let cards: Record<string, CardInstance> | null = null;
  for (const [id, patch] of patches) {
    const current = (cards ?? state.cards)[id];
    if (!current) continue;
    cards ??= { ...state.cards };
    cards[id] = { ...current, ...patch };
  }
  return cards ? { ...state, cards } : state;
}

export function livingSeats(state: ScenarioState): number[] {
  const seats: number[] = [];
  for (let step = 0; step < state.seatCount; step += 1) {
    const index = (state.firstPlayer + step) % state.seatCount;
    const seat = state.seats[index];
    if (seat && !seat.eliminated) seats.push(index);
  }
  return seats;
}

export function card(state: ScenarioState, id: string): CardInstance {
  const found = state.cards[id];
  if (!found) throw new Error(`Missing card instance ${id}`);
  return found;
}
