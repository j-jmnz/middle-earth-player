import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as STORM } from "../a-storm-on-cobas-haven.ts";
import { AUTHORED_EFFECTS as TEMPLE } from "../temple-of-the-deceived.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for A Journey to Rhosgobel (Shadows of Mirkwood part 3, standalone, no campaign card). Every line is read from the scan ledger (data/printed/shadows-of-mirkwood.json). The players carry the wounded Eagle Wilyador, an objective ally the first
// player controls and the first player token passes on, who suffers 2 damage each round and cannot be healed while Rhosgobel is in the staging area. Athelas (Guarded) is claimed by a hero; stage 3 heals Wilyador 5 for each Athelas the players control
// and the players win only if he is whole. Wilyador leaving play loses the game, and the Eagle-or-ranged enemies' undefended damage goes onto him.
// Rules: rr.guarded, rr.objective-cards, rr.attachment-cards, rr.first-player, rr.forced, rr.response, rr.search, rr.damage, rr.ranged, sotm.ally-objective-wilyador, sotm.removed-from-game (data/rules/entries.json); the MEC03 rulesheet for Wilyador (docs/brief.md, A Journey to Rhosgobel).
const WILYADOR: PickSpec = { type: "character", control: "any", names: ["Wilyador"] };
// An Athelas objective a hero carries: the players control it (the player attachment Athelas, 09011, is not an objective).
const ATHELAS_CLAIMED: PickSpec = { type: "objective", control: "any", names: ["Athelas"], attached: true };
const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const WILYADOR_WHOLE: PickSpec = { ...WILYADOR, damaged: false };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const EXHAUSTED: PickSpec = { type: "character", control: "any", state: "exhausted" };
const WOUNDED: PickSpec = { type: "character", control: "any", damaged: true };
const NO_ATTACHMENTS: PickSpec = { type: "character", control: "any", hasAttachment: { none: true } };
const NOT_UNDEFENDED: Condition = { kind: "not", condition: { kind: "undefended" } };

