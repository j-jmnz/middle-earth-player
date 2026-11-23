// Rules: rr.the-word-choose, rr.first-player, rr.defending-player (data/rules/entries.json); ledger lines 131061:A:1, 131061:A:2. The choice words of the Misty Mountain Goblins set (131058-131061, 131065, 131070) that name the player who chooses.
// A game reads only its own scenario's asks file, so each scenario that deals the set (Over the Misty Mountains Grim, Dungeons Deep and Caverns Dim) spreads this table into its own; an entry keys a record of a card the set holds.
import type { Ask } from "./asks.ts";

export const MISTY_MOUNTAIN_GOBLINS_ASKS: Readonly<Record<string, Ask>> = {
  // 131061 Goblin Driver. When Revealed: the first player exhausts a character he controls. Shadow: the defending player does.
  "131061:whenRevealed:1 @0 Pick": { owned: true, why: "when revealed,", note: "choose a character you control to exhaust.", verb: "Exhaust" },
  "131061:shadow:1 @0 Pick": { owned: true, why: "as its Shadow effect,", note: "choose a character you control to exhaust.", verb: "Exhaust" },
};
