// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages (data/rules/entries.json); ledger line 12026:A:1. The travel row of a location whose Travel line moves progress onto the Stormcaller's
// quest stage (Hidden Cove), as the Aflame rows state the damage they would deal: the numbers the move leaves on the stage, and a caution that arms the confirm when it advances the Stormcaller or
// fills its last stage and loses the game. Pure; every number is one the engine would place.
import { effectsOf } from "../rules/windows/listen.ts";
import type { Effect, Instruction } from "../catalog/boundary.ts";
import { holds } from "../rules/interpret/conditions.ts";
import { areaOf } from "../rules/families/stormcaller/zone.ts";
import { stormcallerLastStage } from "../rules/families/stormcaller/values.ts";
import { committedWillpower, questPointsOf } from "../rules/quest/quest.ts";
import type { ReduceContext, ScenarioState } from "../rules/engine/reduce.ts";


/** What the travel row of a location adds: the words after its label, and the caution that arms the confirm. */
export type StormcallerTravel = { words: string; caution?: string };

/** The row text of travelling to `locationId`, or null when its Travel line moves no progress onto the Stormcaller's stage. */
export function stormcallerTravel(game: ScenarioState, ctx: ReduceContext, locationId: string): StormcallerTravel | null {
  const code = game.cards[locationId]?.code;
  const area = areaOf(game);
  const quest = game.questStage ? game.cards[game.questStage] : undefined;
  const stage = area ? game.cards[area.stage] : undefined;
  if (code == null || !area || !quest || !stage) return null;
  const travel = effectsOf(ctx, code).find((effect) => effect.timing === "travel");
  const move = travel?.instructions.find((instruction) => instruction.verb === "MoveProgressToStormcaller");
  if (move?.verb !== "MoveProgressToStormcaller" || typeof move.amount !== "number") return null;
  const points = questPointsOf(game, stage, ctx.cards);
  if (points == null) return null;
  const moved = Math.min(move.amount, quest.progress);
  const after = Math.min(points, stage.progress + moved);
  const full = stage.progress + moved >= points;
  const last = area.number >= stormcallerLastStage(game);
  const numbers = `Stormcaller ${stage.progress} → ${after} of ${points}`;
  if (!full) return { words: numbers };
  return last
    ? { words: `${numbers}: the players lose`, caution: "Tap again: the Stormcaller fills its last stage and the game is lost" }
    : { words: `${numbers}: it advances`, caution: `Tap again: the Stormcaller advances to stage ${area.number + 1} of ${stormcallerLastStage(game)}` };
}

// The first `committedWillpower` condition in a list of instructions, looking inside a ForEachPlayer ("Each player contributing at least 8 Willpower to the quest", 12028:A:1).
function minWillpower(instructions: readonly Instruction[]): number | null {
  for (const instruction of instructions) {
    if ("when" in instruction && instruction.when?.kind === "committedWillpower") return instruction.when.min;
    if (instruction.verb === "ForEachPlayer") {
      const inner = minWillpower(instruction.instructions);
      if (inner != null) return inner;
    }
  }
  return null;
}

/**
 * What a When Revealed that asks of "each player contributing at least X Willpower to the quest" (Man Overboard!, 12028:A:1) adds to its pick sheet's note: the Willpower the asked seat commits against X, and, when the
 * printed line cannot be canceled at the worst heading, that it cannot be at Storm. Null for any other effect.
 */
export function committedNote(game: ScenarioState, ctx: ReduceContext, effect: Effect | undefined, seat: number): string | null {
  const min = effect ? minWillpower(effect.instructions) : null;
  if (!effect || min == null) return null;
  const committed = committedWillpower(game, ctx.cards, seat);
  const who = game.seatCount > 1 ? `Player ${seat + 1} commits` : "You commit";
  const cancel = effect.uncancelable != null ? ` It cannot be canceled at Storm${holds(game, effect.uncancelable, { actor: seat, sourceId: null, returned: 0 }, ctx) ? ": the heading is at Storm" : ", and the heading is not"}.` : "";
  return `${who} ${committed} Willpower (${min} or more discards a questing character).${cancel}`;
}
