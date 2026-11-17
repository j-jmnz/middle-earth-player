import type { Ask } from "../asks.ts";

// The choice words of The Hills of Emyn Muil (shadows-of-mirkwood part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-hills-of-emyn-muil --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-hills-of-emyn-muil` prints each sentence.
// Both choices are a player's own: the first player pays the Travel cost from his own hand, and each player answers A Hurrying Darkness for himself.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 02088:A:1 (Travel): the first player chooses the event card he discards from his hand; with none the players cannot travel to Shores of Nen Hithoel.
  "02088:travel:1 @0 Pick": { owned: true, note: "{card}: choose an event card from your hand to discard in order to travel here. Without one the players cannot travel to it.", verb: "Discard" },

  // 900706:A:1 (When Revealed): each player in turn, the first player first, raises his threat by 5 or reveals one more encounter card and adds it to the staging area.
  "900706:whenRevealed:1 @0.0 Choose": { owned: true, note: "{card}: raise your threat by 5, or reveal an additional encounter card and add it to the staging area." },
  "900706:whenRevealed:1 @0.0 threat": { label: "Raise your threat by 5" },
  "900706:whenRevealed:1 @0.0 reveal": { label: "Reveal an additional encounter card" },
};
