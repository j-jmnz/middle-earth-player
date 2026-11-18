import type { Ask } from "../asks.ts";

// The choice words of Foundations of Stone (dwarrowdelf part 8), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario foundations-of-stone --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=foundations-of-stone` prints each sentence.
// The first player answers for the group at the Setup's Torch; every other choice is the player's own (the hero or character he controls, his hand, his deck, the area he sends the Centipede to), so those sentences are owned: two-handed they lead with the player and the sheet adds no "Player N chooses."
// (the rows of a pick that spans seats name their owner).
export const ASKS: Readonly<Record<string, Ask>> = {
  // 04111:A:1 (Setup): the first player attaches Cave Torch to a hero of any player.
  "04111:setup:1 @1 Pick": { note: "{card}: the first player chooses a hero of any player to carry Cave Torch. The Torch is removed from the game if it would leave play.", verb: "Attach" },

  // 04119:A:3, 04120:A:3 (Action): a ready hero exhausts to claim the objective from the staging area.
  "04119:action:1 @0 Pick": { owned: true, note: "{card}: choose 1 ready hero you control to exhaust. That hero claims it and carries it as an attachment.", verb: "Exhaust" },
  "04120:action:1 @0 Pick": { owned: true, note: "{card}: choose 1 ready hero you control to exhaust. That hero claims it and carries it as an attachment.", verb: "Exhaust" },

  // 04121:A:1 (Drowned Treasury, end of the quest phase): each player discards a character he controls, a hero included.
  "04121:forced:1 @0.0 Pick": { owned: true, note: "{card} is the active location: choose 1 character you control to discard, a hero included.", verb: "Discard" },

  // 04121:A:2 (explored): each player may draw 2 cards, or claim an objective in the staging area for a hero he controls, or do neither.
  "04121:response:1 @0.0 Choose": { owned: true, note: "{card} was explored: draw 2 cards, claim 1 objective in the staging area, or do neither.", verb: "Choose" },
  "04121:response:1 @0.0 draw": { label: "Draw 2 cards" },
  "04121:response:1 @0.0 claim": { label: "Claim an objective for one of your heroes" },
  "04121:response:1 @0.0 neither": { label: "Do neither" },
  "04121:response:1 @0.0.claim.0 Pick": { owned: true, note: "{card}: choose 1 objective in the staging area to claim. Each objective can be claimed once.", verb: "Claim" },
  "04121:response:1 @0.0.claim.1 Pick": { owned: true, note: "{card}: choose 1 hero you control to carry the objective. No hero exhausts.", verb: "Attach" },

  // 04122:A:2 (Mithril Lode's Refresh Action): a character exhausts and places its Willpower as progress on the current quest card.
  "04122:action:1 @0 Pick": { owned: true, note: "{card}: choose 1 ready character you control to exhaust. Its Willpower is placed as progress on the current quest, not on a location.", verb: "Exhaust" },

  // 04124:A:1 (Lost and Alone, When Revealed): each player shuffles a hero he controls into his deck.
  "04124:whenRevealed:1 @0.0 Pick": { owned: true, note: "{card}: choose 1 hero you control to shuffle into your deck. It is put into play, ready and with no tokens, when you draw it.", verb: "Shuffle" },

  // 901701:A:2 (Nightmare setup card): each player discards allies until the allies he controls cost 6 or less in all.
  "901701:forced:1 @1.0 DiscardAlliesToCost": { owned: true, note: "{card}: Washed Away! is revealed. Choose 1 of your allies to discard, until the allies you control cost 6 or less in all.", verb: "Discard" },

  // 901703:A:1 (Giant Cave Centipede, When Revealed): each player shuffles the card in his hand with the highest printed cost into his deck; he picks among ties.
  "901703:whenRevealed:1 @0.0 ShuffleHighestCostIntoDeck": { owned: true, note: "{card}: choose 1 of the cards in your hand tied for the highest printed cost to shuffle into your deck.", verb: "Shuffle" },

  // 901703:A:2 (end of the combat phase): the engaged player picks a player of a different staging area, and the Centipede joins that area.
  "901703:forced:1 @0.0 Pick": { owned: true, note: "{card} is engaged with you: choose another player's staging area for it to join as a staging card.", verb: "Send" },

  // 901708:A:1 (Chill of the Roots, When Revealed): each player discards his hand, or raises his threat by the number of cards in it.
  "901708:whenRevealed:1 @0.0 Choose": { owned: true, note: "{card}: discard your hand, or raise your threat by the number of cards in it ({hand}). If no card is discarded, it gains surge.", verb: "Choose", bind: { hand: { hand: true } } },
  "901708:whenRevealed:1 @0.0 discard": { label: "Discard your hand ({hand} cards)", bind: { hand: { hand: true } } },
  "901708:whenRevealed:1 @0.0 raise": { label: "Raise your threat by {hand}", bind: { hand: { hand: true } } },
};
