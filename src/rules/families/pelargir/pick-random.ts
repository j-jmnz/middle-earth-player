// Rules: rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 06024:A:1.
// A card chosen at random among the cards a pick finds ("Randomly select 1 ally controlled by the first player, if able"): the game's seed chooses, so one seed always makes the same choice, and nobody is asked.
import type { Instruction } from "../../../catalog/boundary.ts";

import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { effectData, pushPicked } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

/** PickRandom: one of the cards the pick finds becomes the picked card of the running effect. With none nothing is picked; with one it is taken and the seed is left alone. */
export function pickRandom(state: ScenarioState, instruction: Extract<Instruction, { verb: "PickRandom" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const data = effectData(state);
  if (!data) return state;
  const ids = pickCandidates(state, instruction.pick, focus.seat, data.picked ?? [], focus.sourceId, ctx, data.x, data.participants, false, { subject: data.subject ?? null, other: data.other ?? null });
  if (ids.length === 0) return state;
  if (ids.length === 1) return pushPicked(state, ids[0]);
  const rolled = shuffleIds(ids, state.seed, state.seedCursor);
  return pushPicked({ ...state, seedCursor: rolled.cursor }, rolled.ids[0]);
}
