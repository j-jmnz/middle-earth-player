import type { Ask } from "../asks.ts";

// The choice words of The Battle of the Pelennor Fields (the-return-of-the-king part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-battle-of-the-pelennor-fields --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-battle-of-the-pelennor-fields` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {};
