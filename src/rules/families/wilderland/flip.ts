// Rules: rr.guarded (data/rules/entries.json); ledger line 18069:A:2. "Flip over Woodmen Village and attach Haldan to the just-added enemy as a guarded objective": the card shows its other side and enters the staging area.
import type { Instruction } from "../../../catalog/boundary.ts";

import { lastPicked } from "../../interpret/player-verbs.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import { guardWith } from "../objectives/guard.ts";
import type { Focus } from "../index.ts";

/** FlipOver: the source card (with `target: "subject"` the card the event is about), wherever it lies, becomes the card `into` and enters the staging area faceup with none of its old tokens; with `guardedBy` the picked card guards it. With `setAside` the card goes out of play to the set-aside zone instead (Dark Pit, 51301:B:1). With `control: "firstPlayer"` the card instead enters the first player's play area, faceup and ready, and enters play for him. A source that is gone changes nothing. */
export function flipOver(state: ScenarioState, instruction: Extract<Instruction, { verb: "FlipOver" }>, focus: Focus, subject: string | null = null): ScenarioState {
  const id = instruction.target === "subject" ? subject : focus.sourceId;
  const card = id ? state.cards[id] : undefined;
  if (!id || !card) return state;
  if (instruction.control === "firstPlayer") {
    const seat = state.firstPlayer;
    const taken = updateCard(moveCard(state, id, { zone: "play", seat }), id, { code: instruction.into, other: card.code, face: "up", exhausted: false, controller: seat, progress: 0, damage: 0, resources: 0 });
    return queueEvent(taken, { trigger: "enteredPlay", seat, cardId: id });
  }
  if (instruction.setAside === true) return updateCard(moveCard(state, id, { zone: "setAside" }), id, { code: instruction.into, other: card.code, face: "down", exhausted: false, controller: null, progress: 0, damage: 0, resources: 0 });
  const flipped = updateCard(moveCard(state, id, { zone: "staging" }), id, { code: instruction.into, other: card.code, face: "up", controller: null, progress: 0, damage: 0, resources: 0 });
  const guard = instruction.guardedBy ? lastPicked(flipped) : "";
  return guard !== "" && flipped.cards[guard] ? guardWith(flipped, guard, id) : flipped;
}
