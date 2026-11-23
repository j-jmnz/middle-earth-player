import type { Ask } from "../asks.ts";
import { MISTY_MOUNTAIN_GOBLINS_ASKS } from "../misty-mountain-goblins-asks.ts";

// The choice words of Over the Misty Mountains Grim (the-hobbit part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario over-the-misty-mountains-grim --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=over-the-misty-mountains-grim` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 131026:B:1 (A Short Rest): each player may search his deck for 1 treasure card and add it to his hand, then shuffle it (the shuffle is in the search option, so a declined search leaves the deck as it is).
  "131026:whenRevealed:1 @0.0 Choose": { owned: true, note: "A Short Rest: search your deck for 1 treasure card to add to your hand, or do not search." },
  "131026:whenRevealed:1 @0.0 search": { label: "Search your deck for a treasure card, add it to your hand, then shuffle your deck" },
  "131026:whenRevealed:1 @0.0 decline": { label: "Do not search your deck" },
  "131026:whenRevealed:1 @0.0.search.0 Pick": { owned: true, note: "A Short Rest: choose 1 treasure card from your deck to add to your hand. Your deck is shuffled after.", verb: "Add" },

  // 131028:B:2 (Down, Down to Goblin Town): Bilbo Baggins may spend X resources from his pool to reduce the encounter cards revealed by X, to a minimum of 1. The first player (Bilbo's controller) chooses X and pays.
  "131028:whenRevealed:2 @0 ChooseX": {
    owned: true,
    bind: { pool: { stat: "resources", ofNamed: "Bilbo Baggins" } },
    note: "Choose X, from 0 to {pool}, the resources in Bilbo Baggins' pool. Bilbo spends X of them.",
    xRows: { label: "Spend {x}: reveal {reveals}", less: { name: "reveals", of: { players: true, times: 3 }, min: 1, unit: "card" } },
  },
  "131028:whenRevealed:2 @1 Pick": { owned: true, note: "Down, Down to Goblin Town: Bilbo Baggins' pool pays the X resources.", verb: "Pay" },

  // 131064:A:2 (Stone-Giant): after it engages a player, that player chooses and discards an ally he controls.
  "131064:forced:1 @0 Pick": { owned: true, why: "it engaged you.", note: "Choose an ally you control to discard.", verb: "Discard" },

  // 131067:A:1 (Great Cavern Room): while active, after a player engages a Goblin enemy, he deals 1 damage to a character he controls.
  "131067:forced:1 @0 Pick": { owned: true, why: "you engaged a Goblin enemy.", note: "Choose a character you control to take 1 damage.", verb: "Damage" },

  // 131072:A:1 (Galloping Boulders): the first player chooses a character committed to a quest; it takes 3 damage and is removed from the quest.
  "131072:whenRevealed:1 @0 Pick": { owned: true, note: "{card}: choose a character committed to the quest. It takes 3 damage and is removed from the quest.", verb: "Choose" },

  // 131070:A:1 (Grip, Grab! Pinch, Nab!): starting with the first player, each player chooses 1 Goblin enemy from the encounter discard pile and adds it to the staging area.
  "131070:whenRevealed:1 @0.0 Pick": { owned: true, note: "Grip, Grab! Pinch, Nab!: choose a Goblin enemy from the encounter discard pile to add to the staging area.", verb: "Add" },

  // 131073:A:1 (Guffawing of Giants): the first player chooses a Stone-giant in the staging area; at the end of the quest phase it engages the player with the highest threat (the first player breaks a tie, rr.first-player).
  "131073:whenRevealed:1 @0 Pick": { owned: true, note: "Guffawing of Giants: choose a Stone-giant in the staging area. At the end of the quest phase it engages the player with the highest threat.", verb: "Choose" },
  "131073:whenRevealed:1 @1.0 Pick": { owned: true, note: "Guffawing of Giants: players are tied for the highest threat. As first player, choose the one the Stone-giant engages.", verb: "Engage" },

  ...MISTY_MOUNTAIN_GOBLINS_ASKS,
};
