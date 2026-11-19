import type { Ask } from "../asks.ts";

// The choice words of Murder at the Prancing Pony (standalone-scenarios part 7), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario murder-at-the-prancing-pony --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=murder-at-the-prancing-pony` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {};
