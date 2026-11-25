import type { Ask } from "../asks.ts";

// The choice words of Escape from Umbar (haradrim part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario escape-from-umbar --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=escape-from-umbar` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 16016:A:1 (Narrow Alleyway): the first player chooses a non-unique enemy engaged with any player; it lies faceup under the location, out of play, until the location leaves play.
  "16016:response:1 @0 Pick": { note: "Narrow Alleyway: choose a non-unique enemy engaged with any player. It lies faceup under Narrow Alleyway, out of play, and returns engaged with the first player when Narrow Alleyway leaves play.", verb: "Place" },

  // 16042:A:2 (Southron Soldier Shadow): the first player chooses a non-unique enemy in the staging area; it engages the first player and is dealt a shadow card.
  "16042:shadow:1 @0 Pick": { note: "Southron Soldier: choose a non-unique enemy in the staging area. It engages the first player, then is dealt a shadow card.", verb: "Engage" },

  // The main quest is the one that loses progress (16015:A:2, 16021:A:1, 16042:A:1, 16043:A:2), though a side quest may be the current quest.
  "16015:forced:1 @0 progress": { label: "Remove 1 progress token from the main quest" },
  "16021:whenRevealed:1 @0 remove": { label: "Remove all progress tokens from the main quest" },
  "16021:whenRevealed:1 @0 damage": { label: "Assign {x} damage among characters in play ({x}, the progress tokens on the main quest)", bind: { x: { stat: "progress", of: "questStage" } } },
  // 16046:A:1 (Injured Companion): each player raises his own threat by 1 for each character he controls.
  "16046:whenRevealed:1 @0.0 threat": { label: "Raise your threat by {x} (1 for each character you control)", bind: { x: { count: { type: "character", control: "you" } } } },
  "16042:forced:1 @0 progress": { label: "Remove 2 progress tokens from the main quest" },
  "16043:forced:1 @0 progress": { label: "Remove 2 progress tokens from the main quest" },
};
