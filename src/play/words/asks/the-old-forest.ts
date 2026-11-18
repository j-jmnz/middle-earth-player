import type { Ask } from "../asks.ts";

// The choice words of The Old Forest (standalone-scenarios part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-old-forest --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-old-forest` prints each sentence.
// Each player answers for himself in turn from the first player, so the sentences are owned; the revealing player answers Swaying Without Wind and Song of Sleep, the first player Tom Bombadil's.
const SEARCH = "Choose a location from the encounter deck or discard pile to add to the staging area.";

export const ASKS: Readonly<Record<string, Ask>> = {
  // 147001:A:1 (Farewell to the Shire): each player in turn searches for a location with a title different from those already found.
  "147001:setup:1 @0.0 SearchMove": { owned: true, note: "Farewell to the Shire: choose a location with a different title from the others found, from the encounter deck or discard pile. It is added to the staging area.", verb: "Add" },

  // 147002:A:1 to 147005:A:1 (The Living Forest): with fewer locations in the staging area than players, one location is searched for.
  "147002:whenRevealed:1 @0 SearchMove": { owned: true, note: `The Living Forest: ${SEARCH}`, verb: "Add" },
  "147003:whenRevealed:1 @0 SearchMove": { owned: true, note: `The Living Forest: ${SEARCH}`, verb: "Add" },
  "147004:whenRevealed:1 @0 SearchMove": { owned: true, note: `The Living Forest: ${SEARCH}`, verb: "Add" },
  "147005:whenRevealed:1 @0 SearchMove": { owned: true, note: `The Living Forest: ${SEARCH}`, verb: "Add" },

  // 147002:B:1 (The Living Forest): at the end of the planning phase each player exhausts a hero he controls.
  "147002:forced:1 @0.0 Pick": { owned: true, note: "The Living Forest: choose a ready hero you control to exhaust.", verb: "Exhaust" },

  // 147010:A:2 and A:3 (Army of Flies): the engaged or defending player discards a non-objective attachment he controls.
  "147010:forced:1 @0 Pick": { owned: true, note: "Army of Flies: choose a non-objective attachment you control to discard.", verb: "Discard" },
  "147010:shadow:1 @0 Pick": { owned: true, note: "Army of Flies: choose a non-objective attachment you control to discard.", verb: "Discard" },

  // 147017:A:2 (Swaying Without Wind): the revealing player chooses a location in the victory display and returns it to the staging area.
  "147017:whenRevealed:1 @0 Pick": { owned: true, note: "Swaying Without Wind: choose a location in the victory display. It returns to the staging area and its Victory points leave the display.", verb: "Return" },

  // 147018:A:1 (Falling Branches): each player removes a committed character he controls from the quest and deals it 2 damage (3 to an ally).
  "147018:whenRevealed:1 @0.0 Pick": { owned: true, note: "Falling Branches: choose a character you control that is committed to the quest. It is removed from the quest and takes 2 damage, 3 if it is an ally.", verb: "Remove" },

  // 147019:A:2 (Song of Sleep): the revealing player attaches it to a questing hero he controls, removing it from the quest.
  "147019:whenRevealed:1 @0 Pick": { owned: true, note: "Song of Sleep: choose a questing hero you control without a Song of Sleep. It is removed from the quest and cannot ready.", verb: "Attach" },

  // 147022:A:1 (Tom Bombadil): the first player chooses a player, who takes control of Tom Bombadil, committed to the quest, until the end of the round.
  "147022:whenRevealed:1 @0 Pick": { owned: true, note: "Tom Bombadil: choose the player who takes control of him, committed to the quest. He is discarded at the end of the round.", verb: "Give" },
};
