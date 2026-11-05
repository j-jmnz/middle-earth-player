// Rules: rr.quest-cards-quest-deck, rr.quest-advancement, ltp.victory-display (data/rules/entries.json).
//
// The quest stages the players have already defeated, for the quest stage's preview (docs/design-system-table.md, Cards): the engine
// keeps no history of stages, but a defeated stage keeps its instance and lies set aside, or in the victory display in a game with
// ships (rules/quest/quest.ts advanceStage). Pure, so a test reads it; nothing in the engine or the goldens reads it.
import { stageSeat, viewOf } from "../../rules/families/breaking/areas.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

// The codes of the stages before `code`, oldest first: the stages a branching quest reached (its first stage, then `stagesReached`,
// which ends at the current one), else the quest definition's stages before it.
function codesBefore(game: ScenarioState, code: string): readonly string[] {
  if (game.stagesReached) {
    const path = [...(game.stages[0] ? [game.stages[0].code] : []), ...game.stagesReached];
    const at = path.lastIndexOf(code);
    return at < 0 ? path : path.slice(0, at);
  }
  const at = game.stages.findIndex((stage) => stage.code === code);
  return at < 0 ? [] : game.stages.slice(0, at).map((stage) => stage.code);
}

/**
 * The card ids of the stages defeated before the quest stage `stageId`, oldest first; empty for a card that is not a quest stage. Once
 * stages are separate between players it reads the stage's own seat (`viewOf`): the shared stages, then that seat's own, never another
 * seat's. A code with no quest card set aside or in the victory display (a stage the quest skipped) is left out.
 */
export function earlierStages(whole: ScenarioState, ctx: ReduceContext, stageId: string): string[] {
  const owner = stageSeat(whole, stageId);
  const game = viewOf(whole, owner ?? undefined);
  const stage = game.questStage === stageId ? game.cards[stageId] : undefined;
  if (!stage) return [];
  const out = [...game.setAside, ...game.victory];
  const taken = new Set<string>();
  const ids: string[] = [];
  for (const code of codesBefore(game, stage.code)) {
    const id = out.find((candidate) => {
      const card = game.cards[candidate];
      if (!card || taken.has(candidate) || card.code !== code || ctx.cards.get(code)?.type !== "quest") return false;
      // A seat's own stage carries that seat as its controller (families/breaking/index.ts startSeparateStage); a shared stage none.
      return owner == null || card.controller == null || card.controller === owner;
    });
    if (!id) continue;
    taken.add(id);
    ids.push(id);
  }
  return ids;
}