// "Only Eagle characters or characters with ranged can attack or defend against X. Shadow: If this attack is undefended, the damage must be placed on Wilyador" (02070, 02071).
const flock = (code: string): Effect[] => [
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "eagleOrRangedOnly", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: `${code}:shadow:1`, cardCode: code, lines: [`${code}:A:2`], timing: "shadow", instructions: [{ verb: "UndefendedDamageTo", pick: WILYADOR, character: true, when: { kind: "undefended" } }] },
];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 02060 The Wounded Eagle. Setup: Wilyador and Rhosgobel are already in the staging area (the piles); Wilyador gets 2 damage tokens, placed and not dealt, and the encounter deck is shuffled.
    {
      id: "02060:setup:1",
      cardCode: "02060",
      lines: ["02060:A:1"],
      timing: "setup",
      instructions: [{ verb: "PlaceDamageOn", code: "02064", amount: 2 }, { verb: "ShuffleEncounterDeck" }],
    },
    // 02061 Radagast's Request (stage 2B). Response: after the quest phase begins the first player may place X damage tokens on Wilyador (X is the number of players; placed, so nothing cancels them, and the cost comes first) to look at the top 3 cards of
    // the encounter deck, reveal 1 and discard the other 2. Forced: after a card effect heals Wilyador that card leaves the game (the healed event's other card, from wherever it lies).
    {
      id: "02061:response:1",
      cardCode: "02061",
      lines: ["02061:B:1"],
      timing: "response",
      trigger: "beginningOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "canPick", pick: WILYADOR }] },
      instructions: [
        { verb: "Pick", pick: WILYADOR },
        { verb: "PlaceDamage", amount: { players: true }, card: "picked" },
        { verb: "LookAtTop", count: 3 },
        { verb: "PickEncounter", from: "looked" },
        { verb: "DiscardOtherLooked" },
        { verb: "RevealEncounter" },
      ],
    },
    { id: "02061:forced:1", cardCode: "02061", lines: ["02061:B:2"], timing: "forced", trigger: "healed", subject: WILYADOR, instructions: [{ verb: "RemoveFromGame", card: "other" }] },
    // 02062 Return to Rhosgobel (stage 3, no quest points). When Revealed: 5 wounds are healed from Wilyador for each Athelas objective the players control, one heal for each, as an Athelas heal; then, if he is completely healed the players win,
    // otherwise they lose (a heal that was blocked healed nothing).
    {
      id: "02062:whenRevealed:1",
      cardCode: "02062",
      lines: ["02062:B:1", "02062:B:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Each", pick: ATHELAS_CLAIMED, instructions: [{ verb: "Pick", pick: WILYADOR }, { verb: "Heal", amount: 5, target: "picked", athelas: true }] },
        { verb: "WinGame", when: { kind: "canPick", pick: WILYADOR_WHOLE } },
        { verb: "LoseGame", reason: "Wilyador was not healed", when: { kind: "not", condition: { kind: "canPick", pick: WILYADOR_WHOLE } } },
      ],
    },
    // 02063 Athelas (objective). Guarded. Action: any player exhausts a ready hero he controls to claim it when no card guards it; it is attached to that hero.
    copyLine("12134:A:1", "02063:A:1"),
    {
      id: "02063:action:1",
      cardCode: "02063",
      lines: ["02063:A:2"],
      timing: "action",
      anyPlayer: true,
      condition: { kind: "all", conditions: [IN_STAGING, { kind: "freeOfEncounters" }, { kind: "canPick", pick: READY_HERO }] },
      instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ClaimObjective" }],
    },
    // 02064 Wilyador (objective ally). No player attachments; the first player's ally from Setup on, passing with the token (`follows`). Forced: 2 damage at the end of each round. At most 5 wounds healed by one effect; if he leaves play (destroyed,
    // eliminated with his controller, removed) the players lose.
    {
      id: "02064:constant:1",
      cardCode: "02064",
      lines: ["02064:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "noPlayerAttachments", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ControlledBy", who: "firstPlayer", card: "self", intoPlay: true, follows: true }],
    },
    { id: "02064:forced:1", cardCode: "02064", lines: ["02064:A:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "DamageCard", amount: 2, target: "self" }] },
    {
      id: "02064:constant:2",
      cardCode: "02064",
      lines: ["02064:A:3"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "healCapPerEffect", amount: 5, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "lossOnLeavingPlay", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    // 02065 Rhosgobel. Threat X (the number of players). While in the staging area Wilyador cannot be healed. Travel: not until stage 1 is complete.
    copyLine("110077:A:1", "02065:A:1"),
    { id: "02065:constant:2", cardCode: "02065", lines: ["02065:A:2"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotBeHealed", amount: 1, until: "whileSourceInPlay", holders: WILYADOR }] },
    // The Travel line has no cost to pay: the players may not travel here until stage 1 is complete, a rule the engine checks while the card is in play (a constant, which names the card's constant line: the check allows no other; as 18033:A:3).
    { id: "02065:travel:1", cardCode: "02065", lines: ["02065:A:3"], timing: "travel", instructions: [] },
    { id: "02065:constant:3", cardCode: "02065", lines: ["02065:A:2"], timing: "constant", condition: { kind: "onStage", stage: 1 }, instructions: [{ verb: "Restrict", what: "travel" }] },
    // 02066 Forest Grove. Response: after the players explore it (in the staging area or as the active location), an Athelas from the encounter deck or its discard pile is added to the staging area (not revealed, so not guarded); the deck is shuffled.
    ...(["activeExplored", "locationExplored"] as const).map(
      (trigger, at): Effect => ({
        id: `02066:response:${at + 1}`,
        cardCode: "02066",
        lines: ["02066:A:1"],
        timing: "response",
        trigger,
        subject: "self",
        instructions: [{ verb: "SearchMove", code: "02063", to: "staging" }, { verb: "ShuffleEncounterDeck" }],
      }),
    ),
    // 02067 Exhaustion. 2 damage to each exhausted character (Wilyador too); shadow: 1.
    { id: "02067:whenRevealed:1", cardCode: "02067", lines: ["02067:A:1"], timing: "whenRevealed", instructions: [{ verb: "DamageEach", amount: 2, pick: EXHAUSTED }] },
    { id: "02067:shadow:1", cardCode: "02067", lines: ["02067:A:2"], timing: "shadow", instructions: [{ verb: "DamageEach", amount: 1, pick: EXHAUSTED }] },
    // 02068 Swarming Insects. 1 damage to each character with no attachment (a claimed Athelas is one). Shadow: the character with more damage than each other character takes 3 more (a tie for the most: none).
    { id: "02068:whenRevealed:1", cardCode: "02068", lines: ["02068:A:1"], timing: "whenRevealed", instructions: [{ verb: "DamageEach", amount: 1, pick: NO_ATTACHMENTS }] },
    {
      id: "02068:shadow:1",
      cardCode: "02068",
      lines: ["02068:A:2"],
      timing: "shadow",
      instructions: [{ verb: "Pick", pick: { type: "character", control: "any", soleMostDamaged: true } }, { verb: "DamageCard", amount: 3, target: "picked", when: { kind: "canPick", pick: { type: "character", control: "any", soleMostDamaged: true } } }],
    },
    // 02069 Festering Wounds. 2 damage to each wounded character; shadow: 1, or 2 when the attack is undefended.
    { id: "02069:whenRevealed:1", cardCode: "02069", lines: ["02069:A:1"], timing: "whenRevealed", instructions: [{ verb: "DamageEach", amount: 2, pick: WOUNDED }] },
    {
      id: "02069:shadow:1",
      cardCode: "02069",
      lines: ["02069:A:2"],
      timing: "shadow",
      instructions: [{ verb: "DamageEach", amount: 1, pick: WOUNDED, when: NOT_UNDEFENDED }, { verb: "DamageEach", amount: 2, pick: WOUNDED, when: { kind: "undefended" } }],
    },
    // 02070 Mirkwood Flock and 02071 Black Forest Bats.
    ...flock("02070"),
    ...flock("02071"),
  ],
  { pool: [...STORM, ...TEMPLE] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
