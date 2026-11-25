import type { Ask } from "../asks.ts";

// The choice words of Into the Pit (dwarrowdelf part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario into-the-pit --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=into-the-pit` prints each sentence.
// The first player answers for the group at Entering the Mines, Goblin Patrol, Goblin Ambush, Watchful Eyes, Sudden Pitfall and the Travel of Stairs of Náin, so those sentences are not owned (the sheet adds who chooses); the defending player's own
// choice as a shadow card is owned, and so is each player's own choice (Crumbling Ruin, Burning Low, Fouled Well, each player's search for Goblin Patrol, the Cave Torch's Action). Cave Torch is the objective card of this scenario.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 03019:A:1 (Travel) and A:2 (Shadow): the first player exhausts a character to travel to Stairs of Náin; the defending player exhausts one as a shadow card.
  "03019:travel:1 @0 Pick": { note: "{card}: choose 1 ready character you control to exhaust. Travelling to Stairs of Náin costs that exhaust.", verb: "Exhaust" },
  "03019:shadow:1 @0 Pick": { owned: true, note: "{card}: choose 1 ready character you control to exhaust.", verb: "Exhaust" },

  // 03036:A:2 (Forced after Branching Paths is explored): the players look at 3 encounter cards, reveal 1 and move the other 2 to the bottom.
  "03036:forced:1 @1 PickEncounter": { note: "{card}: choose 1 of the 3 encounter cards you looked at to reveal. The other 2 go to the bottom of the encounter deck.", verb: "Reveal" },

  // 03040:A:1 (When Revealed): a player who controls a ready Cave Torch may exhaust it to cancel Burning Low.
  "03040:whenRevealed:1 @1.0 Choose": { owned: true, note: "{card}: exhaust your ready Cave Torch to cancel it. Otherwise each staged enemy and location gets +1 Threat, +3 if Dark." },
  "03040:whenRevealed:1 @1.0 exhaust": { label: "Exhaust Cave Torch: Burning Low is canceled" },
  "03040:whenRevealed:1 @1.0 keep": { label: "Do nothing: +1 Threat for each staged enemy and location, +3 for a Dark one" },

  // 03041:A:2 (Action): exhaust the Cave Torch to place up to 3 progress on a Dark location.
  "03041:action:1 @1 ChooseX": { owned: true, note: "{card}: choose X, from 1 to 3 progress to place on a Dark location.", verb: "Choose X" },
  "03041:action:1 @2 Pick": { owned: true, note: "{card}: choose 1 Dark location, in the staging area or active, to place X progress on.", verb: "Place" },

  // 03049:A:1 (When Revealed): each player exhausts a character and discards the top card of his deck.
  "03049:whenRevealed:1 @0.0 Pick": { owned: true, note: "{card}: choose 1 character you control to exhaust. Then discard the top card of your deck.", verb: "Exhaust" },

  // 03051:A:1 (When Revealed) and A:2 (Shadow): the first player discards a questing character; the defending character is discarded as a shadow card.
  "03051:whenRevealed:1 @0 Pick": { note: "{card}: choose 1 questing character you control to discard. This effect cannot be canceled.", verb: "Discard" },
  "03051:shadow:1 @0 Pick": { owned: true, note: "{card}: the defending character is discarded from play.", verb: "Discard" },

  // 03053:A:1 (When Revealed): each player may discard 1 random card from his hand; Fouled Well gains surge when any player does not.
  "03053:whenRevealed:1 @1.0 Choose": { owned: true, note: "{card}: discard 1 card at random from your hand, or not. Fouled Well gains surge if any player does not discard." },
  "03053:whenRevealed:1 @1.0 discard": { label: "Discard 1 card at random from your hand" },
  "03053:whenRevealed:1 @1.0 keep": { label: "Don't discard: Fouled Well gains surge" },

  // 03062:A:1 (When Revealed): the first player attaches Watchful Eyes to one of his heroes that carries no copy of it.
  "03062:whenRevealed:1 @0 AttachSelf": { note: "{card}: choose 1 of your heroes to carry it. A hero with a Watchful Eyes already is not offered.", verb: "Attach" },

  // 03064:A:1 (Setup): the first player attaches Cave Torch to the hero of any player he chooses.
  "03064:setup:1 @1 Pick": { note: "{card}: choose 1 hero, any player's, to carry Cave Torch. It stays with that hero for the game and is removed from the game if it leaves play.", verb: "Attach" },

  // 03065:B:1 (When Revealed): each player searches for 1 enemy; the first player names the player whose search must take Patrol Leader.
  "03065:whenRevealed:1 @0 Pick": { note: "{card}: choose the player whose search must take Patrol Leader, if it is in the encounter deck or discard pile. Each player then searches for 1 enemy.", verb: "Choose" },
  "03065:whenRevealed:1 @1.0 SearchMove": { owned: true, note: "{card}: search the encounter deck and discard pile for 1 enemy to add to the staging area. If Patrol Leader is there, you must take it.", verb: "Add" },

  // 901002:A:1 (When Revealed, Nightmare): the first player searches for 1 plus the number of players Orc enemies: Patrol Sentry, Patrol Leader, if able, and Orcs of his choice.
  "901002:whenRevealed:1 @2 SearchMove": { note: "{card}: search the encounter deck and discard pile for Patrol Sentry, if able, or another Orc enemy. The enemy is added to the staging area.", verb: "Add" },
  "901002:whenRevealed:1 @3 SearchMove": { note: "{card}: search the encounter deck and discard pile for Patrol Leader, if able, or another Orc enemy. The enemy is added to the staging area.", verb: "Add" },
  "901002:whenRevealed:1 @4.0 SearchMove": { note: "{card}: search the encounter deck and discard pile for another Orc enemy to add to the staging area. 1 plus the number of players are found in all.", verb: "Add" },

  // 901008:A:2 (When Revealed, Nightmare): the first player attaches Shadow-fall to a non-Dark location, which gains the Dark trait and 3 quest points.
  "901008:whenRevealed:1 @0 Pick": { note: "{card}: choose 1 location that is not Dark, in the staging area or active, to carry it. It gains the Dark trait and 3 quest points.", verb: "Attach" },
};
