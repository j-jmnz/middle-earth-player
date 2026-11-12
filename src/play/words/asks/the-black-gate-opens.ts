import type { Ask } from "../asks.ts";

// The choice words of The Black Gate Opens (the-return-of-the-king part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-black-gate-opens --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-black-gate-opens` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {};
