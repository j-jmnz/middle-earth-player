import type { Ask } from "../asks.ts";

// The choice words of Escape from Umbar (haradrim part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario escape-from-umbar --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=escape-from-umbar` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {};
