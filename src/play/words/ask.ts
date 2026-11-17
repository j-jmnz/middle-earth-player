// The one order a pick's words are built in: the sheet (src/play/choice/sheets.ts) and the scenario words test both ask this function, so a sentence a later function
// would say is never worded by one and shown by the other. The record's asks entry (asks.ts) first, then a trade's hero, the grapple family, the wilderland family, the sea family (which reads the table), then `pickWords`.
import type { Instruction } from "../../catalog/boundary.ts";
import type { Cause } from "../../rules/core/cause.ts";
import { restrictedLimit } from "../../rules/player/attach.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { effectsOf } from "../../rules/windows/listen.ts";

import { asksPick, type AskedWords } from "./asks.ts";
import { pickWords, type ChoiceNames } from "./choice.ts";
import { grappleAsk, grappleFactsOf } from "./scenarios/grapple.ts";
import { seaAsk } from "./scenarios/sea.ts";
import { tradeWords } from "./scenarios/uncharted.ts";
import { wilderlandAsk } from "./scenarios/wilderland.ts";
import { lootLeaveOutWords } from "./loot.ts";

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
  // The record the instruction is from: the frame's effect id, and the cause of the queued instruction when the frame runs several records (asks.ts).
  effectId?: string;
  cause?: Cause;
}): AskedWords {
  const { game, ctx, names, instruction, queue, options, source, picked, amountNow, effectId, cause } = a;
  const written = asksPick({ game, ctx, names, instruction, source, amountNow, options, ...(effectId ? { effectId } : {}), ...(cause ? { cause } : {}) });
  if (written) return written;
  const traded = instruction.verb === "TradeDamageForThreat" && instruction.character ? game.cards[instruction.character] : undefined;
  if (instruction.verb === "TradeDamageForThreat" && traded) {
    const loses = effectsOf(ctx, traded.code).some((item) => item.trigger === "leftPlay" && item.instructions.some((step) => step.verb === "LoseGame"));
    return { verb: "Trade", prompt: tradeWords(game, ctx.cards, instruction, names.card(traded.id), loses) };
  }
  // The Burglar's Turn's Setup with more candidates than the loot deck takes (22024:A:2).
  if (instruction.verb === "BuildLootDeck") return lootLeaveOutWords(options.length, instruction.size);
  return (
    grappleAsk(instruction, source, names, grappleFactsOf(game, ctx, instruction, picked)) ??
    wilderlandAsk(instruction, source, names, queue[0], picked, { game, ctx, options }) ??
    seaAsk(instruction, queue[0], options, game, ctx, names, source, queue.slice(1)) ??
    pickWords(instruction, queue[0], names, source, source ? restrictedLimit(game, source) : 2, game, amountNow, queue.slice(1))
  );
}
