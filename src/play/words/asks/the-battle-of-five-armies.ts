import type { Ask } from "../asks.ts";
import { HOBBIT_BILBO_ASKS, HOBBIT_TREASURE_ASKS } from "../hobbit-asks.ts";

// The choice words of The Battle of Five Armies (the-hobbit part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-battle-of-five-armies --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-battle-of-five-armies` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  ...HOBBIT_BILBO_ASKS,
  ...HOBBIT_TREASURE_ASKS,

  // 132052:A:1 (Misty Mountain Eagle, an Action the first player pays 2 Baggins resources for): take control of it, or discard it to discard a non-unique enemy in the staging area.
  "132052:action:1 @0 Choose": { owned: true, note: "{card}: take control of it, or discard it to discard a non-unique enemy in the staging area." },
  "132052:action:1 @0 control": { label: "Take control of {card}" },
  "132052:action:1 @0 discard": { label: "Discard {card} to discard a non-unique enemy in the staging area" },
  "132052:action:1 @0.discard.0 Pick": { owned: true, note: "{card}: choose a non-unique enemy in the staging area to discard.", verb: "Discard" },

  // 132037:A:1 (Fighting Among Friends, in the Wilderland set): the first player names a sphere; each committed character outside it, a Baggins one excepted, leaves the quest.
  "132037:whenRevealed:1 @0 Choose": { owned: true, note: "Fighting Among Friends: name a sphere. Each committed character that does not belong to it, Baggins excepted, is removed from the quest." },
  "132037:whenRevealed:1 @0 leadership": { label: "Leadership: the others leave the quest" },
  "132037:whenRevealed:1 @0 lore": { label: "Lore: the others leave the quest" },
  "132037:whenRevealed:1 @0 spirit": { label: "Spirit: the others leave the quest" },
  "132037:whenRevealed:1 @0 tactics": { label: "Tactics: the others leave the quest" },

  // 132066:A:2 (Heedless of Order): the first player chooses a stage other than the current one to be the current stage until the end of the round.
  "132066:whenRevealed:1 @1 ChooseCurrentQuest": { note: "Heedless of Order: choose a quest stage other than the current stage to be the current stage until the end of the round. Progress goes on that stage only.", verb: "Choose" },
};
