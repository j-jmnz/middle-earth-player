import type { Ask } from "../asks.ts";

// The choice words of the picks the engine asks in the-caves-of-nibin-dum: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-caves-of-nibin-dum --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-caves-of-nibin-dum` prints each sentence.
// The first player answers for the group at a tie, so those sentences are not owned (the sheet adds who chooses).
export const ASKS: Readonly<Record<string, Ask>> = {
  "41049:action:1 @5 ArrangeTop": { owned: true, note: "{card}: choose the card to put back on top of your deck next. You looked at 4 cards and added 1 to your hand; the rest return in the order you choose.", verb: "Place" },
};
