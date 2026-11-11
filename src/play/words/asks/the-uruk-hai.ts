import type { Ask } from "../asks.ts";

// The choice words of The Uruk-hai (the-two-towers part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-uruk-hai --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-uruk-hai` prints each sentence.
const PURSUIT_NOTE = "The pursuit value is {value}. At {pursuitLimit} at the end of the refresh phase, the players lose.";
const PURSUIT_BIND: Ask["bind"] = { value: { pursuit: true } };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 143069:A:1: each player whose Campaign Log names no captive chooses one of their own heroes (the Fellowship's heroes are not offered). The Captive lies under To Isengard! and is rescued only by winning.
  "143069:setup:1 @1.0 Pick": { owned: true, note: "Choose 1 of your heroes, not a Fellowship hero, to be a Captive. You lose control of it, and its text is blank, until the players win.", verb: "Capture" },
  // 143024:A:1: the first player chooses which Captive under To Isengard! Grishnákh holds; it takes 1 damage each quest phase until he leaves play in any way, and then it lies under To Isengard! again.
  "143024:forced:1 @0 Pick": { owned: true, note: "Choose 1 Captive for Grishnákh to hold. It takes 1 damage each quest phase until he leaves play, and then lies under To Isengard! again.", verb: "Hold" },
  // 143025, 143029:A:2, 143030 and 143063: the choice says where the pursuit value stands, and the value at which the players lose, the one To Isengard!'s record gives the table (`pursuitLimit`, 143022:A:2).
  "143025:whenRevealed:1 @0 Choose": { note: PURSUIT_NOTE, bind: PURSUIT_BIND },
  "143029:shadow:1 @0 Choose": { note: PURSUIT_NOTE, bind: PURSUIT_BIND },
  "143030:whenRevealed:1 @0 Choose": { note: `${PURSUIT_NOTE} This effect cannot be canceled.`, bind: PURSUIT_BIND },
  "143063:whenRevealed:1 @0 Choose": { note: PURSUIT_NOTE, bind: PURSUIT_BIND },
  // 143030:A:1 and 143063:A:2: the branches name what they do to the table, with the number the card prints.
  "143030:whenRevealed:1 @0 damage": { label: "Deal 1 damage to each character committed to the quest" },
  "143063:whenRevealed:1 @0 damage": { label: "Assign 3 damage among the characters you control" },
};
