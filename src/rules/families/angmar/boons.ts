// Rules: rr.first-player, rr.the-word-choose, rr.campaign-pool, ltp.permanent (data/rules/entries.json); ledger line 10160:A:3. Mysterious Omens' reward: starting with the first player, each player may choose 1 of the boons not yet in the game (or set aside) and attach it to a hero they control.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import { queueFront } from "../play/refs.ts";
import type { Focus } from "../index.ts";
import { seatTurn } from "./in-turn.ts";

// A boon is offered while no card of that title is in the game outside the set-aside zone: each boon has one copy, so one the Campaign Pool already attached to a hero (an earlier Omens or The Weather Hills' reward) is not taken twice. Its printed card must be loaded
// (the scenarios that can shuffle Mysterious Omens in deal them: data/overrides.json, scenarioCampaignPlaced); a copy not set aside yet comes from the supply when it is taken.
function offered(state: ScenarioState, code: string, ctx: ReduceContext): boolean {
  const aside = new Set(state.setAside);
  return ctx.cards.has(code) && Object.values(state.cards).every((card) => card.code !== code || aside.has(card.id));
}

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/**
 * ChooseBoon: the player whose turn it is (the first living seat first) is asked which of the boons still to take (set aside, or none yet in the game), or none. A boon is picked by its code; the player then picks the hero that carries it (a hero that can hold it) and a set-aside copy is attached; the next player
 * is asked once this one has answered. A boon taken, or already held from the pool, is not offered again; with none left nobody is asked. Run outside an effect frame, which cannot ask, the step fails.
 */
export function chooseBoon(state: ScenarioState, instruction: Verb<"ChooseBoon">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const turn = seatTurn(state, instruction, steps);
  const left = instruction.codes.filter((code) => offered(state, code, ctx));
  if (!turn || left.length === 0) return state;
  const { seat, cause, goOn } = turn;
  if (focus.chosen == null) return effectData(state) ? askTarget(state, { instruction: turn.asked, seat, chosen: null, cause }, [...left, "none"]) : { ...state, failure: "Choosing a boon needs a choice, and no effect is asking" };
  if (!left.includes(focus.chosen)) return goOn(state);
  // The boon comes from the set-aside zone, or from the supply into it (the game dealt none).
  const taken = state.setAside.some((id) => state.cards[id]?.code === focus.chosen) ? state : spawn(state, focus.chosen, { zone: "setAside" }, "up").state;
  return queueFront(goOn(taken), [
    { instruction: { verb: "Pick", pick: { type: "hero", control: "you", attachable: focus.chosen } }, seat, chosen: null, cause },
    { instruction: { verb: "AttachSetAside", code: focus.chosen }, seat, chosen: null, cause },
  ]);
}
