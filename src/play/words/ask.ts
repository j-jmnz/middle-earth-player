// The one order a pick's words are built in: the sheet (src/play/choice/sheets.ts) and the scenario words test both ask this function, so a sentence a later function
// would say is never worded by one and shown by the other. The record's asks entry (asks.ts) first (after a trade or a Discover that name what they hold), the grapple family, the wilderland family, the sea family (which reads the table), then `pickWords`.
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
import { framsburgAsk } from "./scenarios/framsburg.ts";
import { wilderlandAsk } from "./scenarios/wilderland.ts";
import { lootLeaveOutWords } from "./loot.ts";
import { burglePickWords } from "./scenarios/the-hobbit/burgle.ts";
import { riddleAsk } from "./scenarios/the-hobbit/riddles.ts";

/** What the instruction a player is asked about says to ask. `queue` is the instructions after the asked one (`queue[0]` is the next instruction), `picked` the card the effect last picked. */
/** Which of an expanded discard's picks this is, "Card 2 of 4."; none for a discard of one. */
function withPlace<T extends { prompt: string }>(words: T, place: { nth: number; of: number }): T {
  return place.of > 1 ? { ...words, prompt: `${words.prompt} Card ${place.nth} of ${place.of}.` } : words;
}

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
  // The DiscardFromHand a Pick was expanded from, and the place of this pick among its picks: the record's entry is keyed on the DiscardFromHand, and the sheet says "Card 2 of 4" (effect-frames.ts expandDiscards).
  origin?: Instruction;
  place?: { nth: number; of: number };
}): AskedWords {
  const { game, ctx, names, instruction, queue, options, source, picked, amountNow, effectId, cause } = a;
  const asked = a.origin?.verb === "DiscardFromHand" ? a.origin : instruction;
  // The hand card step 3 of a burgle attempt makes the first player discard: before the asks, since the burgle's effect frame stands on the card that has the burgle effect and its records may ask too.
  const burgling = burglePickWords(game, ctx, names, effectId, game.window?.kind === "choose" ? game.window.seat : game.firstPlayer);
  if (burgling) return burgling;
  // The same Pick queued again (a Repeat's later rounds), counted when an entry has a `countdown`.
  const again = instruction.verb === "Pick" ? () => queue.filter((later) => JSON.stringify(later) === JSON.stringify(instruction)).length : undefined;
  // A trade of damage for threat that names its character says that character's hit points left and what his leaving costs, which no entry can: the record's entry words the same trade where no character is named yet.
  const traded = instruction.verb === "TradeDamageForThreat" && instruction.character ? game.cards[instruction.character] : undefined;
  if (instruction.verb === "TradeDamageForThreat" && traded) {
    const loses = effectsOf(ctx, traded.code).some((item) => item.trigger === "leftPlay" && item.instructions.some((step) => step.verb === "LoseGame"));
    return { verb: "Trade", prompt: tradeWords(game, ctx.cards, instruction, names.card(traded.id), loses) };
  }
  // A Discover that has looked at cards says which Loot objectives, which Hazard and what becomes of the rest, which no entry can: the record's entry words the same pick before anything is looked at.
  if (instruction.verb === "Discover" || instruction.verb === "ResolveDiscover") {
    const looked = framsburgAsk(instruction, source, names, queue[0], { game, ctx, options });
    if (looked) return looked;
  }
  const written = asksPick({ game, ctx, names, instruction: asked, source, amountNow, options, ...(again ? { again } : {}), ...(effectId ? { effectId } : {}), ...(cause ? { cause } : {}) });
  if (written) return a.place ? withPlace(written, a.place) : written;
  // The Burglar's Turn's Setup with more candidates than the loot deck takes (22024:A:2).
  if (instruction.verb === "BuildLootDeck") return lootLeaveOutWords(options.length, instruction.size);
  const riddle = riddleAsk(instruction, queue, game, ctx, names);
  if (riddle) return riddle;
  const words = (
    grappleAsk(instruction, source, names, grappleFactsOf(game, ctx, instruction, picked)) ??
    wilderlandAsk(instruction, source, names, queue[0], picked, { game, ctx, options }) ??
    seaAsk(instruction, queue[0], options, game, ctx, names, source, queue.slice(1)) ??
    pickWords(instruction, queue[0], names, source, source ? restrictedLimit(game, source) : 2, game, amountNow, queue.slice(1))
  );
  return a.place && a.origin?.verb === "DiscardFromHand" ? withPlace(words, a.place) : words;
}
