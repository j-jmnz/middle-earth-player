// Rules: rm.current-trial, rr.objective-cards, rr.attachment-cards, rr.travel, rr.cost (data/rules/entries.json); ledger lines 08036:B:2, 08043:A:1, 08043:A:2, 08049:A:2, 08049:A:3.
// The one line a card of The Three Trials says about itself in the card preview (dungeon-preview.ts): a Key on its Guardian, Barrow or hero, the current trial's Key, and Hallowed Circle's Travel cost with the ready Keys the players hold. The engine decided each; nothing here changes one. Pure.
import { isExhausted, type ScenarioState } from "../../../rules/core/state.ts";
import { HALLOWED_AFTER, hallowedCostWords, keyHostWords } from "../../words/scenarios/ring-maker/trials-table.ts";
import { HALLOWED_CIRCLE, KEYS, keysLyingOn } from "../../readouts/ring-maker/trials.ts";

/** The Keys a hero holds that are ready: the cost of Hallowed Circle's Travel (08049:A:2) is paid from these. */
function readyKeys(game: ScenarioState): number {
  return Object.values(game.cards).filter((card) => KEYS.includes(card.code) && card.zone === "attached" && card.host != null && game.cards[card.host]?.zone === "heroes" && !isExhausted(card)).length;
}

export function trialsDetail(game: ScenarioState, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card || game.scenarioId !== "the-three-trials") return null;
  if (card.code === HALLOWED_CIRCLE) return `${hallowedCostWords(readyKeys(game))} ${HALLOWED_AFTER}`;
  const host = KEYS.includes(card.code) && card.zone === "attached" && card.host != null ? game.cards[card.host] : undefined;
  if (host) return keyHostWords(name(host.id), name(card.id), host.zone === "heroes");
  const held = keysLyingOn(game, cardId);
  const first = held[0];
  return first == null ? null : keyHostWords(name(cardId), name(first), game.cards[cardId]?.zone === "heroes");
}
