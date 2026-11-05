// Rules: rr.quest-cards-quest-deck, rr.quest-advancement, ltp.victory-display (data/rules/entries.json).
//
// The quest stages the players have already defeated, for the quest stage's preview (docs/design-system-table.md, Cards): the engine
// keeps no history of stages, but a defeated stage keeps its instance and lies set aside, or in the victory display in a game with
// ships (rules/quest/quest.ts advanceStage). Pure, so a test reads it; nothing in the engine or the goldens reads it.
import { stageSeat, viewOf } from "../../rules/families/breaking/areas.ts";
import { orderedQuest } from "../../rules/families/quest/order.ts";
import { stagePlace } from "../../rules/families/quest/branch.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

// The codes of the stages before `code` in the quest's own order, oldest first: the stages a branching quest reached (its first stage, then `stagesReached`,
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

// A quest that advances in the order of its quest deck (Voyage Across Belegaer) plays its shuffled stage 2 cards in deck order, so the order of `stages` says nothing
// about which came first: the defeated stages are the quest cards lying set aside or in the victory display, in the order they were moved there.
function defeatedInOrder(game: ScenarioState, ctx: ReduceContext, owner: number | null): string[] {
  const codes = new Set(game.stages.map((stage) => stage.code));
  return [...game.setAside, ...game.victory].filter((id) => {
    const card = game.cards[id];
    return card != null && codes.has(card.code) && ctx.cards.get(card.code)?.type === "quest" && (owner == null || card.controller == null || card.controller === owner);
  });
}

/**
 * The stage number the quest card `code` holds: its place in the quest (branch.ts stagePlace), except that the cards a ShuffleStages names are one place
 * (the four stage 2 cards of Voyage Across Belegaer all hold stage 2, whatever order the deck plays them in). Null for a card that is no stage.
 */
export function heldStage(game: ScenarioState, ctx: ReduceContext, code: string): { at: number; of: number } | null {
  if (!orderedQuest(game)) return stagePlace(game, code);
  const groups = ctx.effects.flatMap((effect) => effect.instructions).flatMap((instruction) => (instruction.verb === "ShuffleStages" ? [instruction.codes] : []));
  // Each stage stands for the first card of its group (or itself); the places are those, once each, in the quest's order.
  const lead = (stageCode: string) => groups.find((codes) => codes.includes(stageCode))?.[0] ?? stageCode;
  const places = game.stages.map((stage) => lead(stage.code)).filter((value, at, all) => all.indexOf(value) === at);
  const at = places.indexOf(lead(code));
  return at < 0 ? null : { at: at + 1, of: places.length };
}

/**
 * The card ids of the stages defeated before the quest stage `stageId`, newest first (the stage just beaten leads, so a swipe steps back through the
 * quest); empty for a card that is not a quest stage. Once stages are separate between players it reads the stage's own seat (`viewOf`): the shared
 * stages, then that seat's own, never another seat's. A code with no quest card set aside or in the victory display (a stage the quest skipped) is left out.
 */
export function earlierStages(whole: ScenarioState, ctx: ReduceContext, stageId: string): string[] {
  const owner = stageSeat(whole, stageId);
  const game = viewOf(whole, owner ?? undefined);
  const stage = game.questStage === stageId ? game.cards[stageId] : undefined;
  if (!stage) return [];
  if (orderedQuest(game)) return defeatedInOrder(game, ctx, owner).reverse();
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
  return ids.reverse();
}
