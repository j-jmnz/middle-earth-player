// Rules: rr.guarded (data/rules/entries.json). What is attached to a card for the cards that count or ask for its attachments: its
// attachments, and the loot The Burglar's Turn (22024) set under it as a guarded objective.
import type { ScenarioState } from "./state.ts";

// The loot cards guarding each card (The Burglar's Turn, families/sidequests/loot.ts): under it and still their player's (a card
// under Weather Hills has no controller). Read once for a state, which is never changed; only a game that dealt a loot deck has any.
const LOOT = new WeakMap<ScenarioState, ReadonlyMap<string, string[]>>();
const NO_LOOT: string[] = [];

export function lootUnder(state: ScenarioState, hostId: string): readonly string[] {
  if (!state.lootDecks) return NO_LOOT;
  let byHost = LOOT.get(state);
  if (!byHost) {
    const built = new Map<string, string[]>();
    for (const card of Object.values(state.cards)) {
      if (card.zone !== "under" || card.host == null || card.controller == null) continue;
      const ids = built.get(card.host);
      if (ids) ids.push(card.id);
      else built.set(card.host, [card.id]);
    }
    byHost = built;
    LOOT.set(state, byHost);
  }
  return byHost.get(hostId) ?? NO_LOOT;
}

// The attachments on this card: its attachments, and the loot guarding it. The contract calls its loot an attachment attached to the
// location ("+1 quest point for each attachment attached to it", "each guarded attachment on that location", 22024:B:1, B:3), so every
// count of a location's attachments reads this list (Forest Road Traveler 19059:A:1, Mirkwood Hunter 19087:A:2, Haldan 19026:A:1 and
// A:2, South Away! 19034:A:1).
export function attachmentsOn(state: ScenarioState, hostId: string): readonly string[] {
  const attachments = state.cards[hostId]?.attachments ?? [];
  const loot = lootUnder(state, hostId);
  return loot.length > 0 ? [...attachments, ...loot] : attachments;
}
