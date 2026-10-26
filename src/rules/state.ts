import type { Instruction, ModifierUntil, PickSpec, ScenarioDefinition } from "../catalog/boundary.ts";

import type { DelayedEffect, Frame, GameEvent, HideFailure, Modifier, PendingAttack, PendingStrike, UsedEffect } from "./frame-types.ts";
import type { EngineStep, PlayerIntent } from "./intents.ts";

export type {
  DelayedEffect,
  EffectData,
  CancelOffer,
  Frame,
  FrameData,
  FrameName,
  GameEvent,
  HideData,
  HideFailure,
  HideResult,
  Modifier,
  PendingAttack,
  PendingStrike,
  ResponseOffer,
  ResumeData,
  UsedEffect,
  QueueItem,
} from "./frame-types.ts";

export type ZoneName =
  | "deck"
  | "hand"
  | "discard"
  | "heroes"
  | "play"
  | "engaged"
  | "seatStaging"
  | "seatQuest"
  | "staging"
  | "activeLocation"
  | "secondActiveLocation"
  | "questDeck"
  | "questStage"
  | "encounterDeck"
  | "encounterDiscard"
  | "burdenDeck"
  | "victory"
  | "setAside"
  | "removed"
  | "shadow"
  | "attached"
  // Facedown under a location, out of play (141049:A:1). The card's host is the location.
  | "under";

export type CardFace = "up" | "down" | "A" | "B";

// "Reduce the cost of the next Silvan ally you play this phase by 1": spent by the first card that matches.
// `anySeat`: any player's next matching card spends it. The card that spends it gains Doomed `doomed`, needs no resource match
// (`noMatch`) and cannot quest this round (`cannotQuest`). `used`: it lasts until spent.
export type Discount = {
  seat: number;
  sourceId: string;
  pick: PickSpec;
  amount: number;
  until: "endOfPhase" | "endOfRound" | "used";
  min?: number;
  anySeat?: true;
  doomed?: number;
  noMatch?: true;
  cannotQuest?: true;
};

export type CardInstance = {
  id: string;
  code: string;
  zone: ZoneName;
  exhausted: boolean;
  damage: number;
  progress: number;
  resources: number;
  host: string | null;
  attachments: readonly string[];
  committed: boolean;
  shadowId: string | null;
  // Shadow cards dealt beyond the first ("deal it an additional shadow card", 141069:A:2), in the order dealt. Absent
  // when there are none.
  extraShadowIds?: readonly string[];
  face: CardFace;
  controller: number | null;
  // The seat whose card it is, when another seat has taken control of it (Wandering Took, Stand and Fight). A discarded
  // card goes to its owner's discard pile.
  owner?: number;
  // Order in which the card entered play. Forced effects resolve oldest first.
  enteredPlay: number;
};

export type Seat = {
  threat: number;
  deck: readonly string[];
  hand: readonly string[];
  discard: readonly string[];
  heroes: readonly string[];
  play: readonly string[];
  engaged: readonly string[];
  staging: readonly string[];
  questStage: string | null;
  eliminated: boolean;
};

export type Phase =
  | "Setup"
  | "Mulligan"
  | "Beginning of round"
  | "Resource"
  | "Planning"
  | "Quest"
  | "Travel"
  | "Encounter"
  | "Combat"
  | "Refresh"
  | "End of round";

export type ModeName =
  | "mulligan"
  | "afterOpening"
  | "beginRound"
  | "resourceGrant"
  | "resourceActions"
  | "planning"
  | "questCommit"
  | "staging"
  | "resolution"
  | "travel"
  | "optionalEngage"
  | "engagement"
  | "combatStart"
  | "combatShadows"
  | "combatActions"
  | "enemyAttacks"
  | "playerAttacks"
  | "refresh"
  | "endRound"
  | "stopped";

export type Window =
  | { kind: "mulligan" }
  | { kind: "pass" }
  | { kind: "travel" }
  | { kind: "optionalEngage" }
  | { kind: "chooseEnemy"; reason: "engagement" | "attack"; seat: number; options: readonly string[] }
  | { kind: "defense"; enemyId: string; seat: number }
  | { kind: "archery"; total: number }
  // `targets`: a card opened the window (OfferAttacks): the seat may attack only these enemies, each once, as extra attacks.
  | { kind: "playerAttack"; targets?: readonly string[] }
  | { kind: "hideCommit"; seat: number }
  | { kind: "frameAction" }
  | { kind: "choose"; seat: number; options: readonly string[] }
  | { kind: "cancelOffer"; seat: number }
  | { kind: "response"; seat: number }
  // A card shown to a player (the top of the encounter deck). The player closes it with a pass.
  | { kind: "look"; seat: number; cardIds: readonly string[] }
  // The scenario is won: a player answers the choice that Resolution instruction `step` opens.
  | { kind: "resolution"; step: number; seat: number };

// What a won scenario writes for the campaign: cards earned (and where each went), heroes that fell, captives.
export type Earned = { code: string; to: "pool" | "hand" | "hero"; seat: number | null; hero: string | null; step: number };
export type ResolutionLog = {
  earned: readonly Earned[];
  fallen: readonly string[];
  captives: readonly { seat: number; hero: string }[];
};

export type UndoLog = {
  phase: Phase;
  snapshot: ScenarioState | null;
  cards: Readonly<Record<string, CardInstance>> | null;
  intents: readonly PlayerIntent[];
  steps: readonly (readonly EngineStep[])[];
};

