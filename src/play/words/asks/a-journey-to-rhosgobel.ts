import type { Ask } from "../asks.ts";

// The choice words of A Journey to Rhosgobel (shadows-of-mirkwood part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario a-journey-to-rhosgobel --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=a-journey-to-rhosgobel` prints each sentence.
// The first player answers for the group at all three, so the sentences are not owned (the sheet adds who chooses).
export const ASKS: Readonly<Record<string, Ask>> = {
  // 02061:B:1 (Response, after the quest phase begins): the Pick is Wilyador, who takes 1 damage token for each player before the first player looks at the top 3 cards of the encounter deck.
  "02061:response:1 @0 Pick": { note: "{card}: choose Wilyador to place 1 damage token on him for each player. Then look at the top 3 cards of the encounter deck, reveal 1 and discard the other 2.", verb: "Place" },

  // 900607:A:2 (When Revealed): attaches to an Eagle character that has no Shot from the Sky; it loses the Eagle trait and takes 1 damage each time it readies.
  "900607:whenRevealed:1 @0 AttachSelf": { note: "{card}: choose an Eagle character to carry it. The character loses the Eagle trait and takes 1 damage each time it readies. With no Eagle character it is discarded.", verb: "Attach" },

  // 900608:A:2 (When Revealed): attaches to Wilyador, who may already carry a copy; no choice is open unless several cards qualify.
  "900608:whenRevealed:1 @0 AttachSelf": { note: "{card}: attach it to Wilyador. A heal by a card effect other than Athelas then heals only 1 damage, and Noxious Supplies is then discarded.", verb: "Attach" },

  "900603:forced:1 @0 EngageSeatWith": { note: "{card}: more than one player controls Wilyador. Choose the player it engages, regardless of threat.", verb: "Engage" },
};
