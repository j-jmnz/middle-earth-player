import type { Effect } from "../../catalog/boundary.ts";

// Encounter set A Shadow of the Past (MEC109 encounter cards 31-43, codes 141031-141043).
// Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the cards.
// Shadow instructions run for the defending seat. Their modifiers end with the attack.
const ATTACK_PLUS_ONE: Effect["instructions"] = [
  { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
];
const ATTACK_PLUS_ONE_MORE_IF_HIDE_FAILED: Effect["instructions"] = [
  ...ATTACK_PLUS_ONE,
  { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "hideFailed", scope: "round" } },
];

export const A_SHADOW_OF_THE_PAST_EFFECTS: readonly Effect[] = [
  // 141031 Bag End.
  {
    id: "141031:response:1",
    cardCode: "141031",
    timing: "response",
    trigger: "leftPlay",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Draw", perHero: "Hobbit" }] }],
  },
  // 141032 Woody End.
  {
    id: "141032:constant:1",
    cardCode: "141032",
    timing: "constant",
    condition: { kind: "sourceIn", zone: "activeLocation" },
    instructions: [{ verb: "ModifyStat", stat: "hideValue", amount: -1, until: "whileSourceInPlay", target: "table" }],
  },
  // 141036 Green Hill Country, shadow.
  { id: "141036:shadow:1", cardCode: "141036", timing: "shadow", instructions: ATTACK_PLUS_ONE_MORE_IF_HIDE_FAILED },
  // 141034 Bamfurlong.
  {
    id: "141034:response:1",
    cardCode: "141034",
    timing: "response",
    trigger: "traveled",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "ready", requires: { kind: "hasEngaged", trait: "Nazgûl" }, instructions: [{ verb: "ReadyHero" }] },
              { id: "skip", instructions: [] },
            ],
          },
        ],
      },
    ],
  },
  // 141035 Bucklebury Ferry. The win record runs after the location leaves play explored.
  // Win condition read via Hall of Beorn 2026-10-24 (TBR printing). Confirm on the card.
  { id: "141035:questResolution:1", cardCode: "141035", timing: "questResolution", instructions: [{ verb: "WinGame" }] },
  {
    id: "141035:constant:1",
    cardCode: "141035",
    timing: "constant",
    condition: { kind: "otherLocationInPlay" },
    instructions: [{ verb: "Restrict", what: "travel" }],
  },
  { id: "141035:travel:1", cardCode: "141035", timing: "travel", instructions: [{ verb: "HideTest", x: 3 }] },
  // 141036 Green Hill Country.
  {
    id: "141036:constant:1",
    cardCode: "141036",
    timing: "constant",
    condition: { kind: "sourceIn", zone: "activeLocation" },
    instructions: [{ verb: "ModifyStat", stat: "hideWillpower", amount: 1, until: "whileSourceInPlay", target: "table", per: "committed" }],
  },
  // 141037 Stock Road.
  {
    id: "141037:constant:1",
    cardCode: "141037",
    timing: "constant",
    condition: { kind: "sourceIn", zone: "staging" },
    instructions: [{ verb: "ModifyStat", stat: "hideThreat", amount: 2, until: "whileSourceInPlay", target: "table" }],
  },
  { id: "141037:travel:1", cardCode: "141037", timing: "travel", instructions: [{ verb: "HideTest", x: 1 }] },
  // 141033 Stock-brook.
  {
    id: "141033:whenRevealed:1",
    cardCode: "141033",
    timing: "whenRevealed",
    instructions: [{ verb: "ReturnToStaging", target: { kind: "activeLocation" } }, { verb: "Travel", to: "self" }],
  },
  // 141038 The Marish. hideFailed scope: any seat. Read via Hall of Beorn 2026-10-24. Confirm on the card.
  {
    id: "141038:forced:1",
    cardCode: "141038",
    timing: "forced",
    trigger: "hideFailed",
    instructions: [{ verb: "ShuffleIntoDeck", trait: "Nazgûl" }],
  },
  // 141038 The Marish, shadow.
  { id: "141038:shadow:1", cardCode: "141038", timing: "shadow", instructions: ATTACK_PLUS_ONE_MORE_IF_HIDE_FAILED },
  // 141040 Evil Crow, shadow.
  {
    id: "141040:shadow:1",
    cardCode: "141040",
    timing: "shadow",
    instructions: [{ verb: "ConsiderUndefended", when: { kind: "hideFailed", scope: "round" } }],
  },
  // 141039 Black Rider, constant.
  {
    id: "141039:constant:1",
    cardCode: "141039",
    timing: "constant",
    condition: { kind: "sourceIn", zone: "play" },
    instructions: [{ verb: "Restrict", what: "attach", exceptTrait: "Morgul" }],
  },
  // 141040 Evil Crow, constant.
  {
    id: "141040:constant:1",
    cardCode: "141040",
    timing: "constant",
    condition: { kind: "sourceIn", zone: "engaged" },
    instructions: [{ verb: "ModifyStat", stat: "hideValue", amount: 1, until: "whileSourceInPlay", target: "engagedSeat" }],
  },
  // 141039 Black Rider.
  {
    id: "141039:forced:1",
    cardCode: "141039",
    timing: "forced",
    trigger: "hideFailed",
    condition: { kind: "engagedWithActor" },
    instructions: [{ verb: "ImmediateAttack" }],
  },
  // 141041 Crawling Towards Him.
  {
    id: "141041:whenRevealed:1",
    cardCode: "141041",
    timing: "whenRevealed",
    instructions: [{ verb: "UncommitAll", who: "actor", when: { kind: "hideFailed", scope: "phase" } }],
  },
  // 141041 Crawling Towards Him, shadow.
  { id: "141041:shadow:1", cardCode: "141041", timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },
  // 141042 Hunting for the Ring.
  {
    id: "141042:whenRevealed:1",
    cardCode: "141042",
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "lastFirst",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              {
                id: "return",
                requires: { kind: "hasEngaged", trait: "Nazgûl" },
                instructions: [
                  {
                    verb: "ReturnToStaging",
                    target: { kind: "engagedEnemies", trait: "Nazgûl", who: "actor", pick: "choose" },
                  },
                ],
              },
              { id: "hide", instructions: [{ verb: "HideTest", x: 2 }] },
            ],
          },
        ],
      },
    ],
  },
  // 141043 Have You Seen Baggins? The attached card carries its own Forced record. hideFailed scope: any seat, as for 141038. Confirm on the card.
  {
    id: "141043:whenRevealed:1",
    cardCode: "141043",
    timing: "whenRevealed",
    instructions: [{ verb: "AttachSelf", to: { kind: "hero" } }],
  },
  {
    id: "141043:forced:1",
    cardCode: "141043",
    timing: "forced",
    trigger: "hideFailed",
    instructions: [{ verb: "Discard", target: { kind: "host" } }],
  },
];
