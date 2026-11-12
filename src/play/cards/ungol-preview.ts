// Rules: rr.guarded, rr.ownership-and-control, mec113.the-one-ring, mec113.setup-the-tower-of-cirith-ungol (data/rules/entries.json); ledger lines 146014:A:1, 146066:A:1, 146067:B:2, 146069:B:1, 146069:B:2.
// What the card preview (table-preview.ts) says of The Tower of Cirith Ungol's held cards: the Ring-bearer under Topmost Chamber, the boons Shagrat guards with their owners, and the hero that carries Last of the Company. The engine decided each; this only says it.
import type { ScenarioState } from "../../rules/engine/reduce.ts";

import { guardedBoons } from "../readouts/ungol.ts";
import { captiveWords, chamberHoldsWords, guardedBoonWords, guardsWords, lastOfTheCompanyWords, ownerWords } from "../words/scenarios/ungol.ts";

const CHAMBER = "146015";
const SHAGRAT = "146020";
const LAST_OF_THE_COMPANY = "146014";

/** The muted line under a card's name in this scenario, or null: the Ring-bearer a guard holds, the boons Shagrat guards (each with its owner) and the hero that carries Last of the Company. */
export function ungolDetail(game: ScenarioState, card: ScenarioState["cards"][string], name: (id: string) => string): string | null {
  if (game.scenarioId !== "the-tower-of-cirith-ungol") return null;
  if (card.zone === "captive" && card.guardedHero === true && card.host != null) return captiveWords(name(card.host));
  if (card.code === CHAMBER) {
    const held = Object.values(game.cards).find((other) => other.zone === "captive" && other.host === card.id);
    return held ? chamberHoldsWords(name(held.id), ownerWords(game.seatCount, held.owner), name(card.id)) : null;
  }
  if (card.code === SHAGRAT) {
    const boons = guardedBoons(game, (boon) => name(boon.id));
    return boons.length > 0 ? guardsWords(boons) : null;
  }
  if (card.held === true && card.host != null && game.cards[card.host]?.code === SHAGRAT) return guardedBoonWords(ownerWords(game.seatCount, card.owner), name(card.host));
  if (card.code === LAST_OF_THE_COMPANY && card.host != null) return lastOfTheCompanyWords(name(card.host));
  return null;
}
