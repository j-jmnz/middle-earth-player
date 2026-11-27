// Rules: rr.player-elimination, rr.ownership-and-control, hrd.captives-of-cirith-gurat (data/rules/entries.json). The values an asks file's templates read about the characters a choice captures and the cards it discards (src/play/words/asks.ts, askValues): whose the
// picked character is, what it costs, which encounter card was just discarded and its Threat, and which players a raise would eliminate. Each is read from the state, named only where an entry's template says it. Pure.
import { eliminationLevel } from "../../rules/core/eliminate.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { livingSeats, type ScenarioState } from "../../rules/core/state.ts";
import { seatThreat } from "../../rules/families/play/hooks.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";

import type { ChoiceNames } from "./choice.ts";

type Values = Record<string, string | number | undefined>;

/** "Player 2's" two-handed, "your" alone: whose a card is (its owner, else the seat that controls it, else `seat`). */
export function whoseWords(game: ScenarioState, cardId: string, seat: number): string {
  const card = game.cards[cardId];
  const owner = card?.owner ?? card?.controller ?? seat;
  return game.seatCount > 1 ? `Player ${owner + 1}'s` : "your";
}

/** The values about one card a choice is about: `whose` ("Player 1's", "your") and `pickedCost` (its printed cost, 0 with none). */
export function pickedValues(game: ScenarioState, ctx: ReduceContext, cardId: string, seat: number): Values {
  const code = game.cards[cardId]?.code ?? "";
  return { whose: whoseWords(game, cardId, seat), pickedCost: printedOf(ctx.cards, code).cost ?? 0 };
}

/**
 * `discarded` ("Captured! has no Threat", "Gate of Iron has Threat 2") and `threat` (its number, 0 with none): the encounter card last discarded, which a Travel cost reads. `eliminated` ("you", "Player 1", "Player 1 and Player 2"): the living players
 * whose threat plus `raise` reaches their elimination level, "nobody" with none. Only the names `wanted` says are worked out.
 */
export function discardValues(game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, wanted: (name: string) => boolean, raise: number): Values {
  const out: Values = {};
  if (wanted("discarded") || wanted("threat")) {
    const top = game.encounterDiscard.at(-1);
    const threat = top ? printedOf(ctx.cards, game.cards[top]?.code ?? "").threat : undefined;
    out.threat = threat ?? 0;
    out.discarded = top ? `${names.card(top)} has ${threat == null ? "no Threat" : `Threat ${threat}`}` : "No card was discarded";
  }
  if (wanted("eliminated")) {
    const seats = livingSeats(game).filter((seat) => seatThreat(game, seat) + raise >= eliminationLevel(game, seat));
    out.eliminated = seats.length === 0 ? "nobody" : game.seatCount > 1 ? seats.map((seat) => `Player ${seat + 1}`).join(" and ") : "you";
  }
  return out;
}
