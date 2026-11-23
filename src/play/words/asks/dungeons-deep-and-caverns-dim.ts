import type { Ask } from "../asks.ts";

// The choice words of Dungeons Deep and Caverns Dim (the-hobbit part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario dungeons-deep-and-caverns-dim --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=dungeons-deep-and-caverns-dim` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 131070:A:1 (Grip, Grab! Pinch, Nab!, When Revealed, a Misty Mountain Goblins card): each player in turn chooses a Goblin enemy from the encounter discard pile to add to the staging area.
  "131070:whenRevealed:1 @0.0 Pick": { owned: true, note: "Grip, Grab! Pinch, Nab!: choose a Goblin enemy from the encounter discard pile to add to the staging area.", verb: "Add" },
};
