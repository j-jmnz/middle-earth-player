import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for cards played from the hand during an effect, and Frodo Baggins's ready: the last records of the costs family, which costs.ts appends to its own (docs/plans/effect-authoring.md).
export const PLAYS: readonly Effect[] = [
  // Plays from the hand during an effect.
  {
    id: "17055:response:1",
    cardCode: "17055",
    lines: ["17055:A:1"],
    timing: "response",
    trigger: "questSucceeded",
    eventSeat: "you",
    // Hirgon was committed to the quest that succeeded (the quest's resolution clears the committed flag before this).
    condition: { kind: "questSucceeded", committed: true },
    instructions: [
      { verb: "PlayFromHand", pick: { type: "card", control: "you", cardType: "ally", sphere: "tactics" }, reduce: 1, min: 1 },
      {
        verb: "Choose",
        who: "actor",
        options: [
          {
            id: "raise",
            instructions: [
              { verb: "RaiseThreat", amount: 1, when: { kind: "matches", card: "picked", pick: { type: "ally", control: "you" }, inPlay: true } },
              { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "picked", when: { kind: "matches", card: "picked", pick: { type: "ally", control: "you" }, inPlay: true } },
              { verb: "ModifyStat", stat: "defense", amount: 1, until: "endOfRound", target: "picked", when: { kind: "matches", card: "picked", pick: { type: "ally", control: "you" }, inPlay: true } },
            ],
          },
          { id: "decline", instructions: [] },
        ],
      },
    ],
  },
  { id: "19027:response:1", cardCode: "19027", lines: ["19027:A:1"], timing: "response", trigger: "played", subject: "self", eventSeat: "you", instructions: [{ verb: "PlayFromHand", pick: { type: "card", control: "you", cardType: "attachment", trait: "Item" }, free: true, onSelf: true }] },
  {
    id: "19056:action:1",
    cardCode: "19056",
    lines: ["19056:A:1"],
    timing: "action",
    limit: "oncePerRound",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "canPick", pick: { type: "card", control: "you", from: "hand", cardType: "ally", trait: "Silvan" } }] },
    instructions: [{ verb: "PlayFromHand", pick: { type: "card", control: "you", cardType: "ally", trait: "Silvan" }, noMatch: true }],
  },
  {
    id: "22036:action:1",
    cardCode: "22036",
    lines: ["22036:A:1"],
    timing: "action",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Planning" }, { kind: "canPick", pick: { type: "ally", control: "you", trait: "Silvan" } }] },
    instructions: [
      { verb: "Each", pick: { type: "ally", control: "you", trait: "Silvan" }, instructions: [{ verb: "ReturnToHand", target: "picked" }] },
      { verb: "PlayFromHand", pick: { type: "card", control: "you", cardType: "ally", trait: "Silvan" }, free: true, picked: true },
    ],
  },

  // Frodo Baggins: "After ~ commits to the quest, spend 1 resource from his resource pool to ready another unique character
  // committed to the quest. If you quest successfully this phase, reduce your threat by 1."
  {
    id: "21002:response:1",
    cardCode: "21002",
    lines: ["21002:A:1"],
    timing: "response",
    trigger: "committed",
    subject: "self",
    cost: { kind: "resources", amount: 1, from: "self" },
    condition: { kind: "canPick", pick: { type: "character", control: "any", unique: true, committed: true, other: true, state: "exhausted" } },
    instructions: [
      { verb: "Pick", pick: { type: "character", control: "any", unique: true, committed: true, other: true, state: "exhausted" } },
      { verb: "Ready", target: "picked" },
      { verb: "Delay", until: "endOfPhase", instructions: [{ verb: "LowerThreat", amount: 1, who: "actor", when: { kind: "questSucceeded" } }] },
    ],
  },
];

