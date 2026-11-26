import type { Ask } from "../asks.ts";
import type { When } from "../asks-conditions.ts";

// The choice words of The Battle of Lake-town (standalone-scenarios part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-battle-of-lake-town --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-battle-of-lake-town` prints each sentence.
// The choices the engine makes for the Smaug deck and Burn (where Smaug is revealed, each player's Burn share, the progress stage 2B discards, the split of progress on two active locations) and the keep rows of the two cancel offers hold no record of their own: src/play/words/scenarios/standalone-scenarios/smaug.ts words them.
// Each player answers for himself (the cancel offers from the first player on, Dire Magnificence in turn), so the sentences are owned.

// The player controls one hero only: discarding it eliminates him, and the game is lost when he is the last player.
const LAST_HERO: When = { kind: "count", pick: { type: "hero", control: "you" }, max: 1 };
const LAST_HERO_LOST = "Tap again: this is your last hero, and discarding it eliminates you. If you are the last player, the game is lost";

export const ASKS: Readonly<Record<string, Ask>> = {
  // 50208:A:2 (The Old Thrush): a player exhausts a ready hero to claim it; its Response lets the attacking hero's player discard X cards to lower Smaug's Defense by X.
  "50208:action:1 @0 Pick": { owned: true, note: "Choose a ready hero you control to exhaust. The Old Thrush is claimed and attached to it.", verb: "Exhaust" },
  "50208:response:1 @0 ChooseX": {
    owned: true,
    bind: { hand: { count: { type: "card", control: "you", from: "hand" } } },
    note: "The Old Thrush: choose X, from 1 to {hand}. You discard X cards from your hand, and Smaug's Defense is lowered by X until the end of the attack.",
    verb: "Choose",
  },
  "50208:response:1 @1 DiscardFromHand": { owned: true, note: "The Old Thrush: choose X cards to discard from your hand, one at a time. Each lowers Smaug's Defense by 1.", verb: "Discard" },

  // 50209:A:2 and 50210:A:2 (Close to the Flame, Scorching Blast, Shadow): any player may discard a hero to cancel the effect, each in turn from the first player.
  "50209:shadow:1 @0.0 Choose": { owned: true, why: "any player may discard a hero to cancel this Shadow effect: 1 damage to each character in play.", note: "Discard a hero you control, or let it resolve." },
  "50209:shadow:1 @0.0 discard": { label: "Discard a hero you control to cancel it", caution: { when: LAST_HERO, text: LAST_HERO_LOST } },
  "50209:shadow:1 @0.0.discard.0 Pick": { owned: true, note: "Close to the Flame: choose a hero you control to discard. The Shadow effect is canceled.", verb: "Discard", caution: { when: LAST_HERO, text: LAST_HERO_LOST } },
  "50210:shadow:1 @0.0 Choose": { owned: true, why: "any player may discard a hero to cancel this Shadow effect: resolve all burn damage.", note: "Discard a hero you control, or let it resolve." },
  "50210:shadow:1 @0.0 discard": { label: "Discard a hero you control to cancel it", caution: { when: LAST_HERO, text: LAST_HERO_LOST } },
  "50210:shadow:1 @0.0 keep": { label: "Let it resolve: all burn damage is resolved" },
  "50210:shadow:1 @0.0.discard.0 Pick": { owned: true, note: "Scorching Blast: choose a hero you control to discard. The Shadow effect is canceled.", verb: "Discard", caution: { when: LAST_HERO, text: LAST_HERO_LOST } },

  // 50212:A:1 (Dire Magnificence): each player in turn discards an ally he controls; each who cannot puts 2 damage on Lake-town.
  "50212:whenRevealed:1 @0.0 Choose": { owned: true, note: "Dire Magnificence: discard an ally you control. If you control none, 2 damage goes on Lake-town." },
  "50212:whenRevealed:1 @0.0 discard": { label: "Discard an ally you control" },
  "50212:whenRevealed:1 @0.0 cannot": { label: "You control no ally: 2 damage goes on Lake-town" },
  "50212:whenRevealed:1 @0.0.discard.0 Pick": { owned: true, note: "Dire Magnificence: choose an ally you control to discard.", verb: "Discard" },

  // 50213:A:1 (Catching Fire): the first player chooses a Pier location in the victory display to shuffle into the encounter deck; with none, Catching Fire gains surge.
  "50213:whenRevealed:1 @0 Choose": { owned: true, note: "Catching Fire: choose a Pier location in the victory display to shuffle into the encounter deck. With none, it gains surge." },
  "50213:whenRevealed:1 @0 shuffle": { label: "Shuffle a Pier location from the victory display into the encounter deck" },
  "50213:whenRevealed:1 @0 none": { label: "No Pier location in the victory display: Catching Fire gains surge" },
  "50213:whenRevealed:1 @0.shuffle.0 Pick": { owned: true, note: "Catching Fire: choose a Pier location in the victory display. It is shuffled into the encounter deck and its Victory points leave the display.", verb: "Shuffle in" },

  // 50214:A:1 (Reckless in His Rage): Smaug gets +2 Threat, +2 Attack and -2 Defense, and allies cannot defend against him, until the end of the round.
  "50214:whenRevealed:1 @0 Pick": { note: "Reckless in His Rage: Smaug gets +2 Threat, +2 Attack and -2 Defense until the end of the round, and allies cannot defend against him.", verb: "Boost" },

  // 50223:A:2 (Fisherman's Dock): with 1 active location, a hero is exhausted to travel here, and it becomes the second active location.
  "50223:travel:1 @0 Pick": { owned: true, note: "Fisherman's Dock: choose a ready hero you control to exhaust. You travel here even though a location is active, and it becomes the second active location.", verb: "Exhaust" },

  "50202:triggered:1 @0 HealLakeTownByProgress": { note: "{card}: the players quested successfully. Choose how much of the progress to discard instead of placing it, to remove that much damage from Lake-town.", verb: "Choose" },
  "50205:whenRevealed:1 @0 ResolveBurn": { owned: true, note: "{card}: resolve all burn damage from the locations in play. You may exhaust ready characters you control to take it; the rest goes on Lake-town.", verb: "Choose" },
  "50210:whenRevealed:1 @0 ResolveBurn": { owned: true, note: "{card}: resolve all burn damage from the locations in play. You may exhaust ready characters you control to take it; the rest goes on Lake-town.", verb: "Choose" },
  "50210:shadow:1 @1 ResolveBurn": { owned: true, note: "{card}: its When Revealed effect resolves for the attack: resolve all burn damage from the locations in play. You may exhaust ready characters you control to take it; the rest goes on Lake-town.", verb: "Choose" },
  "50214:shadow:1 @0.0 ResolveBurn": { owned: true, note: "{card}: the attack destroyed a character, so resolve all burn damage from the locations in play. You may exhaust ready characters you control to take it; the rest goes on Lake-town.", verb: "Choose" },
  "50221:whenRevealed:1 @0 ResolveBurn": { owned: true, note: "{card}: resolve all burn damage from the locations in play. You may exhaust ready characters you control to take it; the rest goes on Lake-town.", verb: "Choose" },
};
