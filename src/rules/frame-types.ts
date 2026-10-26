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
  // The amount counts once for each of these when the stat is read: a committed character or an ally of the seat (a Hide
  // number), or a damage token on the holder (01004:A:1).
  per?: "committed" | "ally" | "damage";
  // The modifier only applies to this seat (an enemy that cannot attack one player).
  seat?: number;
  // A condition read each time the stat is read (see isStatCondition).
  when?: Condition;
  // The stat is set to `amount`, overriding every modifier that is not a set (rr.modifiers).
  set?: boolean;
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
  // The X an event was played for (Stand and Fight), or the cost of the card an effect discarded (Flame of Anor).
  x?: number;
  // The characters that took part in the attack a Response answers.
  participants?: readonly string[];
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
// `amount` is the damage a `damaged` event placed (01003:A:1).
// `occurrence`: events one game occurrence created share it (each character of one commit), and are announced together in
// a single response window (rr.triggering-condition).
export type GameEvent = { trigger: Trigger; seat: number | null; phase?: string; cardId?: string; subject?: string; participants?: readonly string[]; explored?: boolean; amount?: number; occurrence?: string };

// A Response a player may use after an event. It is offered once and may be passed. `event` is the one it answers, when a
// window answers several events of one occurrence.
export type ResponseOffer = { cardId: string; effectId: string; seat: number; event?: GameEvent };

export type FrameData =
  | ResumeData
  | { kind: "event"; event: GameEvent }
  // `answering`: the event of the Response being used, when the window holds several (one occurrence's) and it is not `event`.
  | { kind: "responses"; event: GameEvent; offers: readonly ResponseOffer[]; answering?: GameEvent }
  | { kind: "none" }
  // `fromDeck`: the top card of the encounter deck, not a card an effect found. `canceled`: a Response canceled the
  // effects of the card just revealed (Frodo Baggins).
  // `replaced`: a Response canceled the card's "when revealed" effects and replaces it with the next encounter card (01008:A:1).
  | { kind: "reveal"; hide: HideResult | null; surge: boolean; fromDeck?: boolean; canceled?: boolean; replaced?: boolean }
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
export type UsedEffect = { effectId: string; sourceId: string; round: number; phase: string; seat?: number };

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
  // Every defender declared, in order, when there is more than one (01038:A:1, rr.multiple-defenders). `defenderId` is the
  // first. `damageTo` is the one the defending player assigned the damage to.
  defenderIds?: readonly string[];
  damageTo?: string;
  // The defending player is choosing which defender takes the damage, in a frame of its own.
  damageFrame?: boolean;
  // The step that follows the action window open between two steps of the attack, and the stack depth it opened at.
  // `declared`: the Responses to a defender's declaration (01029:A:2) are open; the declaration goes on when they are done.
  awaiting?: "declared" | "defense" | "shadow" | "damage" | "end";
  awaitDepth?: number;
  // Combat damage is placed; only the end of the attack is left.
  damaged?: boolean;
  // Forced effects "when this enemy attacks" (141069:A:2) are resolving: the defense window opens once they are done.
  defenseWaits?: boolean;
  // The additional shadow card (141069:A:2) whose cancel Responses were offered last.
  extraOffered?: string;
  // A shadow card whose effect asks a player (a Pick or a Choose, 141071:A:2) is resolving in its own frame. The attack
  // goes on when it pops.
  shadowFrame?: string;
  // The shadow effects are resolved, and the window before combat damage has been offered.
  shadowsDone?: boolean;
};

// A player attack declared and not finished: the action windows between its steps (rr.attack-resolution-chart).
export type PendingStrike = {
  seat: number;
  enemyId: string;
  attackerIds: readonly string[];
  awaiting?: "strike" | "end";
  awaitDepth?: number;
};
