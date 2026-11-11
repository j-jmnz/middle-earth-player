// Rules: mec112.gollum-smeagol, rr.first-player, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 144075:A:1, 144075:A:3, 144076:A:2, 144055:A:2. Gollum and Sméagol, one physical card: the instance holds code 144075 (the
// enemy) or 144076 (the objective ally) and keeps the other as its `other` side, as a flipped card does (wilderland/rhovanion.ts FlipToEnemySide).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import { engageWith } from "../../quest/quest.ts";
import { attackWith } from "../attack/immediate.ts";
import type { Focus } from "../index.ts";

export const GOLLUM = "144075";
export const SMEAGOL = "144076";

/** Whether the code is the one physical card, on either side. */
export const isGollum = (code: string | undefined): boolean => code === GOLLUM || code === SMEAGOL;

/** The one physical card, whichever side it shows and wherever it lies (undefined outside a game of The Passage of the Marshes). */
export function gollumCard(state: ScenarioState): CardInstance | undefined {
  return Object.values(state.cards).find((card) => isGollum(card.code));
}

// The card, when it shows this code now.
function showing(state: ScenarioState, code: string): string | null {
  const card = gollumCard(state);
  return card?.code === code ? card.id : null;
}

/** FlipGollum: the card shows its other side with its damage discarded: Sméagol exhausted under the first player, Gollum ready and engaged with the first player (mec112.gollum-smeagol). */
export function flipGollum(state: ScenarioState, to: "smeagol" | "gollum", steps: EngineStep[]): ScenarioState {
  const id = showing(state, to === "smeagol" ? GOLLUM : SMEAGOL);
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.zone === "removed" || (to === "gollum" && !inPlay(card.zone))) return state;
  const side = { code: to === "smeagol" ? SMEAGOL : GOLLUM, other: card.code, damage: 0, face: "up" as const };
  const flipped =
    to === "smeagol"
      ? updateCard(moveCard(updateCard(state, id, side), id, { zone: "play", seat: state.firstPlayer }), id, { exhausted: true, committed: false })
      : engageWith(updateCard(state, id, { ...side, exhausted: false, committed: false }), state.firstPlayer, id, steps);
  return queueEvent(flipped, { trigger: "flippedOver", seat: null, cardId: id });
}

/** FollowFirstPlayer: the source Gollum moves to the first player's play area (rr.first-player: the token has just passed). */
export function followFirstPlayer(state: ScenarioState, focus: Focus, steps: EngineStep[]): ScenarioState {
  const card = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!card || card.zone !== "engaged" || card.controller === state.firstPlayer) return state;
  return engageWith(state, state.firstPlayer, card.id, steps);
}

/** GollumAttacks: the Gollum in play, engaged with a player, attacks them now. */
export function gollumAttacks(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = showing(state, GOLLUM);
  return id && state.cards[id]?.zone === "engaged" ? attackWith(state, id, ctx, steps) : state;
}

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "FlipGollum":
      return flipGollum(state, instruction.to, steps);
    case "FollowFirstPlayer":
      return followFirstPlayer(state, focus, steps);
    case "GollumAttacks":
      return gollumAttacks(state, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "gollum", verbs: ["FlipGollum", "FollowFirstPlayer", "GollumAttacks"], run };
