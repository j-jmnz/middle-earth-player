import type { Ask } from "../asks.ts";

// The choice words of the picks the engine asks in the-city-of-corsairs: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-city-of-corsairs --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-city-of-corsairs` prints each sentence.
// The first player answers for the group at a tie, so those sentences are not owned (the sheet adds who chooses).
export const ASKS: Readonly<Record<string, Ask>> = {
  "11214:whenRevealed:1 @1 TakeCardFromCollection": { note: "{card}: take Gandalf (Core Set) from the players' collections and put him into play under any player's control, ignoring uniqueness.", verb: "Take" },
};