export type ScenarioState = {
  scenarioId: string;
  seatCount: 1 | 2;
  seats: readonly [Seat, Seat];
  staging: readonly string[];
  activeLocation: string | null;
  secondActiveLocation: string | null;
  questDeck: readonly string[];
  questStage: string | null;
  encounterDeck: readonly string[];
  encounterDiscard: readonly string[];
  // Present only when the scenario makes a burden deck (Flight to the Ford) or sets the Ring-bearer's life.
  burdenDeck?: readonly string[];
  life?: number;
  victory: readonly string[];
  setAside: readonly string[];
  removed: readonly string[];
  cards: Readonly<Record<string, CardInstance>>;
  nextId: number;
  seed: number;
  seedCursor: number;
  phase: Phase;
  mode: ModeName;
  round: number;
  firstPlayer: number;
  activeSeat: number;
  window: Window | null;
  passed: readonly number[];
  mulliganTaken: boolean;
  // Cards each player does not draw in the starting hand (a Setup effect). The opening hand and a mulligan draw 6 minus this.
  openingHandReduction: number;
  mulliganSeats: readonly number[];
  lost: boolean;
  lossReason: string | null;
  failure: string | null;
  stageCleared: boolean;
  perilSeat: number | null;
  modifiers: readonly Modifier[];
  stack: readonly Frame[];
  frameSeq: number;
  // The phase the end-of-phase machinery last saw.
  boundaryPhase: Phase;
  clock: number;
  hideFailures: readonly HideFailure[];
  delayed: readonly DelayedEffect[];
  // Effects with a limit that have been used.
  uses: readonly UsedEffect[];
  revealCursor: { seats: readonly number[]; index: number } | null;
  // True between the two passes that resolve the quest.
  questResolved: boolean;
  stages: readonly { code: string }[];
  setup: readonly Instruction[];
  widgets: ScenarioDefinition["widgets"];
  resolution: ScenarioDefinition["resolution"];
  // The next Resolution instruction to run, the seat it is asking, and what the resolution has recorded so far.
  resolutionAt: number;
  resolutionSeat: number;
  resolutionLog: ResolutionLog;
  engagement: { ordinal: number; engagedThisPass: boolean } | null;
  resolvedAttacks: readonly string[];
  // "round:step" for each framework action window opened this round (rr.framework-steps), so each opens once, and
  // "round:traveled" once the travel opportunity is taken or declined.
  stepWindows: readonly string[];
  // The active player of the planning phase: the one seat that may play allies and attachments in the window
  // (rr.step-2-2). Each seat has its turn in player order (rr.step-2-3). Null outside the planning phase.
  planningSeat: number | null;
  // "seat:enemyId" for each attack a seat declared this combat phase: one per enemy (faq.limitations-on-attacks).
  declaredAttacks: readonly string[];
  pendingAttack: PendingAttack | null;
  pendingStrike: PendingStrike | null;
  // Events raised by code that cannot offer responses itself. settle announces them when no window is open.
  pendingEvents?: readonly GameEvent[];
  // The cards each seat drew in the draw step at the beginning of this round's resource phase ("choose and discard 1 of those
  // cards", families/misc-pick.ts).
  resourceDrawn?: Readonly<Record<number, readonly string[]>>;
  // Set while some card in play or in a hand can answer damage just dealt ("cancel X damage just dealt"): a character's lethal
  // damage then waits for those Responses before it destroys the character (settle keeps it current).
  holdLethal?: true;
  // Cost reductions waiting for the next matching card a seat plays (ReduceNextCost). They end with the phase or the round.
  discounts?: readonly Discount[];
  // The player cards played from a hand this round, in order ("the first time you played a copy of ~ this round", "the first
  // Rohan ally you play each round"). Only this round's are kept.
  // `paid`: the pools that paid for it and how much each (Linhir Sea-captain's "paid all of its cost from a single hero").
  played?: readonly { id: string; code: string; seat: number; round: number; paid?: readonly { heroId: string; amount: number }[] }[];
  // The cards that spent resources this round ("each hero ... that did not spend any resources this round").
  spent?: { round: number; ids: readonly string[] };
  // This round's quest (rr.step-3-4): the characters committed to it, and the seats whose quest succeeded ("If you quest
  // successfully this phase", "After Hirgon quests successfully"). Kept only in a game that reads it (families/costs-pay.ts).
  quested?: { round: number; committed: readonly string[]; succeeded: readonly number[] };
  // Each seat's starting threat level (rr.initial-threat-level), kept at setup only when a card of the game reads it (04053:A:2).
  startingThreat?: readonly number[];
  // The seats a card in play keeps in the game at the threat elimination level (10124:A:2): eliminateEmpties asks that card
  // instead of eliminating the seat. settle keeps it current (families/quest-threat.ts).
  threatSaves?: readonly number[];
  undo: UndoLog;
};

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

export function withMode(state: ScenarioState, mode: ModeName): ScenarioState {
  const phase = phaseOf(mode);
  if (state.mode === mode && state.phase === phase) return state;
  // A phase that begins is announced ("At the beginning of the quest phase"), with the phase it is.
  const begun = state.phase !== phase ? { pendingEvents: [...(state.pendingEvents ?? []), { trigger: "beginningOfPhase" as const, seat: null, phase }] } : {};
  const changed: ScenarioState = { ...state, mode, phase, passed: [], ...begun };
  const expiring: ModifierUntil[] = [];
  if (state.phase !== phase) expiring.push("endOfPhase");
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
    zone === "secondActiveLocation" ||
    zone === "questStage" ||
    zone === "seatQuest" ||
    zone === "attached"
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
