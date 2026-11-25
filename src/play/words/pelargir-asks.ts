// Rules: rr.optional-engagement, rr.search, rr.player-elimination (data/rules/entries.json); ledger lines 05037:A:1, 05037:A:2, 05039:A:2, 05040:A:1, 05044:A:2.
// The choice words of the Peril in Pelargir cards that two scenarios deal (Peril in Pelargir and The Steward's Fear): a game reads only its own scenario's asks file, so each of them spreads these into its own, as the Campaign Pool's boons are (pool-boon-asks.ts).
// A sentence that holds in one of them only (the Alcaron's Scroll of Peril in Pelargir) stays in that file.
import type { Ask } from "./asks.ts";

export const PELARGIR_CARD_ASKS: Readonly<Record<string, Ask>> = {
  // 05037:A:1 (Pickpocket): the defending player picks the hero whose pool loses 1 resource.
  "05037:forced:1 @0 Pick": { owned: true, note: "Pickpocket: choose a hero you control that has resources, to discard 1 resource from its pool.", verb: "Discard" },
  // 05037:A:2 (Pickpocket, Shadow): the defending player picks one of his own attachments.
  "05037:shadow:1 @0 Pick": { owned: true, note: "Pickpocket: choose one of your own attachments to discard.", verb: "Discard" },
  // 05044:A:2 (Umbar Assassin): the player it engages chooses the hero that takes 3 damage when he chose the engagement, else the hero that is discarded.
  "05044:forced:1 @0 Pick": {
    owned: true,
    note: [
      { when: { kind: "flag", stat: "engagedOptionally", holder: "self" }, text: "Umbar Assassin: choose a hero you control to take 3 damage. A hero that cannot survive it is destroyed." },
      { text: "Umbar Assassin engaged you by the engagement check: choose a hero you control to discard." },
    ],
  },
  // 05039:A:2 (Market Square, Travel): each player pays 1 resource from one hero's pool.
  "05039:travel:1 @0.0 SpendResources": { owned: true, note: "Market Square: choose the hero whose pool pays 1 resource to travel here. Each player pays one.", verb: "Pay" },
  // 05040:A:1 (Lost in the City): each player searches the encounter deck and discard pile for a City location.
  "05040:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Lost in the City: choose a City location from the encounter deck or discard pile to add to the staging area.", verb: "Add" },
};
