import type { Condition, Instruction, ModifierStat, ModifierUntil, Trigger } from "../catalog/boundary.ts";

import type { Sphere } from "./printed.ts";

// Plain data only, never a closure, so structuredClone and the undo replay keep working.

export type Modifier = {
  instanceId: string;
  sourceId: string;
  stat: ModifierStat;
  amount: number;
  until: ModifierUntil;
};

export type FrameName =
  | "reveal"
  | "hide"
  | "whenRevealed"
  | "forced"
  | "shadow"
  | "response"
  | "setup"
  | "delayed"
  | "event"
  | "ResolveEffect";

export type HideResult = { success: boolean; willpower: number; threat: number };

// One instruction still to run, with the seat it runs for. `chosen` is the card a player picked for it.
export type QueueItem = { instruction: Instruction; seat: number; chosen: string | null };

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
};

export type HideData = {
  kind: "hide";
  x: number;
  committedIds: readonly string[];
  discardedIds: readonly string[];
  threat: number;
  result: HideResult | null;
};

// An event the engine announces. `seat` is the player it happened to. `phase` is the phase that just ended.
export type GameEvent = { trigger: Trigger; seat: number | null; phase?: string };

export type FrameData =
  | { kind: "event"; event: GameEvent }
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
};

export type HideFailure = { seat: number; round: number; phase: string };
