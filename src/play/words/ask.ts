// The one order a pick's words are built in: the sheet (src/play/choice/sheets.ts) and the scenario words test both ask this function, so a sentence a later function
// would say is never worded by one and shown by the other. A trade's hero, the grapple family, the wilderland family, the sea family (which reads the table), then `pickWords`.
import type { Instruction } from "../../catalog/boundary.ts";
import { restrictedLimit } from "../../rules/player/attach.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { effectsOf } from "../../rules/windows/listen.ts";

import { pickWords, type ChoiceNames, type PickWords } from "./choice.ts";
import { grappleAsk, grappleFactsOf } from "./grapple.ts";
import { seaAsk } from "./sea.ts";
import { tradeWords } from "./uncharted.ts";
import { wilderlandAsk } from "./wilderland.ts";

/** What the instruction a player is asked about says to ask. `queue` is the instructions after the asked one (`queue[0]` is the next instruction), `picked` the card the effect last picked. */
export function askWords(a: {
  game: ScenarioState;
  ctx: ReduceContext;
  names: ChoiceNames;
  instruction: Instruction;
  queue: readonly Instruction[];
  options: readonly string[];
  source: string | null;
  picked: string | null;
  // What the instruction after the pick deals or places, read now.
  amountNow?: number;
}): PickWords {
  const { game, ctx, names, instruction, queue, options, source, picked, amountNow } = a;
  const traded = instruction.verb === "TradeDamageForThreat" && instruction.character ? game.cards[instruction.character] : undefined;
  if (instruction.verb === "TradeDamageForThreat" && traded) {
    const loses = effectsOf(ctx, traded.code).some((item) => item.trigger === "leftPlay" && item.instructions.some((step) => step.verb === "LoseGame"));
    return { verb: "Trade", prompt: tradeWords(game, ctx.cards, instruction, names.card(traded.id), loses) };
  }
  return (
    grappleAsk(instruction, source, names, grappleFactsOf(game, ctx, instruction, picked)) ??
    wilderlandAsk(instruction, source, names, queue[0], picked) ??
    seaAsk(instruction, queue[0], options, game, ctx, names, source) ??
    pickWords(instruction, queue[0], names, source, source ? restrictedLimit(game, source) : 2, game, amountNow, queue.slice(1))
  );
}
