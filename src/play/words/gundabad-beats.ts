// Rules: emce.gundabad-quest-deck, emce.bypassing, rr.cancel (data/rules/entries.json); ledger lines 19135:A:2, 19135:B:3, 19137:B:1, 19124:A:1, 19142:B:3.
// What the banner says of Mount Gundabad's quest deck: the first treachery of a round, the side a stage arrives with, a stage flipped at the beginning of the quest phase, bypassed or replaced by a search. A stage is named with its reading (the stages print one title: `stageName`). Pure.
import type { Condition, Effect } from "../../catalog/boundary.ts";
import { flagged, type ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { effectsOf } from "../../rules/windows/listen.ts";

/** The note of the first treachery revealed each round (19137:B:1): its When Revealed effect cannot be canceled by player cards, told as it is revealed. Null for any other card. */
export function firstTreacheryNote(game: ScenarioState, cardId: string, name: string): string | null {
  return flagged(game, cardId, "firstTreachery") ? `${name} is the first treachery revealed this round: its When Revealed effect cannot be canceled by player cards.` : null;
}

/** The side a stage of the quest deck shows when the quest arrives at it, told with the advance: side A until the beginning of the next quest phase. Null for a stage that arrives side B. */
export function stageArrivalNote(game: ScenarioState, cardId: string): string | null {
  const stage = game.cards[cardId];
  if (!stage || stage.face !== "A" || !game.stages.some((item) => item.deck === true && item.code === stage.code)) return null;
  return "It stays side A up until the quest phase begins; its side B text works from then.";
}

// The most quest cards in the victory display that a condition allows, when it holds one.
function mostQuests(condition: Condition | undefined): number | null {
  if (condition?.kind === "count") return condition.max ?? null;
  if (condition?.kind === "all" || condition?.kind === "any") return condition.conditions.map(mostQuests).find((max) => max != null) ?? null;
  return null;
}

const bypassesAlone = (effect: Effect): boolean => effect.timing === "forced" && effect.instructions.some((step) => step.verb === "BypassStage");

/** The lead of the beat of a stage the players had to bypass, from its record: "There are 4 or fewer quest cards in the victory display, so the stage must be bypassed." Null for a stage with no such record (the players chose). */
export function mustBypassLead(ctx: ReduceContext, code: string): string | null {
  const most = mostQuests(effectsOf(ctx, code).find(bypassesAlone)?.condition);
  return most == null ? null : `There are ${most} or fewer quest cards in the victory display, so the stage must be bypassed.`;
}

/** The names a beat tells a stage by: its name with its reading, and the lead of a bypass the stage forces. */
export type StageNames = { card: (cardId: string) => string; mustBypass?: (cardId: string) => string | null };

/**
 * The beat of a stage the intent flipped or left (emce.gundabad-quest-deck, emce.bypassing): flipped to side B at the beginning of the quest phase (after the advance that brought it, when one did), or bypassed or replaced (it leads: it is why the quest moved). The
 * progress a stage loses is a line of its own (a step), so a bypass says it only when there was none. Null when neither happened.
 */
export function stageBeats(before: ScenarioState, after: ScenarioState, names: StageNames): { rank: number; title: string; lines: readonly string[] } | null {
  const id = after.questStage;
  if (!id || !after.stages.some((item) => item.deck === true)) return null;
  if (before.cards[id]?.face === "A" && after.cards[id]?.face === "B" && before.questStage === id) {
    return { rank: 2, title: `${names.card(id)} is flipped`, lines: ["The quest card shows side B at the beginning of the quest phase: its side B text works from now on."] };
  }
  const left = after.stageLeft;
  if (left?.bypassed !== true || left.to !== id || before.questStage !== left.from || before.questStage === id) return null;
  const lost = before.cards[left.from]?.progress ?? 0;
  // A stage searched out of the quest deck (Throat of the Mountain) shows side B at once and the deck is shuffled; a bypassed one arrives side A and goes to the bottom.
  if (after.cards[id]?.face === "B") {
    const progress = lost === 0 ? "had no progress" : `loses its ${lost} progress`;
    return { rank: 0, title: `${names.card(id)} becomes the current quest`, lines: [`The stage that was current ${progress} and goes back into the quest deck, which is shuffled. It is not defeated, so it is not added to the victory display. The new stage is flipped over at once.`] };
  }
  const forced = names.mustBypass?.(left.from);
  const goes = "goes to the bottom of the quest deck. It is not defeated, so it is not added to the victory display.";
  const text = forced ? `${forced} ${lost === 0 ? `It has no progress to lose and ${goes}` : `It ${goes}`}` : lost === 0 ? `It had no progress to lose and ${goes}` : `The stage ${goes}`;
  return { rank: 0, title: `${names.card(left.from)} is bypassed`, lines: [text] };
}
