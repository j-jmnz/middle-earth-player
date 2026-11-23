import type { Ask } from "../asks.ts";
import { HOBBIT_BILBO_ASKS } from "../hobbit-asks.ts";

// The choice words of Flies and Spiders (the-hobbit part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario flies-and-spiders --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=flies-and-spiders` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = { ...HOBBIT_BILBO_ASKS };
