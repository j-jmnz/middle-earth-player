// Rules: rr.first-player, rr.the-word-choose, rr.campaign-pool, ltp.permanent (data/rules/entries.json); ledger line 10160:A:3. Mysterious Omens' reward: starting with the first player, each player may choose 1 of the boons still set aside and attach it to a hero they control.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import { queueFront } from "../play/refs.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/**
 * ChooseBoon: the player whose turn it is (the first living seat first) is asked which of the boons still set aside to take, or none. A boon is picked by its code; the player then picks the hero that carries it (a hero that can hold it) and a set-aside copy is attached; the next player
 * is asked once this one has answered. A boon taken is not offered again; with none left nobody is asked. Run outside an effect frame, which cannot ask, the step fails.
 */
export function chooseBoon(state: ScenarioState, instruction: Verb<"ChooseBoon">, focus: Focus, steps: EngineStep[]): ScenarioState {
  const order = livingSeats(state);
  const seat = instruction.seat ?? order[0];
  const left = instruction.codes.filter((code) => state.setAside.some((id) => state.cards[id]?.code === code));
  if (seat == null || left.length === 0) return state;
  const next = order[order.indexOf(seat) + 1];
  const cause = currentCause(steps, UNATTRIBUTED);
  const goOn = (current: ScenarioState): ScenarioState => (next != null ? queueFront(current, [{ instruction: { ...instruction, seat: next }, seat: next, chosen: null, cause }]) : current);
  if (focus.chosen == null) return effectData(state) ? askTarget(state, { instruction: { ...instruction, seat }, seat, chosen: null, cause }, [...left, "none"]) : { ...state, failure: "Choosing a boon needs a choice, and no effect is asking" };
  if (!left.includes(focus.chosen)) return goOn(state);
  return queueFront(goOn(state), [
    { instruction: { verb: "Pick", pick: { type: "hero", control: "you", attachable: focus.chosen } }, seat, chosen: null, cause },
    { instruction: { verb: "AttachSetAside", code: focus.chosen }, seat, chosen: null, cause },
  ]);
}
