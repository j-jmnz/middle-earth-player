import type { Ask } from "../asks.ts";

// The choice words of the picks the engine asks in the-ghost-of-framsburg: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-ghost-of-framsburg --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-ghost-of-framsburg` prints each sentence.
// The first player answers for the group at a tie, so those sentences are not owned (the sheet adds who chooses).
export const ASKS: Readonly<Record<string, Ask>> = {
  "19102:forced:1 @0 Discover": { note: "{card}, Discover 4: look at the top 4 cards of the encounter deck. Choose 1 looked-at Loot objective to attach to it as a guarded objective. A looked-at Hazard card is revealed, and the rest are discarded.", verb: "Attach" },
  "19103:forced:1 @0 Discover": { note: "{card}: Discover {x}, the tens digit of the first player's threat. Look at the top {x} cards of the encounter deck. Choose 1 looked-at Loot objective to attach to it as a guarded objective. A looked-at Hazard card is revealed, and the rest are discarded.", verb: "Attach", bind: { x: { firstPlayerTens: true } } },
  "19104:forced:1 @0 Discover": { note: "{card}, Discover 2: look at the top 2 cards of the encounter deck. Choose 1 looked-at Loot objective to attach to it as a guarded objective. A looked-at Hazard card is revealed, and the rest are discarded.", verb: "Attach" },
  "19105:forced:1 @0 Discover": { note: "{card}, Discover 3: look at the top 3 cards of the encounter deck. Choose 1 looked-at Loot objective to attach to it as a guarded objective. A looked-at Hazard card is revealed, and the rest are discarded.", verb: "Attach" },
  "19106:whenRevealed:1 @0.0 ResolveDiscover": { owned: true, note: "{card}: resolve the Discover keyword of the active location. Choose 1 looked-at Loot objective to attach to it as a guarded objective.", verb: "Attach" },
};
