import type { Ask } from "../asks.ts";
import { PELARGIR_CARD_ASKS } from "../pelargir-asks.ts";

// The choice words of Peril in Pelargir (against-the-shadow part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario peril-in-pelargir --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=peril-in-pelargir` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  ...PELARGIR_CARD_ASKS,
  // 05019:A:1 (Alcaron's Scroll, Action): the hero that exhausts is the player's own pick, and the Scroll attaches to it.
  "05019:action:1 @0 Pick": { owned: true, note: "Alcaron's Scroll is in the staging area: choose a hero of yours to exhaust and attach it to.", verb: "Exhaust" },
  // 05037:A:2 (Pickpocket, Shadow): the Scroll is an attachment the player may discard too.
  "05037:shadow:1 @0 Pick": { owned: true, note: "Pickpocket: choose one of your own attachments to discard. Alcaron's Scroll counts if it is on your hero.", verb: "Discard" },
  // 05065:A:1 (stage 1A Setup): the first player chooses the hero that carries the Scroll.
  "05065:setup:1 @1 Pick": { owned: true, note: "Setup: choose the hero that carries Alcaron's Scroll.", verb: "Attach" },
  // 05066:B:3 (stage 2B When Revealed): the enemy with the highest engagement cost, in the staging area or engaged with any player; a tie is the first player's choice.
  "05066:whenRevealed:1 @0 Pick": { owned: true, note: "Choose which enemy in play with the highest engagement cost takes Alcaron's Scroll. The first player breaks a tie.", verb: "Attach" },
  // 05065:B:2 (stage 1B): each player searches the encounter deck for a Harbor Thug.
  "05065:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Choose a Harbor Thug from the encounter deck to add to the staging area.", verb: "Add" },
  // 05067:A:1 (stage 3B): each player searches the encounter deck and discard pile for an enemy.
  "05067:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Choose an enemy from the encounter deck or discard pile to add to the staging area.", verb: "Add" },

  "05041:whenRevealed:1 @0 AttachToHighestThreatCost": { note: "{card}: heroes are tied for the highest threat cost. Choose the hero it attaches to. Each time that hero exhausts, readies or triggers an ability, its controller raises their threat by 1.", verb: "Attach" },
};
