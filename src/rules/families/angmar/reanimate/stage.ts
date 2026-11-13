// Rules: rr.attachment-cards, rr.quest-advancement (data/rules/entries.json); ledger line 10150:B:2.
// A stage that hands its Sorcery cards on: when the quest advances, the Sorcery cards attached to the defeated stage move to the next stage before the old one leaves play and its attachments would be discarded.
import { flagged, updateCards, type ScenarioState } from "../../../core/state.ts";
import { printedOf, type PrintedCard } from "../../../core/printed.ts";
import { attachTo } from "../../../core/zones.ts";

/** The Sorcery cards attached to the stage `fromId` move to the stage `toId` when the stage holds `passesSorcery`; any other stage is left as it is. */
export function passSorcery(state: ScenarioState, fromId: string, toId: string, cards: ReadonlyMap<string, PrintedCard>): ScenarioState {
  const from = state.cards[fromId];
  if (!from || !flagged(state, fromId, "passesSorcery")) return state;
  const moving = from.attachments.filter((id) => state.cards[id] != null && printedOf(cards, state.cards[id].code).traits.includes("Sorcery"));
  if (moving.length === 0) return state;
  let next = updateCards(state, [[fromId, { attachments: from.attachments.filter((id) => !moving.includes(id)) }]]);
  for (const id of moving) next = attachTo(next, id, toId);
  return next;
}
