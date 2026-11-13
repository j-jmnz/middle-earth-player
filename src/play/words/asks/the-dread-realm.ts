import type { Ask } from "../asks.ts";
import { DETERMINATION_ASKS, LOOT_BOON_ASKS, POOL_BOON_ASKS } from "../pool-boon-asks.ts";

// The choice words of The Dread Realm (angmar-awakened part 9), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-dread-realm --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-dread-realm` prints each sentence.
// The first player answers for the group at Daechanar's Forced, the Wraith's attach and the Altar's either/or, so those sentences are not owned and the sheet adds who chooses; the rows of a pick that spans players name the owner of their card. Dark Halls is the defending player's own choice from their own discard pile.
const DEAD = "a facedown Undead enemy engaged with you, 2 Attack, 2 Defense, 2 hit points"

export const ASKS: Readonly<Record<string, Ask>> = {
  // 10153:A:3 (Forced when Daechanar is damaged with a Sorcery card in play): all that damage is canceled and the first player removes a Sorcery card in play from the game.
  "10153:forced:1 @1 Pick": { note: "Daechanar: the damage is canceled. Choose a Sorcery card in play, any player's, to remove from the game. It is not discarded, and Daechanar takes damage again once none is left.", verb: "Remove" },

  // 10154:A:2 (Forced at the end of the staging step): the first player reveals 1 additional encounter card or reanimates the top card of their deck (offered only when the deck holds one).
  "10154:forced:1 @0 Choose": { owned: true, note: "Altar of Midwinter: reveal 1 additional card from the encounter deck, or reanimate the top card of your deck." },
  "10154:forced:1 @0 reveal": { label: "Reveal 1 additional card from the encounter deck" },
  "10154:forced:1 @0 reanimate": { label: `Reanimate the top card of your deck as ${DEAD}` },

  // 101157:A:1 (Forced when Wraith of Carn Dûm leaves play): the first player attaches it to a character in play, any player's.
  "101157:forced:1 @0 Pick": { note: "Wraith of Carn Dûm leaves play: choose a hero or ally in play, any player's, to attach it to. That character gets -1 Willpower, -1 Attack and -1 Defense, and the Wraith returns to the staging area when it leaves play.", verb: "Attach" },

  // 101160:A:2 (Shadow): the defending player reanimates a copy of the defending character from their own discard pile and deals it 1 shadow card.
  "101160:shadow:1 @0 Pick": { owned: true, note: `Dark Halls: choose a copy of the defending character in your discard pile. It comes back as ${DEAD}, with 1 shadow card.`, verb: "Reanimate" },

  // Determination (10172:A:1), Ruthless (10164:A:4), Berelind (10176:A:1) and Laermuin (10179:A:1): the pool boons this scenario can deal, worded once for every scenario that can deal them.
  ...DETERMINATION_ASKS,
  ...POOL_BOON_ASKS,
  ...LOOT_BOON_ASKS,
};
