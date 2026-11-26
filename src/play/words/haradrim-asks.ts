// Rules: rr.optional-engagement, hrd.orcs-area (data/rules/entries.json); ledger line 16061:A:3.
// The choice words of the Haradrim card that two scenarios deal (Race Across Harad and The Long Arm of Mordor): a game reads only its own scenario's asks file, so each spreads these into its own (pelargir-asks.ts does the same).
import type { Ask } from "./asks.ts";

export const URUK_CHIEFTAIN_ASKS: Readonly<Record<string, Ask>> = {
  // 16061:A:3 (Uruk Chieftain): at the end of the encounter phase it engages the player engaged with the most non-unique Orc enemies; the first player picks among tied players.
  "16061:forced:1 @0 EngageSeatWithMost": {
    owned: true,
    note: "Uruk Chieftain: choose which tied player it engages, the one engaged with the most non-unique Orc enemies. It attacks that player at once.",
    verb: "Engage",
    labels: { "seat:0": "Player 1", "seat:1": "Player 2", "seat:2": "Player 3", "seat:3": "Player 4" },
  },
};
