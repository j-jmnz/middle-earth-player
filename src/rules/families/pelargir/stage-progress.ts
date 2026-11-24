// Rules: ats.setup-the-druadan-forest, rr.discard-pile-and-victory-display, faq.progress-without-advancing (data/rules/entries.json); ledger lines 06044:B:2, 06044:B:3, 06045:A:3.
// "When an enemy has progress equal to its hit points, add it to the victory display and place those progress tokens on the quest." While the table holds `progressToVictory` (the record of The Passage Out), an enemy in play with progress of at least its printed hit points
// (the progress is never damage, so the card's hit points are the printed ones; reading of 06044:B:2) goes to the victory display faceup, and every progress token it held goes on the current quest card. The enemy leaves first, so a card that reads the victory display (Drû-buri-Drû's
// own bar on winning) sees it there when the tokens land and the quest advance is checked. The tokens may pile above the stage's quest points when an advance is barred (faq.progress-without-advancing).
import { inCause, ruleCause } from "../../core/cause.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { moveEncounter } from "../encounter/moves.ts";
import { progressToQuest } from "../quest/doors.ts";

/** The enemies in play (staging area and engaged) that hold progress equal to their printed hit points, in id order. */
function full(state: ScenarioState, ctx: ReduceContext): string[] {
  return Object.values(state.cards)
    .filter((card) => {
      if (card.progress <= 0 || (card.zone !== "staging" && card.zone !== "engaged")) return false;
      const printed = printedOf(ctx.cards, card.code);
      return printed.type === "enemy" && printed.health != null && card.progress >= printed.health;
    })
    .map((card) => card.id);
}

/** The family's sweep for `progressToVictory`: each full enemy goes to the victory display and its progress to the quest. Inert in a game whose records do not name the flag, and while the table does not hold it. */
export function progressesToVictory(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.modifiers.length === 0 || !gameReads(state, ctx, '"progressToVictory"') || !flagged(state, "table", "progressToVictory")) return state;
  let next = state;
  for (const id of full(state, ctx)) {
    const enemy = next.cards[id];
    if (!enemy || enemy.progress <= 0) continue;
    const before = next;
    next = inCause(steps, ruleCause("rr.discard-pile-and-victory-display"), () => progressToQuest(moveEncounter(before, id, "victory", enemy.controller ?? before.activeSeat, ctx, steps), enemy.progress, ctx, steps));
    // The progress may defeat the last stage while a window of the attack that filled the enemy is still open: the game is won, as WinGame ends it, and the Resolution is asked for.
    if (next.stageCleared && !before.stageCleared) next = { ...next, window: null, pendingAttack: null };
  }
  return next;
}
