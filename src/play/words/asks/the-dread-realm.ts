import type { Ask } from "../asks.ts";

// The choice words of The Dread Realm (angmar-awakened part 9), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-dread-realm --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-dread-realm` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {};
