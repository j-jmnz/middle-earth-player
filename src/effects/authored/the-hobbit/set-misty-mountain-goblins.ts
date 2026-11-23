import type { Effect } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as OATH } from "../the-oath.ts";
import { copyLine, withCopies } from "../reprint.ts";

// The Misty Mountain Goblins encounter set (131058-131061, 131065, 131070): Over the Misty Mountains Grim deals it in its second deck and Dungeons Deep and Caverns Dim deals it too, so its records live in a file of their own, which the-hobbit.ts (the box's file, in the barrel) spreads.
// Readings: docs/scenarios/the-hobbit.md (Over the Misty Mountains Grim). Rules: rr.in-play-and-out-of-play, rr.active-location, rr.defending-player, rr.engaged, rr.first-player, rr.damage, rr.discard-pile-and-victory-display (data/rules/entries.json).
const CAVE_IN_PLAY = { type: "location", control: "any", trait: "Cave", staging: true } as const;
const GOBLIN_ENGAGED_WITH_YOU = { type: "enemy", control: "any", trait: "Goblin", engaged: "you" } as const;
const GOBLIN_FROM_DISCARD = { type: "enemy", control: "any", trait: "Goblin", from: "encounterDiscard" } as const;

export const MISTY_MOUNTAIN_GOBLINS_EFFECTS: readonly Effect[] = withCopies(
  [
    // 131058 Goblin Axeman. +1 Attack for each Cave location in play (the staging area and the active location).
    { id: "131058:constant:1", cardCode: "131058", lines: ["131058:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: CAVE_IN_PLAY }, until: "whileSourceInPlay", target: "self" }] },
    { id: "131058:shadow:1", cardCode: "131058", lines: ["131058:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: -1, until: "endOfAttack", target: "defender" }] },
    // 131059 Goblin Miners. +1 Defense for each Cave location in play.
    { id: "131059:constant:1", cardCode: "131059", lines: ["131059:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "defense", amount: { count: CAVE_IN_PLAY }, until: "whileSourceInPlay", target: "self" }] },
    // 131060 Goblin Runners. Surge is a template; the Shadow is the Shadow of 41021.
    copyLine("41021:A:2", "131060:A:2"),
    // 131061 Goblin Driver. The first player exhausts a character he controls; the defending player does for the Shadow.
    {
      id: "131061:whenRevealed:1",
      cardCode: "131061",
      lines: ["131061:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready", who: "firstPlayer" } }, { verb: "Exhaust", target: { kind: "picked" } }],
    },
    {
      id: "131061:shadow:1",
      cardCode: "131061",
      lines: ["131061:A:2"],
      timing: "shadow",
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }],
    },
    // 131065 The Goblins' Caves.
    {
      id: "131065:constant:1",
      cardCode: "131065",
      lines: ["131065:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", trait: "Goblin", staging: true } }],
    },
    { id: "131065:shadow:1", cardCode: "131065", lines: ["131065:A:2"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: { count: GOBLIN_ENGAGED_WITH_YOU }, who: "actor" }] },
    // 131070 Grip, Grab! Pinch, Nab! Each player in turn chooses a Goblin enemy of the discard pile (none: nothing); the Shadow deals the damage among the defending player's characters.
    {
      id: "131070:whenRevealed:1",
      cardCode: "131070",
      lines: ["131070:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: GOBLIN_FROM_DISCARD }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }] }],
    },
    { id: "131070:shadow:1", cardCode: "131070", lines: ["131070:A:2"], timing: "shadow", instructions: [{ verb: "AssignDamage", amount: { count: GOBLIN_ENGAGED_WITH_YOU }, pick: { type: "character", control: "you" } }] },
  ],
  { pool: OATH },
);
