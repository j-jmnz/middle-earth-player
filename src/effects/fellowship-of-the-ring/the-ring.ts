import type { Effect } from "../../catalog/boundary.ts";

// Encounter set The Ring (MEC109 #175, code 141076).
// MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the card.

export const THE_RING_EFFECTS: readonly Effect[] = [
  // 141076 Lure of the Ring. 141085 is The One Ring.
  {
    id: "141076:whenRevealed:1",
    cardCode: "141076",
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          {
            id: "exhaust",
            requires: { kind: "exhausted", code: "141085", is: false },
            instructions: [{ verb: "Exhaust", target: { kind: "byCode", code: "141085" } }],
          },
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 3, who: "firstPlayer" }] },
        ],
      },
    ],
  },
  // 141076 Lure of the Ring, shadow.
  {
    id: "141076:shadow:1",
    cardCode: "141076",
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "exhausted", code: "141085", is: true } },
    ],
  },
];
