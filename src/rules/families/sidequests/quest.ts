// Rules: rr.step-3-4, rr.quest-advancement, rr.discard-pile-and-victory-display, mec108.side-quests-in-play (data/rules/entries.json).
// A side quest in the staging area, encounter or player (The Lost Realm rules), is a quest card: the characters quest on the current quest as a whole (one comparison of all the committed Willpower with the staging threat, families/wilderland/night-quest.ts
// places the surplus on a side quest that is the current quest), and a full one is defeated by the settle sweep (families/wilderland/night.ts defeatFullSideQuests).
import type { Cause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat, releaseAttachments } from "../../core/keywords.ts";
import { queueEvent } from "../../windows/queue.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { noteHostDefeated } from "../attachments/hold.ts";
import { questCardDefeatedHeard } from "../quest/branch.ts";
import { releaseHeldOnDefeat } from "../angmar/hold.ts";
import { absorbProgress } from "../angmar/sponge.ts";
import { flipDefeated, flipsInto } from "../angmar/stage.ts";
import { noteProgressPlaced } from "../angmar/progress.ts";
import { addToVictory } from "./victory.ts";

// Progress on a side quest: it takes what it needs to be full and no more; a full one is swept up by the settle sweep (families/wilderland/night.ts).
export function placeOnSideQuest(from: ScenarioState, questId: string, wanted: number, cause: Cause, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // Progress that would be placed on a quest card first fills the sponges in the staging area (Forbidden Descent, 10101:A:1).
  const { state, remaining: amount } = absorbProgress(from, wanted, ctx.cards, steps);
  const quest = state.cards[questId];
  if (!quest || amount <= 0) return state;
  const points = printedOf(ctx.cards, quest.code).questPoints == null ? null : modifiedStat(state, quest, "questPoints", ctx.cards);
  const placed = points == null ? amount : Math.min(amount, Math.max(0, points - quest.progress));
  let next = state;
  if (placed > 0) {
    next = noteProgressPlaced(updateCard(next, questId, { progress: quest.progress + placed }), questId, placed);
    steps.push({ kind: "progress", targetId: questId, amount: placed, cause });
  }
  return next;
}

// The side quest is defeated: the cards attached to it hear it and are discarded with it, the quest itself hears it
// (`questDefeated`), and it is added to the victory display, or to its owner's discard pile when its limit is reached. A side quest whose record says "When this quest is defeated, flip it over" (10109:A:3) flips into its Clue objective in the staging area instead:
// it stays in play, so its attachments stay on it (rr.attachment-cards: an attachment is discarded only when its host leaves play, and a play restriction is checked only as it enters play).
export function defeatSideQuest(state: ScenarioState, questId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const quest = state.cards[questId];
  if (!quest) return state;
  // A card the side quest holds under it in play comes back to its players (Rescue Iârion, families/angmar/hold.ts).
  const into = flipsInto(ctx, quest.code);
  // An encounter side quest is no player's card: the seat that revealed it does not control it as it leaves play, so the player cards facedown under it stay there for its own effect (09051:A:2) instead of going to a discard pile. A player side quest stays its player's.
  const heard = noteHostDefeated(printedOf(ctx.cards, quest.code).type === "encounter-side-quest" && quest.controller != null ? updateCard(state, questId, { controller: null }) : state, questId);
  let next = releaseHeldOnDefeat(into ? heard : releaseAttachments(heard, questId, ctx.cards, steps), questId);
  next = into ? flipDefeated(next, questId, into) : updateCard(addToVictory(next, questId, ctx), questId, { progress: 0, committed: false });
  next = queueEvent(next, { trigger: "questDefeated", seat: quest.controller, cardId: questId, subject: questId });
  // Any quest card hears that a quest card was defeated ("After a quest card is defeated", 01135:A:3).
  return questCardDefeatedHeard(next, ctx) ? queueEvent(next, { trigger: "questCardDefeated", seat: null, subject: questId }) : next;
}
