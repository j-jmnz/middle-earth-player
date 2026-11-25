// Rules: rr.the-word-choose (data/rules/entries.json); ledger lines 05046:A:1, 05048:A:1.
// The choice words of the Brooding Forest cards that two scenarios deal (Into Ithilien and The Drúadan Forest): a game reads only its own scenario's asks file, so each of them spreads these into its own, as pelargir-asks.ts does for the Peril in Pelargir cards.
import type { Ask } from "../../asks.ts";

export const BROODING_FOREST_ASKS: Readonly<Record<string, Ask>> = {
  // 05046:A:1 (Overgrown Trail, Action): the player exhausts a ready Ranger character he controls; an ally objective no player controls cannot pay. The Trail then gets 3 progress tokens.
  "05046:action:1 @0 Pick": { owned: true, note: "Overgrown Trail: choose a ready Ranger character you control to exhaust. Overgrown Trail gets 3 progress tokens.", verb: "Exhaust" },
  // 05048:A:1 (Lost Companion, When Revealed, step 1): each player in turn removes 1 character he controls from the quest, if able.
  "05048:whenRevealed:1 @0.0 Pick": { owned: true, note: "Lost Companion: choose 1 character you control that is committed to the quest, to remove from the quest.", verb: "Remove" },
};
