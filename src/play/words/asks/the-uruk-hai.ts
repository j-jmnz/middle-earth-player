import type { Ask } from "../asks.ts";

// The choice words of The Uruk-hai (the-two-towers part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test:scenario the-uruk-hai --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-uruk-hai` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 143069:A:1: each player whose Campaign Log names no captive chooses one of their own heroes (the Fellowship's heroes are not offered). The Captive lies under To Isengard! and is rescued only by winning.
  "143069:setup:1 @1.0 Pick": { owned: true, note: "Choose 1 of your heroes, not a Fellowship hero, to be a Captive. It lies faceup under To Isengard! until it is rescued.", verb: "Capture" },
  // 143024:A:1: the first player chooses which Captive under To Isengard! Grishnákh holds; it takes 1 damage each quest phase until he is defeated.
  "143024:forced:1 @0 Pick": { owned: true, note: "Choose 1 Captive for Grishnákh to hold. It takes 1 damage each quest phase until he is defeated.", verb: "Hold" },
  // 143030:A:1 and 143063:A:2: the branches name what they do to the table, with the number the card prints.
  "143030:whenRevealed:1 @0 damage": { label: "Deal 1 damage to each character committed to the quest. This cannot be canceled." },
  "143063:whenRevealed:1 @0 damage": { label: "Assign 3 damage among the characters you control" },
};
