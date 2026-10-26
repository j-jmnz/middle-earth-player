// Player card templates: the Actions and Responses of the player cards.
import type { Instruction } from "../../../src/catalog/boundary.ts";
import { count, STATS } from "./template-kit.ts";
import type { Template } from "./template-kit.ts";

export const PLAYER_ABILITY_TEMPLATES: readonly Template[] = [
  // Actions and Responses of the player cards.
  {
    id: "action-exhaust-choose-player-characters-stat",
    pattern: /^Action: Exhaust \{self\} to choose a player\. Each character controlled by that player gets \+(\d+) (Willpower|Attack|Defense) until the end of the phase\.$/,
    build: (match) => [
      {
        timing: "action",
        cost: { kind: "exhaustSelf" },
        instructions: [
          { verb: "Pick", pick: { type: "player", control: "any" } },
          { verb: "ModifyStat", stat: STATS[match[2] ?? ""] ?? "willpower", amount: count(match[1]), until: "endOfPhase", target: "pickedPlayerCharacters" },
        ],
      },
    ],
  },
  {
    id: "action-exhaust-choose-player-draws",
    pattern: /^Action: Exhaust \{self\} to choose a player\. That player draws (\d+|an?|one) cards?\.$/,
    build: (match) => [
      {
        timing: "action",
        cost: { kind: "exhaustSelf" },
        instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "Draw", amount: count(match[1]), who: "picked" }],
      },
    ],
  },
  {
    id: "action-exhaust-add-resources-to-attached",
    pattern: /^Action: Exhaust \{self\} to add (\d+|an?|one) resources? to attached hero's resource pool\.$/,
    build: (match) => [{ timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "AddResources", amount: count(match[1]) }] }],
  },
  {
    id: "action-exhaust-ready-attached",
    pattern: /^Action: Exhaust \{self\} to ready attached hero\.$/,
    build: () => [{ timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "Ready", target: "host" }] }],
  },
  {
    id: "action-choose-and-ready-ally",
    pattern: /^Action: Choose and ready 1 ally card\.$/,
    build: () => [
      {
        timing: "action",
        instructions: [{ verb: "Pick", pick: { type: "ally", control: "any", state: "exhausted" } }, { verb: "Ready", target: "picked" }],
      },
    ],
  },
  {
    id: "action-exhaust-hero-ready-different-hero",
    pattern: /^Action: Exhaust 1 hero you control to choose and ready a different hero\.$/,
    build: () => [
      {
        timing: "action",
        instructions: [
          { verb: "Pick", pick: { type: "hero", control: "you", state: "ready" } },
          { verb: "Exhaust", target: { kind: "picked" } },
          { verb: "Pick", pick: { type: "hero", control: "any", state: "exhausted", different: true } },
          { verb: "Ready", target: "picked" },
        ],
      },
    ],
  },
  {
    id: "action-ready-all-characters",
    pattern: /^Action: Ready all character cards in play\.$/,
    build: () => [{ timing: "action", instructions: [{ verb: "Ready", target: "allCharacters" }] }],
  },
  {
    id: "action-hobbit-character-stats",
    pattern: /^Action: Choose a Hobbit character\. That character gets \+(\d+) Willpower, \+(\d+) Attack, and \+(\d+) Defense until the end of the phase\.$/,
    build: (match) => [
      {
        timing: "action",
        instructions: [
          { verb: "Pick", pick: { type: "character", control: "any", trait: "Hobbit" } },
          ...(["willpower", "attack", "defense"] as const).map((stat, at): Instruction => ({ verb: "ModifyStat", stat, amount: count(match[at + 1]), until: "endOfPhase", target: "picked" })),
        ],
      },
    ],
  },
  {
    id: "action-heroes-willpower-draw-per-hobbit-hero",
    pattern: /^Action: Each hero you control gets \+(\d+) Willpower until the end of the round\. Draw 1 card for each Hobbit hero you control\.$/,
    build: (match) => [
      {
        timing: "action",
        instructions: [
          { verb: "ModifyStat", stat: "willpower", amount: count(match[1]), until: "endOfRound", target: "ownHeroes" },
          { verb: "Draw", perHero: "Hobbit" },
        ],
      },
    ],
  },
  {
    id: "action-bar-enemy-attack-this-phase",
    pattern: /^Action: Choose an enemy engaged with a player\. That enemy cannot attack that player this phase\.$/,
    build: () => [{ timing: "action", instructions: [{ verb: "BarAttack", scope: "any", until: "endOfPhase" }] }],
  },
  {
    id: "action-exhaust-character-attack-now",
    pattern: /^Action: Exhaust a character you control to immediately declare it as an attacker \(and resolve its attack\) against any eligible enemy target\.$/,
    build: () => [
      {
        timing: "action",
        instructions: [
          { verb: "Pick", pick: { type: "character", control: "you", state: "ready", canAttack: true } },
          { verb: "Exhaust", target: { kind: "picked" } },
          { verb: "Pick", pick: { type: "enemy", control: "any", attackableByPicked: true } },
          { verb: "AttackEnemy" },
        ],
      },
    ],
  },
  {
    id: "action-reduce-threat-give-control",
    pattern: /^Action: Reduce your threat by (\d+) to give control of \{self\} to another player\. Raise that player's threat by (\d+)\.$/,
    build: (match) => [
      {
        timing: "action",
        condition: { kind: "otherPlayer" },
        instructions: [
          { verb: "LowerThreat", amount: count(match[1]), who: "actor" },
          { verb: "GiveControl" },
          { verb: "RaiseThreat", amount: count(match[2]), who: "otherPlayer" },
        ],
      },
    ],
  },
  {
    id: "action-reduce-one-player-threat-or-each",
    pattern: /^Action: Reduce 1 player's threat by (\d+), or reduce each player's threat by (\d+)\.$/,
    build: (match) => [
      {
        timing: "action",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "one", instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "LowerThreat", amount: count(match[1]), who: "picked" }] },
              { id: "each", instructions: [{ verb: "LowerThreat", amount: count(match[2]), who: "eachSeat" }] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "response-ally-leaves-play-controller-draws",
    pattern: /^Response: After an ally card leaves play, that card's controller draws (\d+|an?|one) cards?\.$/,
    build: (match) => [{ timing: "response", trigger: "allyLeftPlay", instructions: [{ verb: "Draw", amount: count(match[1]), who: "eventSeat" }] }],
  },
  {
    id: "response-takes-damage-ready",
    pattern: /^Response: After \{self\} takes any amount of damage, ready (?:him|her|it)\.$/,
    build: () => [{ timing: "response", trigger: "damaged", instructions: [{ verb: "Ready" }] }],
  },
  {
    id: "response-enters-play-choose-location-progress",
    pattern: /^Response: After \{self\} enters play, choose a location\. Place (\d+|an?|one) progress tokens? on that location\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "enteredPlay",
        instructions: [{ verb: "Pick", pick: { type: "location", control: "any" } }, { verb: "PlaceProgressOn", amount: count(match[1]), target: "picked" }],
      },
    ],
  },
  {
    id: "response-commits-progress-on-each-staging-location",
    pattern: /^Response: After \{self\} commits to a quest, place (\d+|an?|one) progress tokens? on each location in the staging area\.$/,
    build: (match) => [{ timing: "response", trigger: "committed", instructions: [{ verb: "PlaceProgressOn", amount: count(match[1]), target: "eachStagingLocation" }] }],
  },
  {
    id: "end-of-round-discard-self",
    pattern: /^At the end of the round, discard \{self\} from play\.$/,
    build: () => [{ timing: "triggered", trigger: "endOfRound", instructions: [{ verb: "Discard", target: { kind: "self" } }] }],
  },
  {
    id: "response-enters-play-choose-one",
    pattern: /^Response: After \{self\} enters play, \(choose 1\): draw (\d+) cards, deal (\d+) damage to 1 enemy in play, or reduce your threat by (\d+)\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "enteredPlay",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "draw", instructions: [{ verb: "Draw", amount: count(match[1]) }] },
              {
                id: "damage",
                instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true } }, { verb: "DamageCard", amount: count(match[2]) }],
              },
              { id: "threat", instructions: [{ verb: "LowerThreat", amount: count(match[3]), who: "actor" }] },
            ],
          },
        ],
      },
    ],
  },
];
