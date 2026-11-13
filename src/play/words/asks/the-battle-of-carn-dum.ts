import type { Condition } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";
import { DETERMINATION_ASKS, LOOT_BOON_ASKS, POOL_BOON_ASKS } from "../pool-boon-asks.ts";

// The choice words of The Battle of Carn Dûm (angmar-awakened part 8), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-battle-of-carn-dum --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-battle-of-carn-dum` prints each sentence.
// Solo play: Lore of Ancient Arnor returns 2 cards when its controller is the only player (10190:A:1).
const ONLY_PLAYER: Condition = { kind: "less", left: { players: true }, right: 2 };
const LORE_REST = "The rest of your discard pile is shuffled into your deck, and Lore of Ancient Arnor is removed from the game.";

export const ASKS: Readonly<Record<string, Ask>> = {
  // 10137:A:1 (When Revealed): each player distributes damage among the questing characters they control equal to the printed cost of the highest cost card in their own discard pile.
  "10137:whenRevealed:1 @0.0 AssignDamage": { owned: true, note: "Vile Affliction: assign {x} damage, the highest printed cost in your discard pile, among the questing characters you control ({left} left).", bind: { x: { discardPileMaxCost: true } }, verb: "Assign" },

  // 10190:A:1 (Action): each player returns 1 card from their own discard pile to their hand, 2 when they are the only player; the rest of that pile is shuffled into their own deck.
  "10190:action:1 @0.0 Pick": {
    owned: true,
    note: [
      { when: ONLY_PLAYER, text: `Lore of Ancient Arnor: you are the only player, so choose the first of 2 cards from your discard pile to return to your hand. ${LORE_REST}` },
      { text: `Lore of Ancient Arnor: choose 1 card from your discard pile to return to your hand. ${LORE_REST}` },
    ],
    verb: "Return",
  },
  "10190:action:1 @0.2 Pick": { owned: true, note: "Lore of Ancient Arnor: as the only player, choose the second of 2 cards from your discard pile to return.", verb: "Return" },

  // Determination (10172:A:1), Ruthless (10164:A:4), Berelind (10176:A:1) and Laermuin (10179:A:1): the pool boons this scenario can deal, worded once for every scenario that can deal them.
  ...DETERMINATION_ASKS,
  ...POOL_BOON_ASKS,
  ...LOOT_BOON_ASKS,
};
