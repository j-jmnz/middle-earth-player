import type { Ask } from "../asks.ts";
import { HOBBIT_BILBO_ASKS, HOBBIT_TREASURE_ASKS } from "../hobbit-asks.ts";

// The choice words of The Battle of Five Armies (the-hobbit part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-battle-of-five-armies --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-battle-of-five-armies` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = { ...HOBBIT_BILBO_ASKS, ...HOBBIT_TREASURE_ASKS };
