import type { Ask } from "../asks.ts";
import { HOBBIT_BILBO_ASKS, HOBBIT_TREASURE_ASKS } from "../hobbit-asks.ts";
import { WILDERLAND_ASKS } from "../wilderland-asks.ts";

// The choice words of The Lonely Mountain (the-hobbit part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-lonely-mountain --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-lonely-mountain` prints each sentence. The burgle attempt's own choices (discard the matching cards or decline, the hand card to discard) are
// worded by words/scenarios/the-hobbit/burgle.ts, which the choice sheet reads for a Choose a burgle attempt opens. The first player makes every choice below that the printed card gives to "the first player".
export const ASKS: Readonly<Record<string, Ask>> = {
  ...HOBBIT_BILBO_ASKS,
  ...HOBBIT_TREASURE_ASKS,
  ...WILDERLAND_ASKS,

  // 132045:A:2 (Secret Entrance, Travel): the first player exhausts a ready hero and names a card type; the top card of the encounter deck is looked at.
  "132045:travel:1 @0 Pick": { owned: true, note: "{card}: as the first player, choose 1 ready hero you control to exhaust to travel here. Bilbo Baggins may be the hero.", verb: "Exhaust" },
  "132045:travel:1 @2 Choose": { owned: true, note: "{card}: as the first player, name a card type. The players travel here and the top card of the encounter deck is looked at. If it is not the named type, this location goes back to the staging area." },

  // 132047:A:1 (Western Slopes, leaving play explored): the first player draws 2 cards or removes 1 progress from Smaug the Golden.
  "132047:response:1 @0 Choose": { owned: true, note: "{card}: it left play explored. As the first player, draw 2 cards or remove 1 progress from Smaug the Golden." },
  "132047:response:1 @0.remove.0 Pick": { owned: true, note: "{card}: choose Smaug the Golden to take 1 progress off.", verb: "Remove" },

  // 132048:A:2 (Pretending to Sleep, When Revealed): the first player spends X Baggins resources or advances to stage 4A.
  "132048:whenRevealed:1 @2 Choose": { owned: true, note: "{card}: as the first player, spend as many Baggins resources as Smaug the Golden has progress, or advance to stage 4A." },

  // 132072:B:1 (The Burglar's Turn): after the burgle attempt the players may advance to stage 3.
  "132072:forced:1 @4 Choose": { owned: true, note: "{card}: the burgle attempt is made. As the first player, advance to stage 3, or stay on this stage." },

  // 132051:A:1 (Dragon-Spell, When Revealed): it goes to the hero with the most resources that has no Dragon-Spell; a tie is the first player's choice.
  "132051:whenRevealed:1 @0 Pick": { owned: true, note: "{card}: choose the hero it attaches to, among the heroes with the most resources and no Dragon-Spell. That hero gets -1 Willpower for each resource in its pool and takes damage for each resource it spends.", verb: "Attach" },

  // 132036:A:1 and A:2 (Dark Bats, of the Wilderland set): once it damages a character, or as a Shadow effect, it attaches to the character.
  "132036:forced:1 @0 AttachSelf": { note: "{card}: choose the character it damaged to carry it. That character gets -1 Willpower, Attack and Defense.", verb: "Attach" },
  "132036:shadow:1 @0 AttachSelf": { note: "{card}: choose the defending character that carries it. That character gets -1 Willpower, Attack and Defense.", verb: "Attach" },
};
