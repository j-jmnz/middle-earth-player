// Rules: hob.venom-poison, hob.unconscious-characters, hob.staging-area-creating, hob.staging-area-combining (data/rules/entries.json); ledger lines 132028:A:1 to 132034:A:2, 132067:B:1, 132068:B:1, 132069:A:1 to 132070:B:4.
// The verbs src/catalog/families/poison.ts adds: poison and the unconscious state (poison.ts), the pick filters (pick.ts), the poison amount (amounts.ts), Venom (venom.ts) and the stages that split the players (stages.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { shuffleIds } from "../../core/seed.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { attackNowFromStaging } from "../south/watcher.ts";
import type { Focus } from "../index.ts";
import { poisonAmount } from "./amounts.ts";
import { poisonPickMatches } from "./pick.ts";
import { discardPoison, givePoison, makeUnconscious, readyUnconscious } from "./poison.ts";
import { sweepCommitted } from "./quest.ts";
import { advanceOtherPlayers, joinAtStage } from "./stages.ts";
import { withSeat } from "../../core/state.ts";

// The card the instruction's `target` names, the last picked card by default.
function targetOf(state: ScenarioState, ref: Extract<Instruction, { verb: "GivePoison" }>["target"], focus: Focus): string | null {
  return refCard(state, ref ?? "picked", frameScope(state, focus.seat, focus.sourceId));
}

// ShuffleSetAsideIntoDeck: a set-aside card with the printed code goes into the acting player's deck, shuffled in.
function shuffleSetAsideIntoDeck(state: ScenarioState, code: string, seat: number): ScenarioState {
  const id = state.setAside.find((other) => state.cards[other]?.code === code);
  if (!id || !state.seats[seat]) return state;
  const moved = moveCard(state, id, { zone: "deck", seat });
  const held = moved.seats[seat];
  if (!held) return moved;
  const shuffled = shuffleIds(held.deck, moved.seed, moved.seedCursor);
  return { ...withSeat(moved, seat, { ...held, deck: shuffled.ids }), seedCursor: shuffled.cursor };
}

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "GivePoison":
      return givePoison(state, targetOf(state, instruction.target, focus), instruction.amount ?? 1, ctx, steps);
    case "DiscardPoison":
      return discardPoison(state, targetOf(state, instruction.target, focus), instruction.all === true ? "all" : (instruction.amount ?? 1));
    case "MakeUnconscious":
      return makeUnconscious(state, targetOf(state, instruction.target, focus), ctx);
    case "ReadyUnconscious":
      return readyUnconscious(state, targetOf(state, instruction.target, focus));
    case "AttackPickedPlayer": {
      const target = state.cards[lastPicked(state)];
      return target?.controller != null && focus.sourceId ? attackNowFromStaging(state, focus.sourceId, target.controller, ctx, steps, { shadow: true }) : state;
    }
    case "ShuffleSetAsideIntoDeck":
      return shuffleSetAsideIntoDeck(state, instruction.code, focus.seat);
    case "AdvanceOtherPlayers":
      return advanceOtherPlayers(state, instruction.code, focus, ctx, steps);
    case "JoinAtStage":
      return joinAtStage(state, instruction.code, focus, ctx, steps);
    default:
      return null;
  }
}

// The settle sweep runs only in a game that has a card that makes a character unconscious, so every other game's state stays as it was.
const sweep = (state: ScenarioState, ctx: ReduceContext): ScenarioState => (gameReads(state, ctx, '"verb":"MakeUnconscious"') ? sweepCommitted(state, ctx) : state);

export const manifest: RulesFamily = {
  name: "poison",
  verbs: ["GivePoison", "DiscardPoison", "MakeUnconscious", "ReadyUnconscious", "AttackPickedPlayer", "ShuffleSetAsideIntoDeck", "AdvanceOtherPlayers", "JoinAtStage"],
  run,
  pick: poisonPickMatches,
  amount: (state, amount, scope) => poisonAmount(state, amount, scope),
  settle: { sweep },
};
