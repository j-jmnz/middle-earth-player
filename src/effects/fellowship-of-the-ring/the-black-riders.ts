import type { Effect } from "../../catalog/boundary.ts";

// Encounter set The Black Riders (MEC109 encounter cards 74-75, codes 141074-141075).
// Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the cards.

export const THE_BLACK_RIDERS_EFFECTS: readonly Effect[] = [
  // 141074 Black Steed, constant.
  {
    id: "141074:constant:1",
    cardCode: "141074",
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "whileSourceInPlay", target: "host" }],
  },
  // 141074 Black Steed. The attached card carries its own Forced effect.
  {
    id: "141074:whenRevealed:1",
    cardCode: "141074",
    timing: "whenRevealed",
    instructions: [{ verb: "AttachSelf", to: { kind: "enemy", trait: "Nazgûl" } }],
  },
  {
    id: "141074:forced:1",
    cardCode: "141074",
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "phase", is: "Refresh" },
    instructions: [{ verb: "ReturnToStaging", target: { kind: "host" } }],
  },
  // 141075 Rode Like a Gale.
  {
    id: "141075:whenRevealed:1",
    cardCode: "141075",
    timing: "whenRevealed",
    instructions: [
      { verb: "ReturnToStaging", target: { kind: "engagedEnemies", trait: "Nazgûl", who: "each", pick: "all" } },
      { verb: "GainSurge", when: { kind: "noneReturned" } },
    ],
  },
  // 141075 Rode Like a Gale, shadow.
  { id: "141075:shadow:1", cardCode: "141075", timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },
];
