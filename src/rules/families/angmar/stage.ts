// Rules: mec108.side-quests-in-play, mec108.the-investigation, rr.quest-advancement, rr.constant-ability, rr.attachment-cards (data/rules/entries.json); ledger lines 10094:B:2, 10094:B:4, 10109:A:3, 10111:A:3, 10113:A:3.
// The Treachery of Rhudaur's stage 1: its side quests are removed from the game when time runs out, the quest advances at once when none is left in play (a constant "if", checked at each settle), and a side quest defeated is flipped over
// into its Clue objective in the staging area instead of joining the victory display.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { releaseAttachments } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { advanceStage } from "../../quest/quest.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";
import { effectsOf } from "../../windows/listen.ts";
import { isSideQuest } from "../wilderland/night-quest.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The settle sweep: the main quest card holds `advanceNow` (its constant "if there are no Treachery of Rhudaur side quests in play, immediately advance", 10094:B:4) once nothing is resolving, so the quest advances and the next stage's When Revealed effects resolve. */
export function advanceWhenFlagged(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const stage = state.questStage;
  if (state.modifiers.length === 0 || state.lost || state.stageCleared || state.stack.length > 0 || state.pendingAttack || state.pendingStrike || !stage || !flagged(state, stage, "advanceNow")) return state;
  const before = steps.length;
  const advanced = advanceStage(state, ctx.cards, steps, (current) => !restricted(current, ctx, "advance").length);
  return afterProgress(advanced, before, ctx, steps);
}

/** RemoveSideQuestsFromGame: each card in the staging area with one of the titles (an encounter side quest, quest side up) leaves the game, not the victory display: its attachments are discarded, its progress and the current quest mark go with it. */
export function removeSideQuestsFromGame(state: ScenarioState, instruction: Verb<"RemoveSideQuestsFromGame">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of state.staging) {
    const card = next.cards[id];
    if (!card || !isSideQuest(next, id, ctx) || !instruction.names.includes(printedOf(ctx.cards, card.code).name)) continue;
    const released = releaseAttachments(next, id, ctx.cards, steps);
    next = moveCard(updateCard(released, id, { progress: 0, damage: 0, resources: 0 }), id, { zone: "removed" });
    next = { ...next, modifiers: next.modifiers.filter((modifier) => modifier.instanceId !== id) };
  }
  return next;
}

/** The code a defeated side quest flips into (its record holds the marker `FlipWhenDefeated`), or null for every other side quest. */
export function flipsInto(ctx: ReduceContext, code: string): string | null {
  for (const effect of effectsOf(ctx, code)) for (const instruction of effect.instructions) if (instruction.verb === "FlipWhenDefeated") return instruction.into;
  return null;
}

/** A side quest defeated flips over: the card shows the Clue objective, in the staging area, faceup, unclaimed, with no progress and no attachment (they were discarded with it), and it is no longer the current quest. */
export function flipDefeated(state: ScenarioState, id: string, into: string): ScenarioState {
  const card = state.cards[id];
  if (!card) return state;
  const flipped = updateCard(state, id, { code: into, other: card.code, face: "up", controller: null, progress: 0, damage: 0, resources: 0, committed: false });
  return { ...flipped, modifiers: flipped.modifiers.filter((modifier) => !(modifier.instanceId === id && modifier.stat === "currentQuest")) };
}
