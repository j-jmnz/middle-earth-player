import type { Cause } from "./cause.ts";
import type { Condition, Instruction, ModifierStat, ModifierUntil, Trigger } from "../catalog/boundary.ts";

import type { AttackDefense } from "./families/defense-types.ts";
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
  // The modifier holds only while its holder attacks this enemy ("+2 Attack while attacking that enemy").
  against?: string;
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
  // The options a `different` Choose has taken in this effect (families/deck-choose.ts).
  options?: readonly string[];
  // The seat the event that offered this Response happened to.
  eventSeat?: number | null;
  // The X an event was played for (Stand and Fight), or the cost of the card an effect discarded (Flame of Anor).
  x?: number;
  // The characters that took part in the attack a Response answers.
  participants?: readonly string[];
  // The card the event a Response or Forced effect answers was about ("that ally", "that enemy"), and the other card it
  // names (the enemy a character defends against).
  subject?: string;
  other?: string;
  // The damage the answered event dealt, and the card whose destruction waits while this effect resolves.
  dealt?: number;
  hold?: string;
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
// `other` is a second card the event names: the enemy a character defends against or attacks.
// `amount` is the damage a `damaged` event dealt. `attachments` are the cards that left play with the card a
// `leftPlayWithAttachments` event is about (families/play-zones.ts).
// `occurrence`: events one game occurrence created share it (each character of one commit), and are announced together in
// a single response window (rr.triggering-condition). `fromDeck`: a "revealed" card the encounter deck itself revealed.
export type GameEvent = { trigger: Trigger; seat: number | null; phase?: string; cardId?: string; subject?: string; other?: string; participants?: readonly string[]; explored?: boolean; amount?: number; attachments?: readonly string[]; occurrence?: string; fromDeck?: boolean };

// A Response a player may use after an event. It is offered once and may be passed. `event` is the one it answers, when a
// window answers several events of one occurrence.
export type ResponseOffer = { cardId: string; effectId: string; seat: number; event?: GameEvent };

export type FrameData =
  | ResumeData
  | { kind: "event"; event: GameEvent }
  | { kind: "responses"; event: GameEvent; offers: readonly ResponseOffer[] }
  | { kind: "none" }
  // `fromDeck`: the top card of the encounter deck, not a card an effect found. `canceled`: a Response canceled the
  // effects of the card just revealed (Frodo Baggins). `discard`: and the card is discarded, not shuffled back (The Master Ring).
  | { kind: "reveal"; hide: HideResult | null; surge: boolean; fromDeck?: boolean; canceled?: boolean; discard?: boolean }
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
  // `questSucceeded`: run when the players quest successfully this phase (families/quest-outcome.ts), dropped when the quest
  // resolves otherwise.
  // `endOfAttack`: the end of the player attack in progress (families/attack-flow.ts).
  // `startOfGame`: run once the opening hands are settled (misc family).
  until: "endOfPhase" | "endOfRound" | "questSucceeded" | "endOfAttack" | "startOfGame";
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
// `game` keeps the use for the rest of the game (a once-per-game limit); `attack` names the attack it was made in.
export type UsedEffect = { effectId: string; sourceId: string; round: number; phase: string; seat?: number; game?: boolean; attack?: string };

export type HideFailure = { seat: number; round: number; phase: string };

// The enemy attack in progress. `defenderId` and `heroId` stay empty until the player answers.
export type PendingAttack = {
  enemyId: string;
  seat: number;
  // An attack an effect started. It does not use up the enemy's attack for the phase.
  immediate?: boolean;
  // The attack is a shadow card's own (Wolf Rider, 01081:A:2), made once the attack it was dealt to ended.
  shadowAttack?: boolean;
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
  // The step that follows the action window open between two steps of the attack, and the stack depth it opened at.
  // `defenders`: more defenders were declared by an effect; the window after the declaration (6.4.1) comes next.
  awaiting?: "defense" | "shadow" | "damage" | "end" | "defenders";
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
  // The attacking enemy is in the staging area (an effect made it attack, 142038:A:2), not engaged (families/south-watcher.ts).
  fromStaging?: boolean;
  // A shadow effect says the undefended damage of this attack goes on an active location (142035:A:2).
  toLocation?: boolean;
  // Shadow cards that are enemies and say "attacks the defending player" (Wolf Rider, 01081:A:2): each attacks once this attack has ended
  // (families/defense-shadow-attack.ts).
  shadowAttackers?: readonly string[];
  // Extra defenders, damage marks and the attack's end, kept by the defense family (src/rules/families/defense-types.ts).
  defense?: AttackDefense;
};

// A player attack declared and not finished: the action windows between its steps (rr.attack-resolution-chart).
export type PendingStrike = {
  seat: number;
  enemyId: string;
  attackerIds: readonly string[];
  awaiting?: "strike" | "end";
  awaitDepth?: number;
  // The attack family's marks (families/attack-flow.ts). `back`: the window given back when the attack ends (absent: the
  // combat phase's player attack window; null: none, an effect declared the attack and goes on). `outer`: the player attack
  // this one was declared during, which goes on when it ends. `engagedSeat`: the player the enemy was engaged with when the
  // attack was declared. `ranged`: a card called it a ranged attack. `excessTo`: the enemy that takes its excess damage.
  back?: Window | null;
  outer?: PendingStrike;
  engagedSeat?: number;
  ranged?: boolean;
  excessTo?: string;
};
