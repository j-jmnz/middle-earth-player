import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

// Foundations of Stone Nightmare (deck 9017, data/printed/nightmare.json). The setup card's A:1 and its side B are the deck-building text (inert; the build puts the cards bearing the Goblins of the Deep icon in the standard deck and the ones bearing the Foundations of Stone icon in the set-aside set,
// scripts/data/nightmare-defs.ts). A:2: when stage 3B is revealed the Mount and Artifact cards in play are discarded and each player discards allies until the allies he controls cost 6 or less in all. The new cards use the vocabulary of ../dwarrowdelf/foundations-of-stone.ts. The readings are in docs/brief.md
// (Foundations of Stone).
// Rules: mec109.multiple-staging-areas, mec108.create-staging-area, rr.forced, rr.attachment-cards, rr.reveal, rr.travel, rr.shadow-effects, rr.first-player, rr.the-word-choose (data/rules/entries.json).
const A_NAMELESS_ENEMY_ATTACKS: Condition = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Nameless" } };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const IN_EVERY_HAND: PickSpec = { type: "card", control: "you", from: "hand" };

/** "X is the printed cost of all attached cards on this card. If there are no cards attached, X is `ifNone`" (901704:A:2, 901705:A:2). */
const nameless = (code: string, ifNone: number): Effect => ({
  id: `${code}:constant:1`,
  cardCode: code,
  lines: [`${code}:A:2`],
  timing: "constant",
  instructions: [
    { verb: "ModifyStat", stat: "attack", amount: { namelessCost: ifNone }, until: "whileSourceInPlay", target: "self" },
    { verb: "ModifyStat", stat: "hitPoints", amount: { namelessCost: ifNone }, until: "whileSourceInPlay", target: "self" },
  ],
});

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 901701 setup card. A:2: when stage 3B (Washed Away!) is revealed, before its When Revealed effects, every Mount and Artifact card in play is discarded and each player, first player first, discards allies of his choice until the allies he controls cost 6 or less.
  {
    id: "901701:forced:1",
    cardCode: "901701",
    lines: ["901701:A:2"],
    timing: "forced",
    trigger: "stageRevealed",
    condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: ["Washed Away!"] } },
    instructions: [{ verb: "DiscardAllInPlay", pick: { type: "card", control: "any", traits: ["Mount", "Artifact"] } }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardAlliesToCost", cost: 6 }] }],
  },

  // 901702 Mithril Seeker. A:1: +1 Attack for each resource on it. A:2: when it attacks, 1 resource moves from each of the defending player's heroes that has one to it.
  { id: "901702:constant:1", cardCode: "901702", lines: ["901702:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  { id: "901702:forced:1", cardCode: "901702", lines: ["901702:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "MoveResourceFromHeroes", to: "self" }] },

  // 901703 Giant Cave Centipede. A:1: each player at the stage shuffles the card in his hand with the highest printed cost into his deck. A:2: at the end of the combat phase, when it is engaged, the engaged player has it join another player's staging area.
  { id: "901703:whenRevealed:1", cardCode: "901703", lines: ["901703:A:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "ShuffleHighestCostIntoDeck" }] }] },
  {
    id: "901703:forced:1",
    cardCode: "901703",
    lines: ["901703:A:2"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "sourceIn", zone: "engaged" }] },
    instructions: [{ verb: "MoveToOtherPlayerArea" }],
  },

  // 901704 Unspeakable Thing. A:1: when it engages a player or attacks one it gets the top card of that player's deck. A:2: X, its Attack and hit points, is the printed cost of the attached cards (5 with none).
  { id: "901704:forced:1", cardCode: "901704", lines: ["901704:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "AttachDeckTop" }] },
  { id: "901704:forced:2", cardCode: "901704", lines: ["901704:A:1"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "AttachDeckTop" }] },
  nameless("901704", 5),

  // 901705 Primeval Thing. A:1: when it enters play it gets cards from the top of the first player's deck until the attached cards cost 6 or more in all. A:2: X is their printed cost (6 with none).
  { id: "901705:forced:1", cardCode: "901705", lines: ["901705:A:1"], timing: "forced", trigger: "encounterEnteredPlay", subject: "self", instructions: [{ verb: "AttachDeckTop", deck: "firstPlayer", untilCost: 6 }] },
  nameless("901705", 6),

  // 901706 Nest of Horrors. A:1: while it is in the staging area, each time cards from the top of a player's deck are attached to a Nameless enemy, one more card from that deck is attached to it (not a new event). A:2 (Travel): each player at the stage discards the top card of the encounter deck; each Nameless enemy so discarded is revealed.
  { id: "901706:forced:1", cardCode: "901706", lines: ["901706:A:1"], timing: "forced", trigger: "attachedFromDeck", condition: IN_STAGING, instructions: [{ verb: "AttachDeckTop", to: "subject", extra: true }] },
  { id: "901706:travel:1", cardCode: "901706", lines: ["901706:A:2"], timing: "travel", instructions: [{ verb: "DiscardEncounterPerPlayer" }, { verb: "RevealDiscarded", trait: "Nameless" }] },

  // 901707 Shivering River. A:1: while it is in the staging area it adds its Threat to the total Threat in every other staging area. A:2 (Shadow): the attacking enemy gets +1 Attack, +3 instead when more than one player is at this staging area.
  { id: "901707:constant:1", cardCode: "901707", lines: ["901707:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "threatInOtherAreas", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "901707:shadow:1",
    cardCode: "901707",
    lines: ["901707:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "less", left: { playersAtStage: true }, right: 2 } },
      { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: { kind: "less", left: 1, right: { playersAtStage: true } } },
    ],
  },

  // 901708 Chill of the Roots. A:1: each player, first player first, discards his hand or raises his threat by the number of cards in it; with no card discarded it gains surge. A:2 (Shadow): when the attacking enemy is Nameless it gets the top card of the defending player's deck.
  {
    id: "901708:whenRevealed:1",
    cardCode: "901708",
    lines: ["901708:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "discard", instructions: [{ verb: "DiscardEach", pick: IN_EVERY_HAND }] },
              { id: "raise", instructions: [{ verb: "RaiseThreat", amount: { hand: true }, who: "actor" }] },
            ],
          },
        ],
      },
      { verb: "GainSurge", when: { kind: "noneDiscarded" } },
    ],
  },
  { id: "901708:shadow:1", cardCode: "901708", lines: ["901708:A:2"], timing: "shadow", instructions: [{ verb: "AttachDeckTop", to: "attacker", when: A_NAMELESS_ENEMY_ATTACKS }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
