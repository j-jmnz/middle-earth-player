import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";


// The Hunt for Gollum Nightmare (deck 9004, data/printed/nightmare.json). The Signs of Gollum are the four Clue objectives (src/effects/authored/shadows-of-mirkwood/the-hunt-for-gollum.ts). A Clue "attached to" a Mordor enemy is an objective the
// enemy guards (rr.guarded: the enemy is attached to the objective and both stay in the staging area; the objectives family's AttachGuard), so the Clue counts there for the Hunters from Mordor and for the loss at four. The Nightmare cards:
// Ravenous Hawk jumps out of the cards a card effect looks at (the encounter family's `lookedAt`), Hunting Warg fetches Hunters from Mordor, Watched Path bars draws through card effects for a player with no Clue.
// Rules: rr.guarded, rr.forced, rr.first-player, rr.search, rr.attachment-cards (data/rules/entries.json).
const CLUE: PickSpec = { type: "objective", control: "any", trait: "Clue" };
const CLUE_GUARDED_BY_MORDOR: PickSpec = { ...CLUE, guardedByTrait: "Mordor" };
const UNCLAIMED_CLUE: PickSpec = { ...CLUE, stagingOnly: true, notGuardedByTrait: "Mordor", who: "firstPlayer" };
const CLAIMED_CLUE: PickSpec = { ...CLUE, controlled: true, who: "firstPlayer" };
// A Mordor enemy in play (in the staging area or engaged) that guards nothing yet.
const FREE_MORDOR_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Mordor", staging: true, isGuard: false };
const MORDOR_ENEMY: PickSpec = { ...FREE_MORDOR_ENEMY, who: "firstPlayer" };
const A_MORDOR_ENEMY: Condition = { kind: "canPick", pick: FREE_MORDOR_ENEMY };
const NO_CLUE_YOU: Condition = { kind: "not", condition: { kind: "canPick", pick: { type: "objective", control: "you", trait: "Clue" } } };
const HAS_GUARD: PickSpec = { type: "objective", control: "any", hasGuard: true };
const NOT_ATTACHED: Condition = { kind: "not", condition: { kind: "matches", card: "picked", pick: HAS_GUARD } };
// The card found in the discard pile is attached to a Mordor enemy in play, if able (the enemy keeps any engagement).
const ATTACH_FROM_DISCARD = [
  { verb: "Pick", pick: FREE_MORDOR_ENEMY },
  { verb: "SearchMove", type: "objective", trait: "Clue", discardOnly: true, to: "staging", remember: true, when: A_MORDOR_ENEMY },
  { verb: "AttachGuard", guard: "previous", to: "picked", stayEngaged: true },
] as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 900401 The Hunt for Gollum Nightmare (setup card, side A). At the end of the refresh phase the first player chooses an unclaimed Clue not guarded by a Mordor enemy and a Mordor enemy in play: the enemy guards it, the cards that guarded it stay in the
  // staging area, and an engaged enemy stays engaged. With four Clues guarded by Mordor enemies the players lose.
  {
    id: "900401:forced:1",
    cardCode: "900401",
    lines: ["900401:A:2"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "phase", is: "Refresh" },
    instructions: [{ verb: "Pick", pick: UNCLAIMED_CLUE }, { verb: "Pick", pick: MORDOR_ENEMY }, { verb: "AttachGuard", guard: "picked", to: "previous", replaceGuards: true, stayEngaged: true }],
  },
  {
    id: "900401:constant:1",
    cardCode: "900401",
    lines: ["900401:A:3"],
    timing: "constant",
    condition: { kind: "count", pick: CLUE_GUARDED_BY_MORDOR, min: 4 },
    instructions: [{ verb: "LoseGame", reason: "Four Signs of Gollum are in the hands of the Mordor hunters" }],
  },
  // 900402 Ravenous Hawk: when a card effect looks at cards of the encounter deck and it is among them, it comes into play engaged with the player looking (it is not one of the cards the effect goes on with).
  { id: "900402:forced:1", cardCode: "900402", lines: ["900402:A:1"], timing: "forced", trigger: "lookedAt", subject: "self", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "engaged" }] },
  // 900403 Hunting Warg: it notes that it entered play this round; at the beginning of the refresh phase it fetches Hunters from Mordor, if it entered play this round and is still in play, and the encounter deck is shuffled.
  {
    id: "900403:forced:2",
    cardCode: "900403",
    lines: ["900403:A:1"],
    timing: "forced",
    trigger: "encounterEnteredPlay",
    subject: "self",
    instructions: [{ verb: "ModifyStat", stat: "enteredThisRound", amount: 1, until: "endOfRound", target: "self" }],
  },
  {
    id: "900403:forced:1",
    cardCode: "900403",
    lines: ["900403:A:1"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Refresh" }, { kind: "flag", stat: "enteredThisRound", holder: "self" }] },
    instructions: [{ verb: "SearchMove", code: "02021", to: "staging" }, { verb: "ShuffleEncounterDeck" }],
  },
  // 900404 Watched Path: a player who controls no Clue card cannot draw cards through card effects; as a shadow card, with no Clue, the whole hand is discarded.
  { id: "900404:constant:1", cardCode: "900404", lines: ["900404:A:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "draw", unlessControls: { type: "objective", control: "you", trait: "Clue" } }] },
  { id: "900404:shadow:1", cardCode: "900404", lines: ["900404:A:2"], timing: "shadow", instructions: [{ verb: "DiscardHand", when: NO_CLUE_YOU }] },
  // 900405 Hunter's Lookout: each Mordor enemy guarding a Clue gets +2 Defense. Shadow: the attacker gets +1 Defense for each Clue card in play until the end of the round.
  {
    id: "900405:constant:1",
    cardCode: "900405",
    lines: ["900405:A:1"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", trait: "Mordor", staging: true, guardsTrait: "Clue" } }],
  },
  { id: "900405:shadow:1", cardCode: "900405", lines: ["900405:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: { count: CLUE }, until: "endOfRound", target: "attacker" }] },
  // 900406 Dark Pools: no progress on it in the staging area; after it becomes the active location each player discards the ally with the highest printed cost among those he controls (the owner chooses among a tie).
  { id: "900406:constant:1", cardCode: "900406", lines: ["900406:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "900406:forced:1",
    cardCode: "900406",
    lines: ["900406:A:2"],
    timing: "forced",
    trigger: "becameActive",
    subject: "self",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "ally", control: "you", highestCost: true } }, { verb: "DiscardPicked" }] }],
  },
  // 900407 The Enemy's Trail: a Clue card from the encounter discard pile is attached to a Mordor enemy in play (the first player chooses the enemy; as a shadow card the defending player does), if able; when revealed, Surge if none was attached.
  {
    id: "900407:whenRevealed:1",
    cardCode: "900407",
    lines: ["900407:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Pick", pick: MORDOR_ENEMY }, ATTACH_FROM_DISCARD[1], ATTACH_FROM_DISCARD[2], { verb: "GainSurge", when: NOT_ATTACHED }],
  },
  { id: "900407:shadow:1", cardCode: "900407", lines: ["900407:A:2"], timing: "shadow", instructions: [...ATTACH_FROM_DISCARD] },
  // 900408 Restless Hunters (Surge): the first player takes a Clue off a hero and attaches it to a Mordor enemy in play, if able. Shadow: an undefended attack's damage goes on a hero with a Clue attached, if the defending player has one.
  {
    id: "900408:whenRevealed:1",
    cardCode: "900408",
    lines: ["900408:A:2"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: MORDOR_ENEMY },
      { verb: "Pick", pick: CLAIMED_CLUE, when: A_MORDOR_ENEMY },
      { verb: "MoveEncounterCard", card: "picked", to: "staging", when: A_MORDOR_ENEMY },
      { verb: "AttachGuard", guard: "previous", to: "picked", stayEngaged: true, when: A_MORDOR_ENEMY },
    ],
  },
  { id: "900408:shadow:1", cardCode: "900408", lines: ["900408:A:3"], timing: "shadow", instructions: [{ verb: "UndefendedDamageTo", pick: { type: "hero", control: "you", hasAttachment: { trait: "Clue" } } }] },
  // 900409 The Trail Goes Cold: attached to the active location (Limit 1 per location) with all its progress removed; the attached location contributes its Threat as if it were in the staging area. Surge when it does not attach.
  {
    id: "900409:whenRevealed:1",
    cardCode: "900409",
    lines: ["900409:A:1", "900409:A:2"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { type: "location", control: "any", active: true } },
      { verb: "AttachSelfToPicked" },
      { verb: "RemoveAllProgress", target: "picked", when: { kind: "matches", card: "self", pick: { type: "attachment", control: "any" } } },
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "matches", card: "self", pick: { type: "attachment", control: "any" } } } },
    ],
  },
  {
    id: "900409:constant:1",
    cardCode: "900409",
    lines: ["900409:A:1"],
    timing: "constant",
    instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "activeThreat", amount: 1, until: "whileSourceInPlay", target: "host" }],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
