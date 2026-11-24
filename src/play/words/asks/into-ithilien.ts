import type { Ask } from "../asks.ts";
import { BROODING_FOREST_ASKS } from "../scenarios/against-the-shadow/brooding-forest-asks.ts";

// The choice words of Into Ithilien (against-the-shadow part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario into-ithilien --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=into-ithilien` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // The Brooding Forest cards dealt here (05046, 05048), worded once for both scenarios.
  ...BROODING_FOREST_ASKS,
  // 05050:A:1 (Forest Bat, When Revealed): the first player deals 2 damage to a questing hero, and that hero is removed from the quest.
  "05050:whenRevealed:1 @0 Pick": { owned: true, note: "Forest Bat: choose a questing hero, any player's, to take 2 damage. It is removed from the quest.", verb: "Damage" },
  // 05055:A:2 (Southron Support, When Revealed): each player searches the encounter deck and discard pile for 1 Harad enemy and adds it to the staging area, if able.
  "05055:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Southron Support: choose 1 Harad enemy from the encounter deck or discard pile to add to the staging area. Each player chooses one.", verb: "Add" },
};
