// Rules: rm.scour, rm.the-orcs-search, rr.cannot (data/rules/entries.json); ledger lines 08122:B:3, 08123:B:3, 08124:A:1, 08125:A:1, 08125:A:2, 08126:A:1, 08126:A:3, 08127:A:1, 08127:A:2.
// The one line a card of Celebrimbor's Secret says about itself in the card preview (ring-maker/preview.ts): the Mould wherever it lies and the card that holds it, Bellach's Threat and immunity, The Orcs' Search's count and The Secret Chamber's cost and risk.
import { flagged, inPlay, livingSeats, type ScenarioState } from "../../../rules/core/state.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { BELLACH, MOULD, ORCS_SEARCH, SECRET_CHAMBER, STAGE_1, STAGE_2, cardsUnderSearch, mouldLyingOn, mouldState } from "../../readouts/ring-maker/celebrimbor.ts";
import { bellachWords, chamberWords, mouldHostWords, mouldWords, searchNote } from "../../words/scenarios/ring-maker/celebrimbor-table.ts";

/** The line of a Celebrimbor's Secret card, or null for any other card. */
export function celebrimborDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.code === MOULD) {
    const held = mouldState(game, ctx);
    return held == null ? null : mouldWords(held.where, held.host != null ? name(held.host) : "");
  }
  const held = mouldLyingOn(game, cardId).length > 0 ? mouldState(game, ctx) : null;
  const lines: string[] = [held != null && held.where !== "free" ? mouldHostWords(held.where, name(cardId)) : ""];
  if (card.code === ORCS_SEARCH) lines.push(searchNote(cardsUnderSearch(game)));
  if (card.code === BELLACH && (card.zone === "staging" || card.zone === "engaged")) {
    const stage = game.questStage ? game.cards[game.questStage] : undefined;
    const number = stage?.code === STAGE_1 ? 1 : stage?.code === STAGE_2 ? 2 : null;
    lines.push(bellachWords(cardsUnderSearch(game), flagged(game, cardId, "immuneToPlayerCards") || flagged(game, cardId, "cannotBeEngaged"), number, stage?.progress ?? 0));
  }
  if (card.code === SECRET_CHAMBER && inPlay(card.zone)) lines.push(chamberWords(livingSeats(game).length, card.damage, printedOf(ctx.cards, card.code).questPoints ?? 0));
  const text = lines.filter((line) => line !== "").join(" ");
  return text === "" ? null : text;
}
