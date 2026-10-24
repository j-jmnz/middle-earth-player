import type { Effect } from "../../catalog/boundary.ts";

// Encounter set A Shadow of the Past (MEC109 encounter cards 31-43, codes 141031-141043).
// Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the cards.
// Constant, travel, response, and shadow timings are not authored here.

export const A_SHADOW_OF_THE_PAST_EFFECTS: readonly Effect[] = [
  // 141033 Stock-brook.
  {
    id: "141033:whenRevealed:1",
    cardCode: "141033",
    timing: "whenRevealed",
    instructions: [{ verb: "ReturnToStaging", target: { kind: "activeLocation" } }, { verb: "Travel", to: "self" }],
  },
  // 141038 The Marish.
  {
    id: "141038:forced:1",
    cardCode: "141038",
    timing: "forced",
    trigger: "hideFailed",
    instructions: [{ verb: "ShuffleIntoDeck", trait: "Nazgûl" }],
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
  // 141043 Have You Seen Baggins? The attached card carries its own Forced effect.
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
