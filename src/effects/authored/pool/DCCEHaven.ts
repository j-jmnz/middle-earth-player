import type { Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { copyLines, withCopies } from "../reprint.ts";

// Records for the cards A Storm on Cobas Haven's campaign card (11209) sets aside or puts into play: Gavin (11210) and the four Send for Help events (11211 to 11214), read from the scan ledger
// (data/printed/dream-chaser.json). Rules: dcce.encounter-cards, dcce.campaign-setup-a-storm-on-cobas-haven, rr.search, rr.play-and-put-into-play (data/rules/entries.json). Gavin's When Revealed is in DCCE.ts.
//
// The Upgraded sides of the Send for Help events are in none of the sources (docs/phases/STATUS.md; the ledger has side A only, NO_UPGRADED_SIDE in rules/families/dreamchaser/facts.ts), so no XP row buys them and
// the clause "If Send for Help (...) is upgraded, ..." never applies: the records write the base effect and no clause for it.

// The top 10 cards of the searching player's own deck (ActAs: the picked player's deck).
const TOP_TEN: PickSpec = { type: "card", control: "you", from: "deck", top: 10 };

// 11211 Send for Help (Leadership). When Revealed: the revealing player chooses a player, who searches the top 10 cards of their deck for a card and draws it or plays it at no cost (an event, an ally or an attachment;
// the cards the player cannot play are not offered to the second), then shuffles that deck. Send for Help leaves the game.
const SEARCH_AND_DRAW_OR_PLAY: Effect["instructions"] = [
  { verb: "Pick", pick: { type: "player", control: "any" } },
  { verb: "ActAs", who: "pickedPlayer" },
  {
    verb: "Choose",
    who: "actor",
    options: [
      { id: "draw", requires: { kind: "canPick", pick: TOP_TEN }, instructions: [{ verb: "Pick", pick: TOP_TEN }, { verb: "MovePicked", to: "hand" }] },
      { id: "play", requires: { kind: "canPick", pick: TOP_TEN }, instructions: [{ verb: "PlayFrom", pick: TOP_TEN, free: true }] },
    ],
  },
  { verb: "ShuffleDeck" },
  { verb: "ActAs", who: "actor" },
  { verb: "RemoveSourceFromGame" },
];

export const RECORDS: readonly Effect[] = withCopies([
  // 11210 Gavin. "When Gavin leaves play (other than by his ability), remove him from the game": his only ability moves him to the encounter deck, so he is removed unless that is where he went.
  { id: "11210:triggered:1", cardCode: "11210", lines: ["11210:A:3"], timing: "triggered", trigger: "leftPlay", subject: "self", condition: { kind: "not", condition: { kind: "sourceIn", zone: "encounterDeck" } }, instructions: [{ verb: "RemoveSourceFromGame" }] },
  // "Planning Action: Shuffle Gavin and 1 random set-aside Send for Help into the encounter deck."
  { id: "11210:action:1", cardCode: "11210", lines: ["11210:A:4"], timing: "action", condition: { kind: "phase", is: "Planning" }, instructions: [{ verb: "ShuffleRandomSetAside", name: "Send for Help" }, { verb: "ShuffleSelfIntoEncounterDeck" }] },

  { id: "11211:whenRevealed:1", cardCode: "11211", lines: ["11211:A:2"], timing: "whenRevealed", instructions: SEARCH_AND_DRAW_OR_PLAY as Instruction[] },
  // "Shadow: Resolve this card's when revealed effect." (the four cards print it)
  { id: "11211:shadow:1", cardCode: "11211", lines: ["11211:A:3"], timing: "shadow", instructions: [{ verb: "ResolveWhenRevealed", card: "self" }] },
  copyLines("11211", "11212", "A:3"),
  copyLines("11211", "11213", "A:3"),
  copyLines("11211", "11214", "A:3"),
]);

export const REPLACES: readonly string[] = [];
