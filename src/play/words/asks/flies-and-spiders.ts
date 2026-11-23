import type { Ask } from "../asks.ts";
import { HOBBIT_BILBO_ASKS } from "../hobbit-asks.ts";

// The choice words of Flies and Spiders (the-hobbit part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario flies-and-spiders --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=flies-and-spiders` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  ...HOBBIT_BILBO_ASKS,
  // 132067:A:1 (Setup): each player in turn from the first player may shuffle 1 copy of Bilbo's Magic Ring into his deck.
  "132067:setup:1 @0.0 Choose": { owned: true, note: "{card}: shuffle 1 copy of Bilbo's Magic Ring into your deck, or keep your deck as it is.", verb: "Choose" },
  "132067:setup:1 @0.0 shuffle": { label: "Shuffle in Bilbo's Magic Ring" },
  "132067:setup:1 @0.0 keep": { label: "Keep your deck as it is" },

  // 132026:A:2 (Response): the first player readies an unconscious character of the players at the stage.
  "132026:response:1 @0 Pick": { note: "{card}: choose 1 unconscious character to ready. It is no longer unconscious.", verb: "Ready" },
  // 132027:A:2 (Response): the first player takes 1 poison, four times, from the poisoned characters of the players at the stage.
  "132027:response:1 @0.0 Pick": { note: "{card}: choose 1 poisoned character to discard 1 poison from. This repeats up to 4 times in all.", verb: "Discard" },
  // 132028:A:2 (Forced, end of the round): each player in turn gives 1 poison to a hero he controls.
  "132028:forced:1 @0.0 Pick": { owned: true, note: "{card}: choose 1 hero you control to take 1 poison from the top of your deck. An unconscious hero cannot take it.", verb: "Poison" },
  // 132029:A:2 (When Revealed): the first player chooses among the characters with the most poison; its controller is attacked.
  "132029:whenRevealed:1 @0 Pick": { note: "{card}: choose a character with the most poison. Its controller is attacked by Crazy Cob from the staging area.", verb: "Attack" },
  // 132031:A:3 (Shadow): an undefended attack gives 2 poison to a character the defending player chooses.
  "132031:shadow:1 @1 Pick": { owned: true, note: "{card}: choose 1 character you control to take 2 poison from the top of your deck.", verb: "Poison" },
  // 132032:A:2 (Forced, when it attacks): the defending player attaches 1 poison to a character he controls.
  "132032:forced:1 @0 Pick": { owned: true, note: "{card}: choose 1 character you control to take 1 poison from the top of your deck, before you declare a defender.", verb: "Poison" },
  // 132069:B:3 and 132070:B:3 (Action): spend 2 Baggins resources to ready an unconscious character you control.
  "132069:action:1 @0 Pick": { owned: true, note: "{card}: choose 1 unconscious character you control to ready for 2 Baggins resources.", verb: "Ready" },
  "132070:action:1 @0 Pick": { owned: true, note: "{card}: choose 1 unconscious character you control to ready for 2 Baggins resources.", verb: "Ready" },
  // 132025:A:3 (Forced, start of the quest phase): search the encounter deck, not the discard pile, for a Spider enemy (a second one with 3 or more players at the stage).
  "132025:forced:1 @0 SearchMove": { note: "{card}: choose a Spider enemy from the encounter deck to add to the staging area. The encounter deck is shuffled after.", verb: "Add" },
  "132025:forced:1 @1 SearchMove": { note: "{card}: with 3 or more players here, choose a second Spider enemy from the encounter deck to add to the staging area.", verb: "Add" },
  // 132033:A:1 (When Revealed): the first player chooses a hero committed to the quest, who is removed from it and made unconscious.
  "132033:whenRevealed:1 @1 Pick": { note: "{card}: choose 1 hero committed to the quest. It is removed from the quest and made unconscious.", verb: "Remove" },
  // 132034:A:2 (Shadow): the defending player discards an unconscious character he controls.
  "132034:shadow:1 @0 Pick": { owned: true, note: "{card}: choose 1 unconscious character you control to discard.", verb: "Discard" },
  // 132036:A:1 and A:2 (Dark Bats, Wilderland): it attaches to the character it damaged, or to the defender.
  "132036:forced:1 @0 AttachSelf": { note: "{card}: it attaches to the character it damaged and gives it -1 Willpower, -1 Attack and -1 Defense.", verb: "Attach" },
  "132036:shadow:1 @0 AttachSelf": { note: "{card}: it attaches to the defending character and gives it -1 Willpower, -1 Attack and -1 Defense.", verb: "Attach" },
};
