import type { Ask } from "../asks.ts";

// The choice words of Peril in Pelargir (against-the-shadow part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario peril-in-pelargir --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=peril-in-pelargir` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 05019:A:1 (Alcaron's Scroll, Action): the hero that exhausts is the player's own pick, and the Scroll attaches to it.
  "05019:action:1 @0 Pick": { owned: true, note: "Alcaron's Scroll is in the staging area: choose a hero of yours to exhaust and attach it to.", verb: "Exhaust" },
  // 05037:A:1 (Pickpocket): the defending player picks the hero whose pool loses 1 resource.
  "05037:forced:1 @0 Pick": { owned: true, note: "Pickpocket: choose a hero you control that has resources, to discard 1 resource from its pool.", verb: "Discard" },
  // 05037:A:2 (Pickpocket, Shadow): the defending player picks one of his own attachments.
  "05037:shadow:1 @0 Pick": { owned: true, note: "Pickpocket: choose one of your own attachments to discard. Alcaron's Scroll counts if it is on your hero.", verb: "Discard" },
  // 05044:A:2 (Umbar Assassin): the player it engages chooses the hero that takes 3 damage when he chose the engagement, else the hero that is discarded.
  "05044:forced:1 @0 Pick": {
    owned: true,
    note: [
      { when: { kind: "flag", stat: "engagedOptionally", holder: "self" }, text: "Umbar Assassin: choose a hero you control to take 3 damage. A hero that cannot survive it is destroyed." },
      { text: "Umbar Assassin engaged you by the engagement check: choose a hero you control to discard." },
    ],
  },
  // 05065:A:1 (stage 1A Setup): the first player chooses the hero that carries the Scroll.
  "05065:setup:1 @1 Pick": { owned: true, note: "Setup: choose the hero that carries Alcaron's Scroll.", verb: "Attach" },
  // 05066:B:3 (stage 2B When Revealed): the enemy with the highest engagement cost, in the staging area or engaged with any player; a tie is the first player's choice.
  "05066:whenRevealed:1 @0 Pick": { owned: true, note: "Choose which enemy in play with the highest engagement cost takes Alcaron's Scroll. The first player breaks a tie.", verb: "Attach" },
  // 05039:A:2 (Market Square, Travel): each player pays 1 resource from one hero's pool.
  "05039:travel:1 @0.0 SpendResources": { owned: true, note: "Market Square: choose whose pool pays 1 resource to travel here. Each player pays one.", verb: "Pay" },
  // 05040:A:1 (Lost in the City): each player searches the encounter deck and discard pile for a City location.
  "05040:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Lost in the City: choose a City location from the encounter deck or discard pile to add to the staging area.", verb: "Add" },
  // 05065:B:2 (stage 1B): each player searches the encounter deck for a Harbor Thug.
  "05065:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Choose a Harbor Thug from the encounter deck to add to the staging area.", verb: "Add" },
  // 05067:A:1 (stage 3B): each player searches the encounter deck and discard pile for an enemy.
  "05067:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Choose an enemy from the encounter deck or discard pile to add to the staging area.", verb: "Add" },
};
