import type { Effect } from "../../catalog/boundary.ts";

// Encounter set Hunted (MEC109 encounter cards 72-73, codes 141072-141073).
// Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the cards.

const NAZGUL = "Nazgûl";

export const HUNTED_EFFECTS: readonly Effect[] = [
  // 141072 Pathless Country, constant.
  {
    id: "141072:constant:1",
    cardCode: "141072",
    timing: "constant",
    condition: { kind: "sourceIn", zone: "staging" },
    instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: 4, until: "whileSourceInPlay" }],
  },
  // 141072 Pathless Country, shadow.
  {
    id: "141072:shadow:1",
    cardCode: "141072",
    timing: "shadow",
    instructions: [{ verb: "AfterAttack", instructions: [{ verb: "EngageNextPlayer" }, { verb: "ImmediateAttack" }] }],
  },
  // 141073 Piercing Cry.
  {
    id: "141073:whenRevealed:1",
    cardCode: "141073",
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          {
            id: "staging",
            requires: { kind: "searchable", trait: NAZGUL },
            instructions: [{ verb: "SearchMove", trait: NAZGUL, to: "staging" }],
          },
          {
            id: "engage",
            requires: { kind: "searchable", trait: NAZGUL },
            instructions: [{ verb: "SearchMove", trait: NAZGUL, to: "engagedFirstPlayer" }],
          },
        ],
      },
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  // 141073 Piercing Cry, shadow.
  { id: "141073:shadow:1", cardCode: "141073", timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ImmediateAttack" }] }] },
];
