import type { Ask } from "../asks.ts";

// The choice words of The Tower of Cirith Ungol (the-return-of-the-king part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-tower-of-cirith-ungol --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-tower-of-cirith-ungol` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {};
