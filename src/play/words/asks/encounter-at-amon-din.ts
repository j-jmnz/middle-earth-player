import type { Ask } from "../asks.ts";

// The choice words of Encounter at Amon Dîn (against-the-shadow part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario encounter-at-amon-din --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=encounter-at-amon-din` prints each sentence.
// A villager token is placed, moved or discarded, never a resource, progress or damage (ats.villagers). The Ravaging Orcs cards dealt here (05062 to 05064) have no Pick or Choose.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 06070:A:2 (Lord Alcaron, Response): after a villager token is discarded, exhaust him to place that token on a location, in the staging area or active. His controller, the first player, decides.
  "06070:response:1 @0 Pick": { owned: true, note: "Lord Alcaron: choose a location, in the staging area or active, to place the discarded villager token on. Lord Alcaron exhausts.", verb: "Place" },
  // 06074:A:1 (Craven Eagle, When Revealed): the character with the fewest remaining hit points is discarded; when characters tie, the first player picks which. Its controller may discard 3 cards at random from his hand to prevent it, and needs 3 cards in hand.
  "06074:whenRevealed:1 @0 PickFewestHitPointsLeft": { note: "Craven Eagle: characters are tied for the fewest remaining hit points. Choose the one that is discarded.", verb: "Discard" },
  "06074:whenRevealed:1 @1 Choose": { owned: true, note: "Craven Eagle: {picked} has the fewest remaining hit points and is discarded. Discard 3 cards at random from your hand to prevent this." },
  "06074:whenRevealed:1 @1 prevent": { label: "Discard 3 cards at random from your hand: {picked} stays in play" },
  "06074:whenRevealed:1 @1 allow": { label: "Do not discard: {picked} is discarded" },
  // 06080:A:1 (Panicked!, When Revealed): each player in turn takes a villager token from Rescued Villagers and places it on a location in the staging area, if able.
  "06080:whenRevealed:1 @0.0 Pick": { owned: true, note: "Panicked!: choose a location in the staging area to move 1 villager token from Rescued Villagers to. Each player moves one.", verb: "Move" },
};
