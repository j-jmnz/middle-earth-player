// Rules: rr.attachment-cards, rr.objective-cards (data/rules/entries.json); ledger lines 07059:A:1, 07024:A:2, 07058:A:1, 08043:A:1.
// The pill under a card that holds a card of The Ring-maker cycle (heldMark, card-effects.ts): Gríma on The Islet, Mugash on a hero, In Need of Rest on a hero, a Key of The Three Trials on its Guardian or Barrow. The engine decided each; the pill only names it. Pure.
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { grimaLyingOn } from "../../readouts/ring-maker/fords.ts";
import { restLyingOn } from "../../readouts/ring-maker/fangorn.ts";
import { mugashLyingOn } from "../../readouts/ring-maker/orc.ts";
import { mouldLyingOn } from "../../readouts/ring-maker/celebrimbor.ts";
import { keysLyingOn } from "../../readouts/ring-maker/trials.ts";
import { REST_MARK } from "../../words/scenarios/ring-maker/fangorn-table.ts";
import { MOULD_MARK } from "../../words/scenarios/ring-maker/celebrimbor-table.ts";
import { heldByName } from "../../words/scenarios/ring-maker/fords-table.ts";
import { keyMark } from "../../words/scenarios/ring-maker/trials-table.ts";
import type { UnderMark } from "../card-effects.ts";

/** The pill of the card with this id when it holds a Ring-maker card, or null for any other card. */
export function ringMakerHeldMark(game: ScenarioState, ctx: ReduceContext, cardId: string): UnderMark | null {
  const nameOf = (id: string) => printedOf(ctx.cards, game.cards[id]?.code ?? "").name;
  // Gríma lying on The Islet (The Fords of Isen, 07059:A:1): "1 held".
  const lying = grimaLyingOn(game, cardId);
  if (lying.length > 0) return heldByName(lying.map(nameOf));
  // Mugash attached to a hero (To Catch an Orc, 07024:A:2): "1 held" on the hero, wherever it lies.
  const mugash = mugashLyingOn(game, cardId);
  if (mugash.length > 0) return heldByName(mugash.map(nameOf));
  // Celebrimbor's Mould on a hero, The Secret Chamber or Bellach (08127:A:1): the pill says it is held.
  if (mouldLyingOn(game, cardId).length > 0) return MOULD_MARK;
  // In Need of Rest on a hero (Into Fangorn, 07058:A:1): its strip under the card shows no name, so the pill says "Rest".
  if (restLyingOn(game, cardId).length > 0) return REST_MARK;
  // A Key of The Three Trials on its Guardian or Barrow (08043:A:1): the pill says its animal; a hero shows the Key as an attachment, so it wears no pill.
  const keys = game.cards[cardId]?.zone === "heroes" ? [] : keysLyingOn(game, cardId);
  return keys.length > 0 ? keyMark(keys.map((id) => game.cards[id]?.code ?? ""), keys.map(nameOf)) : null;
}
