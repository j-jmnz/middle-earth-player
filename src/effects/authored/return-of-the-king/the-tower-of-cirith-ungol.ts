import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as SIEGE } from "./the-siege-of-gondor.ts";
import { AUTHORED_EFFECTS as PELENNOR } from "./the-battle-of-the-pelennor-fields.ts";
import { AUTHORED_EFFECTS as PASSING } from "./the-passing-of-the-grey-company.ts";
import { AUTHORED_EFFECTS as CROSS_ROADS } from "../journey-to-the-cross-roads.ts";
import { AUTHORED_EFFECTS as FIRE } from "../fire-in-the-night.ts";
import { AUTHORED_EFFECTS as OATH } from "../the-oath.ts";
import { AUTHORED_EFFECTS as URUK_HAI } from "../the-uruk-hai.ts";
import { copyLine, withCopies } from "../reprint.ts";
import { DISCARD_UNTIL_ENEMY_OR_COPY, LAST_OF_THE_COMPANY, ONE_RING, SHAGRAT, STAGED_ENEMIES, WATCHERS_LOCATION, WATCHERS_ENEMY, type Cond } from "./cirith-ungol/shared.ts";
import { STAGE_RECORDS } from "./cirith-ungol/stages.ts";
import { EACH_PLAYER } from "./pelennor/shared.ts";

