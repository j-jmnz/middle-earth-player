import type { Ask } from "../asks.ts";

// The choice words of The Dead Marshes (shadows-of-mirkwood part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-dead-marshes --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-dead-marshes` prints each sentence.
// The first player chooses the player who makes the last escape test. The Mere's two picks have a single card each, so no sheet asks them; they carry words for the allowlist.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 02106:B:1 (Forced): the first player chooses the player who makes the escape test that captures Gollum.
  "02106:forced:1 @0 Pick": { owned: true, note: "{card}: choose the player who makes the escape test to capture Gollum, one card dealt for each token on him. Failing resets the quest.", verb: "Choose" },

  // 900802:A:3 (Forced): the Mere is the card whose tokens move, Gollum the one that receives them.
  "900802:forced:1 @1 Pick": { note: "{card}: its resource tokens move to Gollum." },
  "900802:forced:1 @2 Pick": { note: "{card}: Gollum receives every resource token on The Mere of Dead Faces." },
};
