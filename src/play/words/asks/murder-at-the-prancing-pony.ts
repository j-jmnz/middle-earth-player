import type { Ask } from "../asks.ts";

// The choice words of Murder at the Prancing Pony (standalone-scenarios part 7), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario murder-at-the-prancing-pony --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=murder-at-the-prancing-pony` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 50715:A:1 (The Prancing Pony): the first player looks at the top 2 cards of the Investigation deck, or each player draws 2 cards.
  "50715:forced:1 @0 look": { label: "Look at the top 2 cards of the Investigation deck" },

  // 50719:A:2 (Old Warehouse): the Investigate keyword looks at 2 more cards, or each player lowers threat by 3.
  "50719:forced:2 @0 look": { label: "Look at 2 additional cards of the Investigation deck this phase" },

  // 50726:A:2 (Hired Muscle): the Brigand enemy it attaches to, which returns to the staging area.
  "50726:whenRevealed:1 @0 Pick": { note: "Hired Muscle: choose a Brigand enemy. Hired Muscle is attached to it and it returns to the staging area.", verb: "Attach" },

  // 50728:A:1 and A:2 (Rising Body Count).
  "50728:whenRevealed:1 @0 shuffle": { label: "Shuffle Rising Body Count into the Investigation deck" },
  "50728:shadow:1 @0 threat": { label: "Raise your threat by 2 if this attack destroys a character" },
  "50728:shadow:1 @0 shuffle": { label: "Shuffle Rising Body Count into the Investigation deck if this attack destroys a character" },

  "50702:forced:2 @0.accuse.0 NameInvestigation": { note: "{card}: make the accusation. Name 1 of the 5 Suspect enemies, then 1 of the 5 Hideout locations.", verb: "Name" },
  "50702:forced:2 @0.accuse.1 NameInvestigation": { note: "{card}: name 1 of the 5 Hideout locations. If either name is wrong, each player raises their threat by 3.", verb: "Name" },
};