// Records for The Tower of Cirith Ungol (the-return-of-the-king part 4, campaign card 146069, whose Setup, Forced and Resolution records are in the-return-of-the-king.ts): Last of the Company, the locations, Shagrat and the Orcs of Mordor, the treacheries and The Two Watchers' two sides;
// the quest stages are in return-of-the-king/cirith-ungol/stages.ts. The cards the quest card's piles place or set aside (Shagrat, Topmost Chamber, The Two Watchers, Last of the Company) are dealt by the data; no record places them. Every line is read from the scan ledger
// (data/printed/the-return-of-the-king.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. See docs/brief.md, The Return of the King, for each reading.
// Rules: mec113.setup-the-tower-of-cirith-ungol, mec113.setting-up-the-game, mec113.the-one-ring, mec113.saga-staging-rules, mec113.immune-to-player-card-effects, mec113.peril, mec113.archery, mec113.fellowship-sphere-heroes, rr.guarded, rr.objective-cards, rr.effects, rr.then, rr.lasting-effects,
// rr.travel, rr.active-location, rr.staging, rr.engaged, rr.damage, rr.attachment-cards, faq.lasting-effects, faq.additional-attacks, faq.triggering-forced-effects, faq.last-encounter-card, faq.progress-without-advancing (data/rules/entries.json).
const RING_READY: Cond = { kind: "exhausted", code: ONE_RING, is: false };
const MY_CHARACTER: PickSpec = { type: "character", control: "you" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const QUESTING_CHARACTER: PickSpec = { type: "character", control: "you", committed: true };
const ANY_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 146014 Last of the Company (an objective attached to a hero in Setup). The attached hero gains the Ring-bearer trait and the Fellowship sphere, and the first player token never leaves its player. Action: exhaust The One Ring and raise your threat by 1 to choose an enemy: until the
    // end of the phase it gets -X Threat, X the attached hero's Willpower as it resolves (a lasting effect of an encounter card read once, faq.lasting-effects). The enemy may be in the staging area or engaged.
    {
      id: "146014:constant:1",
      cardCode: LAST_OF_THE_COMPANY,
      lines: ["146014:A:1"],
      timing: "constant",
      instructions: [
        { verb: "GrantTrait", trait: "Ring-bearer" },
        { verb: "GrantIcon", sphere: "fellowship" },
        { verb: "ModifyStat", stat: "firstPlayerLocked", amount: 1, until: "whileSourceInPlay", target: "table" },
      ],
    },
    {
      id: "146014:action:1",
      cardCode: LAST_OF_THE_COMPANY,
      lines: ["146014:A:2"],
      timing: "action",
      condition: { kind: "all", conditions: [RING_READY, { kind: "canPick", pick: ANY_ENEMY }] },
      instructions: [
        { verb: "Exhaust", target: { kind: "byCode", code: ONE_RING } },
        { verb: "RaiseThreat", amount: 1, who: "actor" },
        { verb: "Pick", pick: ANY_ENEMY },
        { verb: "ModifyStat", stat: "threat", amount: { stat: "willpower", of: "host", negative: true }, until: "endOfPhase", target: "picked" },
      ],
    },

    // 146015 Topmost Chamber (Immune is a keyword). The players cannot travel here until stage 2B holds 18 progress (stage 1 holds none that counts, faq.progress-without-advancing). Travel: Shagrat, set aside in Setup, is added to the staging area; with him in play already nothing is added.
    {
      id: "146015:constant:1",
      cardCode: "146015",
      lines: ["146015:A:2"],
      timing: "constant",
      condition: { kind: "not", condition: { kind: "stageProgress", min: 18 } },
      instructions: [{ verb: "Restrict", what: "travel" }],
    },
    {
      id: "146015:constant:2",
      cardCode: "146015",
      lines: ["146015:A:2"],
      timing: "constant",
      condition: { kind: "stageReached", code: "146067", is: false },
      instructions: [{ verb: "Restrict", what: "travel" }],
    },
    { id: "146015:travel:1", cardCode: "146015", lines: ["146015:A:3"], timing: "travel", instructions: [{ verb: "AddSetAsideToStaging", code: SHAGRAT }] },

    // 146016 Echoing Passage. +1 Threat for each enemy in the staging area (the Watchers' enemy side counts). While it is the active location each enemy gets +2 Defense.
    { id: "146016:constant:1", cardCode: "146016", lines: ["146016:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: STAGED_ENEMIES }, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "146016:constant:2",
      cardCode: "146016",
      lines: ["146016:A:2"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true } }],
    },

    // 146017 Bloodied Courtyard. While it is the active location: after an enemy enters the staging area it takes 1 damage. Travel (copied from Haunted Path): raise each player's threat by 1.
    {
      id: "146017:forced:1",
      cardCode: "146017",
      lines: ["146017:A:1"],
      timing: "forced",
      trigger: "addedToStaging",
      subject: { type: "enemy", control: "any" },
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "DamageCard", amount: 1, target: "subject" }],
    },
    copyLine("145021:A:2", "146017:A:2"),

    // 146018 Winding Stairs. While it is the active location each enemy in the staging area gets +10 engagement cost. Travel: each player exhausts a character he controls.
    {
      id: "146018:constant:1",
      cardCode: "146018",
      lines: ["146018:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: 10, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true } }],
    },
    { id: "146018:travel:1", cardCode: "146018", lines: ["146018:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }])] },

    // 146019 Torch-lit Hall. After the players travel here: cards are discarded from the top of the encounter deck until an enemy is discarded; a copy of it in the staging area is discarded too, else it is added to the staging area (not revealed).
    { id: "146019:forced:1", cardCode: "146019", lines: ["146019:A:1"], timing: "forced", trigger: "traveled", subject: "self", instructions: DISCARD_UNTIL_ENEMY_OR_COPY },

    // 146020 Shagrat. Only boons may be attached to him; he takes no non-combat damage. Allies can neither attack nor defend against him. After progress is placed on the quest he gets -X engagement cost until the end of the round, X the progress just placed (never below 0).
    {
      id: "146020:constant:1",
      cardCode: SHAGRAT,
      lines: ["146020:A:1"],
      timing: "constant",
      instructions: [{ verb: "Restrict", what: "attach", exceptBoon: true }, { verb: "ModifyStat", stat: "cannotTakeNonCombatDamage", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "146020:constant:2",
      cardCode: SHAGRAT,
      lines: ["146020:A:2"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "alliesCannotAttack", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "Restrict", what: "defend", allies: true }],
    },
    {
      id: "146020:forced:1",
      cardCode: SHAGRAT,
      lines: ["146020:A:3"],
      timing: "forced",
      trigger: "progressPlaced",
      subject: { type: "card", control: "any", names: ["Pass the Two Watchers", "Fighting in the Tower", "Escape from Cirith Ungol"] },
      instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: { x: true }, subtract: true, until: "endOfRound", target: "self" }],
    },

    // 146021 Gorbag (A:1, Cannot have attachments, is a keyword; A:4 is a template). Forced: after he engages you he makes an immediate attack (copied from Haradrim Soldier). Shadow: an additional attack against you after this one (copied from The Dragon's Fury).
    copyLine("144057:A:1", "146021:A:2"),
    copyLine("19081:A:2", "146021:A:3"),

    // 146022 Wounded Uruk. It enters play with 2 damage on it (staged, engaged or revealed). Forced: after it engages you it gets +2 Attack until the end of the round. Shadow: the attacking enemy gets +1 Attack for each damage on it as the attack is made.
    { id: "146022:triggered:1", cardCode: "146022", lines: ["146022:A:1"], timing: "triggered", trigger: "encounterEnteredPlay", subject: "self", instructions: [{ verb: "PlaceDamage", amount: 2 }] },
    { id: "146022:forced:1", cardCode: "146022", lines: ["146022:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfRound", target: "self" }] },
    { id: "146022:shadow:1", cardCode: "146022", lines: ["146022:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "damage", of: "attacker" }, until: "endOfAttack", target: "attacker" }] },

    // 146023 Orcish Howls (Surge is a keyword on its own line). When Revealed: with no enemy in the staging area it gains surge (read before the damage); each enemy in the staging area takes 1 damage; until the end of the phase each enemy gets +1 Threat for each damage on it,
    // read live and for an enemy that arrives later (the flag threatPerDamage). Shadow: if you are engaged with another enemy the attack is resolved against that enemy (chosen by the defending player), which takes the damage after its Defense.
    {
      id: "146023:whenRevealed:1",
      cardCode: "146023",
      lines: ["146023:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "GainSurge", when: { kind: "count", pick: STAGED_ENEMIES, max: 0 } },
        { verb: "Each", pick: STAGED_ENEMIES, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }] },
        { verb: "ModifyStat", stat: "threatPerDamage", amount: 1, until: "endOfPhase", target: "enemies" },
      ],
    },
    {
      id: "146023:shadow:1",
      cardCode: "146023",
      lines: ["146023:A:2"],
      timing: "shadow",
      condition: { kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you", attackingEnemy: false } },
      instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", engaged: "you", attackingEnemy: false } }, { verb: "ResolveAttackAgainst" }],
    },

    // 146058 Orc of Mordor. Forced: after it engages you exhaust a character you control (copied from Great Spider). Shadow: exhaust a character you control (copied from Driven to the Brink).
    copyLine("41009:A:1", "146058:A:2"),
    copyLine("145042:A:3", "146058:A:3"),

    // 146059 Snaga Archer. Forced: after it engages you, 2 damage to one character you control. Shadow: +1 Attack, +2 instead when the defending character is damaged.
    { id: "146059:forced:1", cardCode: "146059", lines: ["146059:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Pick", pick: MY_CHARACTER }, { verb: "DamageCard", amount: 2, target: "picked" }] },
    {
      id: "146059:shadow:1",
      cardCode: "146059",
      lines: ["146059:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } } } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } } },
      ],
    },

    // 146060 Uruk Soldier. Forced: after it engages you raise your threat by 2. Shadow: +1 Attack, and a character it destroys sends it back to the staging area (copied from Saruman's Orders).
    { id: "146060:forced:1", cardCode: "146060", lines: ["146060:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eventSeat" }] },
    copyLine("143067:A:2", "146060:A:2"),

    // 146061 Drawn to the Ring. When Revealed: the first player chooses either to exhaust The One Ring (while it is ready) and reveal an encounter card, or to discard from the top of the encounter deck until an enemy is discarded and put it into play engaged with him (while an enemy is left
    // in the deck; not revealed). Shadow: discard a non-objective attachment you control (copied from Dread and Despair).
    {
      id: "146061:whenRevealed:1",
      cardCode: "146061",
      lines: ["146061:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "ring", requires: RING_READY, instructions: [{ verb: "Exhaust", target: { kind: "byCode", code: ONE_RING } }, { verb: "RevealEncounter" }] },
            {
              id: "enemy",
              requires: { kind: "searchable", type: "enemy", deckOnly: true },
              instructions: [
                { verb: "DiscardUntil", type: "enemy" },
                { verb: "MoveEncounterCard", card: "picked", to: "engaged", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false } },
              ],
            },
          ],
        },
      ],
    },
    copyLine("145060:A:3", "146061:A:2"),

    // 146062 Deep Shadows (Doomed 2 is a keyword). Each player, the first first, chooses either to discard their hand (with at least 3 cards in it) or to reveal an encounter card.
    {
      id: "146062:whenRevealed:1",
      cardCode: "146062",
      lines: ["146062:A:2"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "discard", requires: { kind: "count", pick: { type: "card", control: "you", from: "hand" }, min: 3 }, instructions: [{ verb: "DiscardHand" }] },
              { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
            ],
          },
        ]),
      ],
    },

    // 146063 Evil Vigilance. Each player, the first first, chooses either to discard a questing character they control, or to raise their threat by 1 for each. Shadow: +1 Attack; a character it destroys has the top card of the encounter deck revealed.
    {
      id: "146063:whenRevealed:1",
      cardCode: "146063",
      lines: ["146063:A:1"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "discard", requires: { kind: "canPick", pick: QUESTING_CHARACTER }, instructions: [{ verb: "Pick", pick: QUESTING_CHARACTER }, { verb: "Discard", target: { kind: "picked" } }] },
              { id: "threat", instructions: [{ verb: "RaiseThreat", amount: { count: QUESTING_CHARACTER }, who: "actor" }] },
            ],
          },
        ]),
      ],
    },
    {
      id: "146063:shadow:1",
      cardCode: "146063",
      lines: ["146063:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "RevealEncounter", when: { kind: "x", min: 1 } }] }],
    },

    // 146070 The Two Watchers (location side; Immune is a keyword). Its Threat X is twice the stage number of the main quest. Forced: after the players travel here it flips to its enemy side (146071) in the staging area.
    { id: "146070:constant:1", cardCode: WATCHERS_LOCATION, lines: ["146070:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stage: true, times: 2 }, until: "whileSourceInPlay", target: "self" }] },
    { id: "146070:forced:1", cardCode: WATCHERS_LOCATION, lines: ["146070:A:3"], timing: "forced", trigger: "traveled", subject: "self", instructions: [{ verb: "FlipToEnemySide", code: WATCHERS_LOCATION, into: WATCHERS_ENEMY }] },

    // 146071 The Two Watchers (enemy side). Immune to player card effects and cannot be optionally engaged (copied from Corsair Captain). Forced: when it deals any amount of damage the damage is canceled and the defending player raises their threat by as much, as Phantom does (the flag phantom). Its damage is its attacks',
    // so the Forced marks each attack as it is made (a printed Forced, not the keyword: nothing that takes Phantom away takes it away).
    copyLine("145035:A:1", "146071:A:1"),
    { id: "146071:forced:1", cardCode: WATCHERS_ENEMY, lines: ["146071:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "ModifyStat", stat: "phantom", amount: 1, until: "endOfAttack", target: "self" }] },

    ...STAGE_RECORDS,
  ],
  { pool: [...SIEGE, ...PELENNOR, ...PASSING, ...CROSS_ROADS, ...FIRE, ...OATH, ...URUK_HAI] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
