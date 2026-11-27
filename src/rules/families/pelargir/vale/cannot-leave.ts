// Rules: rr.cannot, rr.destroy, rr.in-play-and-out-of-play, ats.captain-enemies (data/rules/entries.json); ledger lines 06144:B:1, 06145:B:1, 06146:B:2.
// "Murzag cannot leave play unless destroyed": while its stage is current a Captain holds `cannotLeavePlay` (the stage's constant, with the Captain as holder). The rule that no player is offered a target whose effect cannot happen holds it in three places (a card held in a hand is kept by families/ring-maker/hand.ts):
// 1. A Pick that feeds a verb taking the card out of play any way but destruction (a discard, a shuffle or a return to a deck or hand, the victory display, a removal from the game, a placing under another card) leaves the Captain out (`leavesPlayPicked`, read by interpret/pick.ts), so an ability with no other
//    target is not offered. Returning it to the staging area, or engaging it, is not leaving play.
// 2. The staging area shuffled into the encounter deck leaves it where it is, though it still counts (families/pelargir/staging.ts).
// 3. An effect with no Pick that moves it out of play anyway (a discard of "the attacking enemy", a sweep of every enemy) moves nothing: `moveCard` (core/zones.ts) keeps a card that holds `cannotLeaveUnlessDestroyed` (set beside `cannotLeavePlay` on the Captain) where it is, with its damage, tokens, attachments and shadow cards, unless the move is its destruction (`destroyed`).
//    The settle sweep below is the backstop for a card that still lies out of play after an intent (a move that does not go through `moveCard`): it returns to the staging area, unless it was destroyed in this intent (the sweep reads the `destroy` step).
import type { Instruction } from "../../../../catalog/boundary.ts";

import type { EngineStep } from "../../../core/intents.ts";
import { gameReads } from "../../../core/game-reads.ts";
import { printedOf } from "../../../core/printed.ts";
import type { ScenarioState } from "../../../core/state.ts";
import { flagged, inPlay, updateCard } from "../../../core/state.ts";
import { moveCard } from "../../../core/zones.ts";
import { heldInHand, leavesHandPicked } from "../../ring-maker/hand.ts";
import type { ReduceContext } from "../../../interpret/interpret.ts";
import { effectsOf } from "../../../windows/listen.ts";

// The destinations of MoveEncounterCard that are out of play.
const OUT_OF_PLAY: ReadonlySet<string> = new Set(["deckTop", "deckBottom", "shuffle", "discard", "victory", "removed"]);

// Whether the instruction takes the picked card (its default target) out of play, with no destruction. A conditional instruction is not read: the Pick keeps the card as a target for what the other instructions do.
function takesPickedOut(instruction: Instruction): boolean {
  if ("when" in instruction && instruction.when) return false;
  switch (instruction.verb) {
    case "DiscardPicked":
    case "RemovePickedFromGame":
    case "HoldPickedUnder":
      return true;
    case "MovePicked":
      return instruction.to === "hand";
    case "Discard":
      return instruction.target.kind === "picked";
    case "ReturnToHand":
    case "PutOnDeck":
    case "AddToVictory":
      return instruction.target == null || instruction.target === "picked";
    case "PlaceFacedownUnder":
      return instruction.target == null || instruction.target === "picked";
    case "RemoveFromGame":
      return instruction.card === "picked";
    case "MoveEncounterCard":
      return (instruction.card == null || instruction.card === "picked") && OUT_OF_PLAY.has(instruction.to);
    default:
      return false;
  }
}

// The walk behind both readers: `eachBody` reads the body of an Each, where a Pick chooses another card (a player to give to), so only the hand moves count after it.
function followingLeaves(following: readonly (Instruction | undefined)[], eachBody: boolean): boolean {
  let past = false;
  for (const instruction of following) {
    if (instruction == null) return false;
    if (instruction.verb === "Pick") {
      if (!eachBody) return false;
      past = true;
      continue;
    }
    if (leavesHandPicked(instruction)) return true;
    if (!past && takesPickedOut(instruction)) return true;
  }
  return false;
}

/** Whether the instructions that follow a Pick (up to the next Pick) take the card it chose out of play, or out of a hand, without destroying it: the pick then leaves out a card that holds `cannotLeavePlay` or `cannotLeaveHand`. */
export function leavesPlayPicked(following: readonly (Instruction | undefined)[]): boolean {
  return followingLeaves(following, false);
}

/** The same for the body of an Each: a Pick inside it chooses another card, so only the hand moves count after it. */
export function leavesPlayPickedInEach(body: readonly (Instruction | undefined)[]): boolean {
  return followingLeaves(body, true);
}

/** Whether a Pick that feeds such a verb may not choose this card: it holds `cannotLeavePlay`, or it lies in a hand and holds `cannotLeaveHand`. False in every game without the flags. */
export function pickKeepsInPlay(state: ScenarioState, id: string): boolean {
  return state.modifiers.length > 0 && (flagged(state, id, "cannotLeavePlay") || heldInHand(state, id));
}

// `moveCard` (core/zones.ts) reads the two holds of a card that cannot leave (play, hand) from here.
export { heldInHand };

/** Whether the card holds `cannotLeaveUnlessDestroyed` (a Captain, 06144:B:1): any move out of play but its destruction leaves it where it is. The one reader behind `moveCard` and the encounter family's moves. False in every game without the flag. */
export function keptInPlay(state: ScenarioState, id: string): boolean {
  return state.modifiers.length > 0 && flagged(state, id, "cannotLeaveUnlessDestroyed");
}

// The title the current stage's records hold in play ("Murzag cannot leave play unless destroyed"): the holder named by its `cannotLeavePlay` constant.
function keptName(state: ScenarioState, ctx: ReduceContext): string | null {
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  if (!stage) return null;
  for (const effect of effectsOf(ctx, stage.code)) {
    for (const instruction of effect.instructions) {
      if (instruction.verb === "ModifyStat" && instruction.stat === "cannotLeavePlay" && instruction.holders?.names?.[0] != null) return instruction.holders.names[0];
    }
  }
  return null;
}

function destroyedHere(steps: readonly EngineStep[], id: string): boolean {
  return steps.some((step) => step.kind === "destroy" && step.targetId === id);
}

/** The settle sweep: the current stage's Captain that lies out of play (not set aside, not destroyed in this intent) returns to the staging area. Inert unless the game reads `cannotLeavePlay`. */
export function captainKept(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.modifiers.length === 0 || state.lost || state.stageCleared || state.stack.length > 0 || state.pendingAttack || state.pendingStrike || !gameReads(state, ctx, '"cannotLeavePlay"')) return state;
  const name = keptName(state, ctx);
  if (name == null) return state;
  const captain = Object.values(state.cards).find((card) => printedOf(ctx.cards, card.code).type === "enemy" && printedOf(ctx.cards, card.code).name === name);
  if (!captain || inPlay(captain.zone) || captain.zone === "setAside" || destroyedHere(steps, captain.id)) return state;
  // His destruction is still being announced: the Forced effect that advances the quest has not run yet.
  if ((state.pendingEvents ?? []).some((event) => event.trigger === "enemyDestroyed" && event.subject === captain.id)) return state;
  return updateCard(moveCard(state, captain.id, { zone: "staging" }), captain.id, { face: "up", controller: null });
}
