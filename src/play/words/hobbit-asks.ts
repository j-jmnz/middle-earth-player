// Rules: rr.the-word-choose, hob.treasure-ohauh, hob.treasure-otd, hob.bilbo-baggins-ohauh, hob.bilbo-baggins-otd (data/rules/entries.json). The choice words of the cards of The Hobbit's six scenarios that more than one of them deals: Bilbo
// Baggins (`sagaStart`) and the treasure cards (`ScenarioData.treasures`). A game reads only its own scenario's asks file, so each scenario of the cycle spreads the tables of the cards it deals that ask (`...HOBBIT_BILBO_ASKS` in the three On the Doorstep scenarios, `...HOBBIT_TREASURE_ASKS` in The Battle of Five Armies), as the Campaign Pool's boons are
// (src/play/words/pool-boon-asks.ts); an entry keys a record of a card the scenario deals (`dealtCodes`). The two Baggins events are player pool cards no scenario deals: the chain of word families words them.
import type { Ask } from "./asks.ts";

// Bilbo Baggins of the On the Doorstep box (132001), dealt by Flies and Spiders, The Lonely Mountain and The Battle of Five Armies; the Over Hill and Under Hill Bilbo asks nothing.
export const HOBBIT_BILBO_ASKS: Readonly<Record<string, Ask>> = {
  // 132001:A:2 (Action, spending 1 Baggins resource): the player searches their own deck for a treasure card and adds it to their hand.
  "132001:action:1 @0 Pick": { owned: true, note: "{card}: choose 1 treasure card from your deck to add to your hand. Your deck is shuffled after.", verb: "Add" },
};

// The treasure cards that ask (The Arkenstone, Thrór's Battle Axe), for the scenarios whose Setup lists the dragon set of The Lonely Mountain (The Battle of Five Armies only).
export const HOBBIT_TREASURE_ASKS: Readonly<Record<string, Ask>> = {
  // 132020:A:2 (The Arkenstone): X is how much threat the player raises, and how much cheaper the next ally of the attached hero's sphere is this phase.
  "132020:action:1 @0 ChooseX": { owned: true, note: "{card}: choose X. You raise your threat by X, and the next ally you play this phase that matches the attached hero's sphere costs X less." },

  // 132022:A:3 (Thrór's Battle Axe): 1 damage to another enemy engaged with the player.
  "132022:response:1 @0 Pick": { owned: true, note: "{card}: choose another enemy engaged with you to take 1 damage.", verb: "Damage" },
};
