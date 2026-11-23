// Rules: rr.the-word-choose, hob.treasure-ohauh, hob.treasure-otd, hob.bilbo-baggins-ohauh, hob.bilbo-baggins-otd (data/rules/entries.json). The choice words of the cards the six scenarios of The Hobbit share: Bilbo Baggins and the
// Baggins events, and the treasure cards. A game reads only its own scenario's asks file, so each scenario of the cycle spreads these into its own (`...HOBBIT_ASKS`), as the Campaign Pool's boons are (src/play/words/pool-boon-asks.ts).
import type { Ask } from "./asks.ts";

export const HOBBIT_ASKS: Readonly<Record<string, Ask>> = {
  // 132001:A:2 (Action, spending 1 Baggins resource): the player searches their own deck for a treasure card and adds it to their hand.
  "132001:action:1 @0 Pick": { owned: true, note: "{card}: choose 1 treasure card from your deck to add to your hand. Your deck is shuffled after.", verb: "Add" },

  // 131019:A:1 (Burglar Baggins): Bilbo Baggins is the hero that gets the bonus, whoever plays the card.
  "131019:action:1 @1 Pick": { note: "{card}: choose Bilbo Baggins to get +2 Willpower, +2 Attack and +2 Defense until the end of the phase.", verb: "Choose" },

  // 132013:A:1 (The Lucky Number): any character in play but Bilbo Baggins takes his total Willpower, Attack and Defense until the end of the phase.
  "132013:action:1 @0 Pick": { owned: true, note: "{card}: choose a character in play, other than Bilbo Baggins, to take his total Willpower, Attack and Defense until the end of the phase.", verb: "Choose" },

  // 132020:A:2 (The Arkenstone): X is how much threat the player raises, and how much cheaper the next ally of the attached hero's sphere is this phase.
  "132020:action:1 @0 ChooseX": { owned: true, note: "{card}: choose X. You raise your threat by X, and the next ally you play this phase that matches the attached hero's sphere costs X less." },

  // 132022:A:3 (Thrór's Battle Axe): 1 damage to another enemy engaged with the player.
  "132022:response:1 @0 Pick": { owned: true, note: "{card}: choose another enemy engaged with you to take 1 damage.", verb: "Damage" },
};
