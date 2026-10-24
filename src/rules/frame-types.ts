import type { Cause } from "./cause.ts";
import type { Condition, Instruction, ModifierStat, ModifierUntil, Trigger } from "../catalog/boundary.ts";

import type { Sphere } from "./printed.ts";
import type { Window } from "./state.ts";

// Plain data only, never a closure, so structuredClone and the undo replay keep working.

// `instanceId` names the holder: a card instance id, "table" (every seat), or "seat:<n>".
export type Modifier = {
  instanceId: string;
  sourceId: string;
  stat: ModifierStat;
  amount: number;
  until: ModifierUntil;
  // A constant effect put this modifier here. The engine rebuilds these from the effect list.
  origin?: string;
  // The amount counts once for each of these when the stat is read.
  per?: "committed" | "ally";
  // The modifier only applies to this seat (an enemy that cannot attack one player).
  seat?: number;
  // A condition read each time the stat is read (see isStatCondition).
  when?: Condition;
};

export type FrameName =
  | "reveal"
  | "hide"
  | "whenRevealed"
  | "forced"
  | "shadow"
  | "response"
  | "setup"
  | "travel"
  | "delayed"
  | "event"
  | "ResolveEffect";

export type HideResult = { success: boolean; willpower: number; threat: number };

// One instruction still to run, with the seat it runs for. `chosen` is the card a player picked for it.
// `offset` is where ArrangeTop has got to in the deck.
export type QueueItem = { instruction: Instruction; seat: number; chosen: string | null; cause?: Cause; offset?: number };

export type EffectWait =
  | { kind: "branch"; item: QueueItem }
  | { kind: "target"; item: QueueItem }
  | { kind: "cancel" };

// A paid cancel the first player may use before the effect resolves.
export type CancelOffer = { amount: number; sphere: Sphere | null; unless: Condition | null };

// A running effect. The queue is the rest of its instructions, so a window can stop it and a later
// intent can resume it.
export type EffectData = {
  kind: "effect";
  effectId: string;
  actor: number;
  queue: readonly QueueItem[];
  returned: number;
  canceled: boolean;
  cancel: CancelOffer | null;
  // Nothing may cancel the effect while this holds.
  blockCancel: Condition | null;
  // Set when the effect starts: true if the effect could not be canceled.
  uncancelable: boolean;
  wait: EffectWait | null;
  // The window to open again when the effect is done (an Action used in a pass window).
  resume?: { window: Window; seat: number } | null;
  // The cards and players (as "seat:N") the Pick instructions chose so far, oldest first. "" is a pick with nothing to choose.
  picked?: readonly string[];
  // An event played from the hand: when the effect is done the card goes to its owner's discard pile.
  finish?: "discardSource";
  // Set when the "when revealed" Responses (a cancel) have been offered for this frame.
  interrupted?: boolean;
  // The cards a Pick looked at in a deck: the ones still there are put back by ArrangeTop.
  looked?: readonly string[];
  // The seat the event that offered this Response happened to.
  eventSeat?: number | null;
  // The X an event was played for (Stand and Fight).
  x?: number;
};

// A window to open again once the frames above this one are done. Under a response or a Forced frame raised while an action
// window was open.
export type ResumeData = { kind: "resume"; window: Window; seat: number; passed: readonly number[] };

export type HideData = {
  kind: "hide";
  x: number;
  committedIds: readonly string[];
  discardedIds: readonly string[];
  threat: number;
  result: HideResult | null;
};

// An event the engine announces. `seat` is the player it happened to. `phase` is the phase that just ended.
// `cardId` limits the event to one card: only that card's effects hear it.
// `subject` is the card the event is about; every card in play hears it. `participants` are the characters in an attack.
export type GameEvent = { trigger: Trigger; seat: number | null; phase?: string; cardId?: string; subject?: string };

// A Response a player may use after an event. It is offered once and may be passed.
export type ResponseOffer = { cardId: string; effectId: string; seat: number };

export type FrameData =
  | ResumeData
  | { kind: "event"; event: GameEvent }
  | { kind: "responses"; event: GameEvent; offers: readonly ResponseOffer[] }
  | { kind: "none" }
  | { kind: "reveal"; hide: HideResult | null; surge: boolean }
  | HideData
  | EffectData;

export type Frame = {
  id: string;
  frame: FrameName;
  cardId: string | null;
  seat: number;
  peril: boolean;
  step: number;
  data: FrameData;
};

export type DelayedEffect = {
  id: string;
  until: "endOfPhase" | "endOfRound";
  sourceId: string | null;
  seat: number;
  // The phase the effect was scheduled in. An end-of-phase effect fires when that phase ends.
  phase: string;
  instructions: readonly Instruction[];
  uncancelable: Condition | null;
  cause?: Cause;
  // The card the delayed instructions act on as the picked card.
  subjectId?: string;
};

// One use of an effect with a limit. A oncePerPhase use is spent in the round and phase it was made.
export type UsedEffect = { effectId: string; sourceId: string; round: number; phase: string };

export type HideFailure = { seat: number; round: number; phase: string };

// The enemy attack in progress. `defenderId` and `heroId` stay empty until the player answers.
export type PendingAttack = {
  enemyId: string;
  seat: number;
  // An attack an effect started. It does not use up the enemy's attack for the phase.
  immediate?: boolean;
  defenderId?: string;
  // The hero an undefended attack lands on.
  heroId?: string;
  // A shadow effect made the attack count as undefended.
  undefended?: boolean;
  shadowResolved?: boolean;
  // The Responses to the shadow effect have been offered, and a Response canceled it.
  shadowOffered?: boolean;
  shadowCanceled?: boolean;
  // Instructions to run, with the attacker as the source, when the attack ends.
  after?: readonly Instruction[];
  afterCause?: Cause;
};
