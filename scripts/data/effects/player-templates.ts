import type { Instruction } from "../../../src/catalog/boundary.ts";
import { count, STATS, SPHERES, OWN, STAT, HIGH_COST, attachHost } from "./template-kit.ts";
import type { Template } from "./template-kit.ts";

export const PLAYER_TEMPLATES: readonly Template[] = [
  // Player cards. An attachment names where it goes; Restricted is a keyword the engine reads from the card.
  {
    id: "attach-to",
    pattern: /^Attach to (.+?)\.(?: Limit 1 per (?:hero|character)\.)?(?: Restricted\.)?$/,
    build: (match) => {
      const host = attachHost(match[1] ?? "");
      if (!host) return null;
      return [{ timing: "constant", instructions: [{ verb: "AttachesTo", host, ...(/Limit 1 per/.test(match[0]) ? { limitPerHost: true } : {}) }] }];
    },
  },
  {
    id: "attached-gets-stat",
    pattern: /^Attached (?:hero|character) (?:gets|gains) \+(\d+) (Willpower|Attack|Defense|Threat)\.$/,
    build: (match) => [{ timing: "constant", instructions: [STAT(STATS[match[2] ?? ""] ?? "attack", count(match[1]), "host")] }],
  },
  {
    id: "attached-defense-vs-high-engagement",
    pattern: /^Attached hero gets \+(\d+) Defense while defending against an attack made by an enemy with an engagement cost higher than your threat\.$/,
    build: (match) => [
      { timing: "constant", instructions: [STAT("defense", count(match[1]), "host", { when: { kind: "versusHighEngagement", role: "defending" } })] },
    ],
  },
  {
    id: "attached-attack-bonus-vs-high-engagement",
    pattern: /^Attached hero gets \+(\d+) Attack \(\+(\d+) Attack instead if attacking an enemy with an engagement cost higher than your threat\)\.$/,
    build: (match) => [
      {
        timing: "constant",
        instructions: [STAT("attack", count(match[1]), "host"), STAT("attack", count(match[2]) - count(match[1]), "host", { when: { kind: "versusHighEngagement", role: "attacking" } })],
      },
    ],
  },
  {
    id: "self-stat-per-hobbit-hero",
    pattern: /^\{self\} gets \+(\d+) (Willpower|Attack|Defense) for each Hobbit hero you control\.$/,
    build: (match) => [{ timing: "constant", condition: OWN, instructions: [STAT(STATS[match[2] ?? ""] ?? "attack", count(match[1]), "self", { per: "hobbitHero" })] }],
  },
  {
    id: "enemies-engagement-per-hobbit-hero",
    pattern: /^Each enemy in play gets \+(\d+) engagement cost for each Hobbit hero you control\.$/,
    build: (match) => [
      {
        timing: "constant",
        condition: OWN,
        instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: count(match[1]), until: "whileSourceInPlay", target: "enemies", per: "hobbitHero" }],
      },
    ],
  },
  {
    id: "self-defense-vs-high-engagement",
    pattern: new RegExp(`^\\{self\\} gets \\+(\\d+) Defense while defending against ${HIGH_COST}\\.$`),
    build: (match) => [
      { timing: "constant", condition: OWN, instructions: [STAT("defense", count(match[1]), "self", { when: { kind: "versusHighEngagement", role: "defending" } })] },
    ],
  },
  {
    id: "each-hero-gets-stat",
    pattern: /^Each hero gets \+(\d+) (Willpower|Attack|Defense)\.$/,
    build: (match) => [{ timing: "constant", condition: OWN, instructions: [STAT(STATS[match[2] ?? ""] ?? "willpower", count(match[1]), "heroes")] }],
  },
  {
    id: "hobbit-characters-hit-points",
    pattern: /^Each Hobbit character gets \+(\d+) hit points?\.$/,
    build: (match) => [
      {
        timing: "constant",
        condition: OWN,
        instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: count(match[1]), until: "whileSourceInPlay", target: "hobbitCharacters" }],
      },
    ],
  },
  {
    id: "lower-cost-if-control-cannot-have-attachments",
    pattern: /^Lower the cost to play \{self\} by (\d+) if you control (.+?)\. Cannot have attachments\.$/,
    build: (match, context) => {
      const code = context.codeOf(match[2] ?? "");
      if (!code) return null;
      return [{ timing: "constant", instructions: [{ verb: "ReduceCost", amount: count(match[1]), when: { kind: "controls", code } }, { verb: "Restrict", what: "attach" }] }];
    },
  },
  {
    id: "attached-gains-trait",
    pattern: /^Attached hero gains the (\w+) trait\.$/,
    build: (match) => [{ timing: "constant", instructions: [{ verb: "GrantTrait", trait: match[1] ?? "" }] }],
  },
  {
    id: "attached-named-gains-icon",
    pattern: /^If attached hero is (\w+), he also gains an? (Leadership|Tactics|Spirit|Lore) resource icon\.$/,
    build: (match) => {
      const sphere = SPHERES[match[2] ?? ""];
      return sphere ? [{ timing: "constant", instructions: [{ verb: "GrantIcon", sphere, when: { kind: "hostNamed", name: match[1] ?? "" } }] }] : null;
    },
  },
  {
    id: "response-character-destroyed-add-resource-to-attached",
    pattern: /^Response: After a character is destroyed, add (\d+|an?|one) resources? to attached hero's (?:resource )?pool\.$/,
    build: (match) => [{ timing: "response", trigger: "characterDestroyed", instructions: [{ verb: "AddResources", amount: count(match[1]) }] }],
  },
  {
    id: "forced-character-destroyed-discard-self",
    pattern: /^Forced: After a character is destroyed, discard \{self\}\.$/,
    build: () => [{ timing: "forced", trigger: "characterDestroyed", instructions: [{ verb: "Discard", target: { kind: "self" } }] }],
  },
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
  // Cancel, look at, and search.
  {
    id: "response-cancel-when-revealed",
    pattern: /^Response: Cancel the "when revealed" effects of a card that was just revealed from the encounter deck\.$/,
    build: () => [{ timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] }],
  },
  {
    id: "response-cancel-shadow-effect",
    pattern: /^Response: Cancel a shadow effect just triggered during combat\.$/,
    build: () => [{ timing: "response", trigger: "shadowPending", instructions: [{ verb: "CancelEffect" }] }],
  },
  {
    id: "action-exhaust-look-at-encounter-top",
    pattern: /^Action: Exhaust \{self\} to look at the top card of the encounter deck\.$/,
    build: () => [{ timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "LookAtEncounterTop" }] }],
  },
  {
    id: "response-played-search-top-attachment-into-play",
    pattern: /^Response: After you play \{self\} from your hand, search the top (\d+) cards of your deck for an attachment of cost (\d+) or less and put it into play\. Put the remaining cards back in any order\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "played",
        instructions: [
          { verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: count(match[1]), cardType: "attachment", maxCost: count(match[2]) } },
          { verb: "Pick", pick: { type: "character", control: "any", hostForPicked: true } },
          { verb: "AttachPicked" },
          { verb: "ArrangeTop" },
        ],
      },
    ],
  },
  {
    id: "response-enters-play-search-deck-for-trait-attachment",
    pattern: /^Response: After \{self\} enters play, search your deck for an? (\w+) attachment and add it to your hand\. Shuffle your deck\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "enteredPlay",
        instructions: [
          { verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "attachment", trait: match[1] ?? "" } },
          { verb: "MovePicked", to: "hand" },
          { verb: "ShuffleDeck" },
        ],
      },
    ],
  },
  // Temporary play, play from a discard pile, and delayed triggers.
  {
    id: "action-put-ally-into-play-then-return",
    pattern: /^Action: Put 1 ally card into play from your hand\. At the end of the phase, if that ally is still in play, return it to your hand\.$/,
    build: () => [
      {
        timing: "action",
        instructions: [
          { verb: "Pick", pick: { type: "ally", control: "you", from: "hand", intoPlay: true } },
          { verb: "MovePicked", to: "play" },
          { verb: "Delay", until: "endOfPhase", subject: "picked", instructions: [{ verb: "ReturnToHand" }] },
        ],
      },
    ],
  },
  {
    id: "action-self-attack-then-shuffle-into-deck",
    pattern: /^Action: \{self\} gains \+(\d+) Attack until the end of the phase\. At the end of the phase in which you trigger this effect, shuffle \{self\} back into your deck\.$/,
    build: (match) => [
      {
        timing: "action",
        instructions: [
          { verb: "ModifyStat", stat: "attack", amount: count(match[1]), until: "endOfPhase", target: "self" },
          { verb: "Delay", until: "endOfPhase", instructions: [{ verb: "ShuffleSelfIntoDeck" }] },
        ],
      },
    ],
  },
  {
    id: "action-ally-of-cost-x-from-any-discard-into-play",
    pattern: /^Action: Choose an ally with a printed cost of X in any player's discard pile\. Put that ally into play under your control\.(?: \(The chosen ally can belong to any sphere of influence\.\))?$/,
    build: () => [
      {
        timing: "action",
        instructions: [{ verb: "Pick", pick: { type: "ally", control: "any", from: "discard", costIsX: true, intoPlay: true } }, { verb: "MovePicked", to: "play" }],
      },
    ],
  },
  {
    id: "action-return-sphere-card-from-discard",
    pattern: /^Action: Return 1 (Spirit|Leadership|Tactics|Lore) card from your discard pile to your hand\.$/,
    build: (match) => {
      const sphere = SPHERES[match[1] ?? ""];
      return sphere
        ? [{ timing: "action", instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "discard", sphere } }, { verb: "MovePicked", to: "hand" }] }]
        : null;
    },
  },
  {
    id: "response-played-return-topmost-attachment",
    pattern: /^Response: After you play \{self\}, return the topmost attachment in any player's discard pile to his hand\.$/,
    build: () => [
      {
        timing: "response",
        trigger: "played",
        instructions: [{ verb: "Pick", pick: { type: "card", control: "any", from: "discard", cardType: "attachment", topmost: true } }, { verb: "MovePicked", to: "hand" }],
      },
    ],
  },
  {
    id: "attach-to-active-location-quest-points",
    pattern: /^Attach to the active location\. Attached location gets \+(\d+) quest points?\.$/,
    build: (match) => [
      {
        timing: "constant",
        instructions: [
          { verb: "AttachesTo", host: { kind: "activeLocation" } },
          { verb: "ModifyStat", stat: "questPoints", amount: count(match[1]), until: "whileSourceInPlay", target: "host" },
        ],
      },
    ],
  },
  {
    id: "response-attached-location-explored-first-player-ally",
    pattern: /^Response: After attached location leaves play as an explored location, the first player puts 1 ally into play from his hand\.$/,
    build: () => [
      {
        timing: "response",
        trigger: "hostLeftPlay",
        condition: { kind: "subjectExplored" },
        instructions: [
          { verb: "Pick", pick: { type: "ally", control: "you", from: "hand", intoPlay: true, who: "firstPlayer" } },
          { verb: "MovePicked", to: "play", who: "firstPlayer" },
        ],
      },
    ],
  },
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
