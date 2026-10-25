// Player card templates: the hero and attachment lines of the starter decks.
import type { Instruction } from "../../../src/catalog/boundary.ts";
import { count, OWN } from "./template-kit.ts";
import type { Template } from "./template-kit.ts";

export const PLAYER_STARTER_TEMPLATES: readonly Template[] = [
  // The hero and attachment lines of the starter decks.
  {
    id: "response-commits-add-resource-to-committed-hero",
    pattern: /^Response: After \{self\} commits to a quest, choose a hero committed to that quest\. Add (\d+|an?|one) resources? to that hero's resource pool\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "committed",
        instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", committed: true } }, { verb: "AddResources", amount: count(match[1]), to: "picked" }],
      },
    ],
  },
  {
    id: "action-discard-card-for-willpower-each-player-once-a-round",
    pattern: /^Action: Discard 1 card from your hand to give \{self\} \+(\d+) Willpower until the end of the phase\. This effect may be triggered by each player once each round\.$/,
    build: (match) => [
      {
        timing: "action",
        limit: "oncePerRoundEachPlayer",
        condition: { kind: "handHasCard" },
        instructions: [
          { verb: "Pick", pick: { type: "card", control: "you", from: "hand" } },
          { verb: "DiscardPicked" },
          { verb: "ModifyStat", stat: "willpower", amount: count(match[1]), until: "endOfPhase", target: "self" },
        ],
      },
    ],
  },
  {
    id: "response-engage-higher-ready-and-boost",
    pattern: /^Response: After you engage an enemy with a higher engagement cost than your threat, ready \{self\}\. (?:He|She) gets \+(\d+) Willpower, \+(\d+) Attack, and \+(\d+) Defense until the end of the round\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "engaged",
        condition: { kind: "engagedAboveThreat" },
        instructions: [
          { verb: "Ready" },
          ...(["willpower", "attack", "defense"] as const).map((stat, at): Instruction => ({ verb: "ModifyStat", stat, amount: count(match[at + 1]), until: "endOfRound", target: "self" })),
        ],
      },
    ],
  },
  {
    id: "response-engage-higher-draw",
    pattern: /^Response: After you engage an enemy with an engagement cost higher than your threat, draw (\d+|an?|one) cards?\.$/,
    build: (match) => [{ timing: "response", trigger: "engaged", condition: { kind: "engagedAboveThreat" }, instructions: [{ verb: "Draw", amount: count(match[1]) }] }],
  },
  {
    id: "response-attack-destroys-enemy-ready-participant",
    pattern: /^Response: After \{self\} participates in an attack that destroys an enemy, ready another character that participated in that attack\.$/,
    build: () => [
      {
        timing: "response",
        trigger: "attackDestroyed",
        instructions: [{ verb: "Pick", pick: { type: "character", control: "you", participating: true, state: "exhausted", other: true } }, { verb: "Ready", target: "picked" }],
      },
    ],
  },
  {
    id: "play-top-of-deck-once-per-phase",
    pattern: /^Play with the top card of your deck faceup\. Once per phase, you may play the top card of your deck as if it was in your hand\. When playing a card this way, \{self\} is considered to have the printed Leadership, Lore, Tactics, and Spirit icons\.$/,
    build: () => [{ timing: "constant", condition: OWN, instructions: [{ verb: "PlayFromDeckTop", icons: ["leadership", "lore", "tactics", "spirit"] }] }],
  },
  {
    id: "action-victory-display-discard-top-ready-istari",
    pattern: /^Action: Add \{self\} to the victory display and discard the top card of your deck to ready an Istari character you control\. That character gets \+X Attack until the end of the phase where X is the discarded card's cost\.$/,
    build: () => [
      {
        timing: "action",
        instructions: [
          { verb: "Pick", pick: { type: "character", control: "you", trait: "Istari" } },
          { verb: "AddSourceToVictory" },
          { verb: "DiscardTopOfDeck" },
          { verb: "Ready", target: "picked" },
          { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfPhase", target: "picked", per: "x" },
        ],
      },
    ],
  },
  {
    id: "action-exhaust-choose-one-draw-resource-or-discard-shadow",
    pattern: /^Action: Exhaust \{self\} to \(choose one\): choose a player to draw (\d+|an?|one) cards?, add (\d+|an?|one) resources? to a hero's resource pool, or discard a shadow card from a non-unique enemy\.$/,
    build: (match) => {
      const shadowed = { type: "enemy", control: "any", staging: true, nonUnique: true, hasShadow: true } as const;
      return [
        {
          timing: "action",
          cost: { kind: "exhaustSelf" },
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: [
                { id: "draw", instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "Draw", amount: count(match[1]), who: "picked" }] },
                { id: "resource", instructions: [{ verb: "Pick", pick: { type: "hero", control: "any" } }, { verb: "AddResources", amount: count(match[2]), to: "picked" }] },
                { id: "shadow", requires: { kind: "canPick", pick: shadowed }, instructions: [{ verb: "Pick", pick: shadowed }, { verb: "DiscardShadow" }] },
              ],
            },
          ],
        },
      ];
    },
  },
  {
    id: "action-exhaust-exchange-hand-card-with-deck-top",
    pattern: /^Action: Exhaust \{self\} to exchange a card in your hand with the top card of your deck\.$/,
    build: () => [
      {
        timing: "action",
        cost: { kind: "exhaustSelf" },
        condition: { kind: "handHasCard" },
        instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "hand" } }, { verb: "ExchangeWithDeckTop" }],
      },
    ],
  },
];
