import type { Ask } from "../asks.ts";

// The choice words of the picks the engine asks in passage-through-mirkwood: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario passage-through-mirkwood --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=passage-through-mirkwood` prints each sentence.
// The first player answers for the group at a tie, so those sentences are not owned (the sheet adds who chooses).
export const ASKS: Readonly<Record<string, Ask>> = {
  "900106:whenRevealed:1 @0 PickHighestThreat": { note: "{card}: players are tied for the highest threat. Choose the player who exhausts all their heroes and attaches it to one of them.", verb: "Choose" },
};
