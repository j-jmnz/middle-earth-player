// Rules: rr.in-play-and-out-of-play, rr.encounter-deck (data/rules/entries.json); ledger line 50601:A:1. The Ruins of Belegost's Setup: one of the five other Loot objectives, picked by the game's seed, lies facedown under Stalking the Ruins (out of play, as any card under another is); the other four go into the encounter deck unseen.
import type { Instruction } from "../../../catalog/boundary.ts";

import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

/** HideRandomLoot: of the set-aside cards with these codes (in id order, so one seed always picks the same card) one goes facedown under the card in play with the code `under`, the rest into the encounter deck facedown; the record's next ShuffleEncounterDeck mixes them in. */
export function hideRandomLoot(state: ScenarioState, instruction: Extract<Instruction, { verb: "HideRandomLoot" }>): ScenarioState {
  const host = Object.values(state.cards).find((card) => card.code === instruction.under && inPlay(card.zone));
  const set = state.setAside.filter((id) => instruction.codes.includes(state.cards[id]?.code ?? "")).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (!host || set.length === 0) return state;
  const rolled = shuffleIds(set, state.seed, state.seedCursor);
  const hidden = rolled.ids[0];
  let next: ScenarioState = { ...state, seedCursor: rolled.cursor };
  for (const id of set) {
    next = id === hidden ? updateCard(moveCard(next, id, { zone: "under", locationId: host.id }), id, { face: "down", controller: null }) : updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down" });
  }
  return next;
}
