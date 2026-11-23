// Rules: rr.the-word-choose, rr.first-player, rr.defending-player (data/rules/entries.json); ledger lines 131061:A:1, 131061:A:2, 131070:A:1. The choice words of the Misty Mountain Goblins set (131058-131061, 131065, 131070) that name the player who chooses.
// A game reads only its own scenario's asks file, so each scenario that deals the set (Over the Misty Mountains Grim, Dungeons Deep and Caverns Dim) spreads this table into its own; an entry keys a record of a card the set holds.
import type { Ask } from "./asks.ts";

export const MISTY_MOUNTAIN_GOBLINS_ASKS: Readonly<Record<string, Ask>> = {
  // 131061 Goblin Driver. When Revealed: the first player exhausts a character he controls. Shadow: the defending player does.
  "131061:whenRevealed:1 @0 Pick": { owned: true, note: "{card}: choose a character you control to exhaust.", verb: "Exhaust" },
  "131061:shadow:1 @0 Pick": { owned: true, note: "{card}: choose a character you control to exhaust.", verb: "Exhaust" },

  // 131070:A:1 (Grip, Grab! Pinch, Nab!): starting with the first player, each player chooses 1 Goblin enemy from the encounter discard pile and adds it to the staging area.
  "131070:whenRevealed:1 @0.0 Pick": { owned: true, note: "Grip, Grab! Pinch, Nab!: choose a Goblin enemy from the encounter discard pile to add to the staging area.", verb: "Add" },
};
