import type { Ask } from "../asks.ts";

// The choice words of Into Ithilien (against-the-shadow part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario into-ithilien --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=into-ithilien` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 05046:A:1 (Overgrown Trail, Action): the player exhausts a ready Ranger character he controls; an ally objective no player controls cannot pay. The Trail then gets 3 progress tokens.
  "05046:action:1 @0 Pick": { owned: true, note: "Overgrown Trail: choose a ready Ranger character you control to exhaust. Overgrown Trail gets 3 progress tokens.", verb: "Exhaust" },
  // 05048:A:1 (Lost Companion, When Revealed, step 1): each player in turn removes 1 character he controls from the quest, if able.
  "05048:whenRevealed:1 @0.0 Pick": { owned: true, note: "Lost Companion: choose 1 character you control that is committed to the quest, to remove from the quest.", verb: "Remove" },
  // 05050:A:1 (Forest Bat, When Revealed): the first player deals 2 damage to a questing hero, and that hero is removed from the quest.
  "05050:whenRevealed:1 @0 Pick": { owned: true, note: "Forest Bat: choose a questing hero, any player's, to take 2 damage. It is removed from the quest.", verb: "Damage" },
  // 05055:A:2 (Southron Support, When Revealed): each player searches the encounter deck and discard pile for 1 Harad enemy and adds it to the staging area, if able.
  "05055:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Southron Support: choose 1 Harad enemy from the encounter deck or discard pile to add to the staging area. Each player chooses one.", verb: "Add" },
};
