import type { Ask } from "../asks.ts";

// The choice words of Conflict at the Carrock (shadows-of-mirkwood part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario conflict-at-the-carrock --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=conflict-at-the-carrock` prints each sentence.
// The first player answers for the group at 02035 and 900510, so those sentences are not owned (the sheet adds who chooses); each player answers A Frightened Beast for himself, in turn from the first player.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 02035:B:1 (Forced after the 7th progress): The Carrock in the staging area becomes the active location; the previous active location is discarded first.
  "02035:forced:1 @1 Pick": { note: "{card}: choose The Carrock in the staging area to become the active location. The active location it replaces is discarded.", verb: "Travel" },

  // 900510:A:1 (When Revealed): the first player removes a hero in any player's discard pile from the game, then all damage is healed from each Troll enemy in play.
  "900510:whenRevealed:1 @0 Pick": { note: "{card}: choose 1 hero in any player's discard pile to remove from the game. All damage is then healed from each Troll enemy.", verb: "Remove" },

  // 02047:A:1 (When Revealed): each player in turn from the first player may discard 1 Creature ally he controls to cancel the effect for everyone.
  "02047:whenRevealed:1 @0.0 Choose": { owned: true, note: "{card}: discard 1 Creature ally you control to cancel this effect for every player, or keep your allies.", verb: "Choose" },
  "02047:whenRevealed:1 @0.0 discard": { label: "Discard a Creature ally to cancel it" },
  "02047:whenRevealed:1 @0.0 keep": { label: "Keep your allies" },
};
