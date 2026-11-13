import type { Amount, PickSpec } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";
import { POOL_BOON_ASKS } from "../pool-boon-asks.ts";

// The choice words of Deadmen's Dike (angmar-awakened part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario deadmens-dike --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=deadmens-dike` prints each sentence.
// A choice of one player's own (a character he controls to exhaust, an attachment he controls to discard, Unnatural Fog's either/or, the discard or the return after Thaurdir destroys his character) is owned: two-handed the sentence leads with the player.
// Mysterious Omens (10160), which lies in the pool and may be shuffled into this encounter deck, is worded by the chain: no record of it is dealt by this scenario. The first player answers for the group when heroes tie for a burden (the hero it moves to), so that sentence is not owned and the sheet adds who chooses. The searches name the pile they read: Baleful Shade comes from the encounter deck only, Cursed Dead from the
// encounter discard pile only. Ruthless (10164) is worded once for every scenario that can deal it (src/play/words/pool-boon-asks.ts).
const QUESTING: PickSpec = { type: "character", control: "you", committed: true };
// The cards in the asked player's deck: at 0 he is eliminated (09073:B:3, 09074:B:2).
const DECK: PickSpec = { type: "card", control: "you", from: "deck" };
// X of Thaurdir's Damned: the combined printed cost of the two cards it discarded (09034:A:1).
const DISCARDED_COST: Amount = { discarded: "cost" };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 09034:A:1 (Forced after it engages you): discard the top 2 cards of your deck, then assign X damage among the characters you control, X their combined printed cost.
  "09034:forced:1 @1 AssignDamage": { owned: true, note: "Thaurdir's Damned: assign {x} damage among your characters ({x}, the cost of the 2 discarded cards; {left} left).", bind: { x: DISCARDED_COST }, verb: "Assign" },

  // 09035:A:2 and 09040:A:2 (Shadow): the defending player exhausts a character, or discards an attachment, he controls.
  "09035:shadow:1 @0 Pick": { owned: true, note: "Baleful Shade's shadow: choose a character you control to exhaust.", verb: "Exhaust" },
  "09040:shadow:1 @0 Pick": { owned: true, note: "Deadmen's Gate's shadow: choose an attachment you control to discard.", verb: "Discard" },

  // 09061:A:1 (When Revealed): every copy in the encounter discard pile; 09073:B:1: each player searches the encounter deck only.
  "09061:whenRevealed:1 @0 SearchMove": { note: "Cursed Dead: put each copy in the encounter discard pile into the staging area.", verb: "Add" },
  "09073:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "The Shades of Angmar: search the encounter deck for a Baleful Shade. Put it into play engaged with you.", verb: "Engage" },

  // 09065:A:3 (Shadow): the defending character, whose owner's discard pile holds a copy of it, is discarded.
  "09065:shadow:1 @0 Pick": { note: "Dark Sorcery's shadow: a copy of the defending character lies in its owner's discard pile. Discard the defending character.", verb: "Discard" },

  // 09041:A:2 (When Revealed): each player chooses for himself. Neither is offered to a player with no questing character.
  "09041:whenRevealed:1 @0.0 Choose": { owned: true, note: "Unnatural Fog: discard the top card of your deck for each questing character you control, or remove them from the quest." },
  "09041:whenRevealed:1 @0.0 discard": { label: "Discard 1 card for each questing character ({x} cards)", bind: { x: { count: QUESTING } }, caution: { when: { kind: "less", left: { count: DECK }, right: { count: QUESTING, plus: 1 } }, text: "Tap again: your deck would be empty and you would be eliminated. If you are the last player, the game is lost" } },
  "09041:whenRevealed:1 @0.0 remove": { label: "Remove each of your characters from the quest" },

  // 09074:B:1 (Forced after Thaurdir attacks and destroys a character): its controller chooses; a player left with no cards in his deck is eliminated.
  "09074:forced:1 @0 Choose": { owned: true, note: "A Fell Wraith: Thaurdir destroyed your character. Either discard the top 3 cards of your deck (you have {cards}; at 0 you are eliminated), or return Thaurdir to the staging area.", bind: { cards: { count: DECK } } },
  "09074:forced:1 @0 discard": { label: "Discard the top 3 cards of your deck", caution: { when: { kind: "count", pick: DECK, max: 3 }, text: "Tap again: your deck would be empty and you would be eliminated. If you are the last player, the game is lost" } },
  "09074:forced:1 @0 return": { label: "Return Thaurdir to the staging area" },

  // 10168:A:2, 10169:A:2, 10170:A:2 (Forced after a Sorcery treachery is revealed): when heroes tie for the most, the first player chooses the hero the burden moves to.
  "10168:forced:1 @0 MoveToHero": { note: "Thaurdir's Legacy: these heroes tie for the most resources. Choose the hero it moves to.", verb: "Move" },
  "10169:forced:1 @0 MoveToHero": { note: "Thaurdir's Majesty: these heroes tie for the most attachments that are not objectives. Choose the hero it moves to.", verb: "Move" },
  "10170:forced:1 @0 MoveToHero": { note: "Thaurdir's Spite: these heroes tie for the most damage. Choose the hero it moves to.", verb: "Move" },

  // Ruthless (10164:A:4), worded once for every scenario that can deal it.
  ...POOL_BOON_ASKS,
};
