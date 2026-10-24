import type { Effect } from "../../catalog/boundary.ts";

// Campaign cards that come from RingsDB, dealt by A Shadow of the Past (codes 141017, 141077-141079) and
// The One Ring (141085, a local record). Read via Hall of Beorn 2026-10-24, TBR printing. Confirm on the cards.
// RingsDB shows a Fellowship sphere on the Gildor cancel cost. Hall of Beorn shows no sphere there.
//
// Setup records for 141017, 141078, and 141085 describe placement that the definition (141017, 141078)
// or the campaign script (141085) already runs. They never place a card a second time: see quest.ts.

const RING = "141085";

export const CAMPAIGN_EFFECTS: readonly Effect[] = [
  // 141017 Mr. Underhill.
  { id: "141017:setup:1", cardCode: "141017", timing: "setup", instructions: [{ verb: "AttachToRingBearer", code: "141017" }] },
  // 141077 Gildor Inglorion. The control sentence has no timing label on the card: authored as whenRevealed. Confirm.
  { id: "141077:whenRevealed:1", cardCode: "141077", timing: "whenRevealed", instructions: [{ verb: "TakeControl", who: "firstPlayer" }] },
  {
    id: "141077:forced:1",
    cardCode: "141077",
    timing: "forced",
    trigger: "endOfRound",
    cancel: { cost: 1, sphere: "fellowship" },
    instructions: [{ verb: "Discard", target: { kind: "self" } }],
  },
  // 141078 Gandalf's Delay. Its second printed sentence is not authored: see the coverage test.
  { id: "141078:setup:1", cardCode: "141078", timing: "setup", instructions: [{ verb: "AddToStaging", code: "141078" }] },
  // 141079 The Ring Draws Them.
  {
    id: "141079:whenRevealed:1",
    cardCode: "141079",
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Delay",
        until: "endOfPhase",
        uncancelable: { kind: "exhausted", code: RING, is: true },
        instructions: [{ verb: "EngageAll", who: "firstPlayer" }],
      },
    ],
  },
  // 141085 The One Ring. The campaign script runs this record's instructions.
  { id: "141085:setup:1", cardCode: RING, timing: "setup", instructions: [{ verb: "AttachToRingBearer", code: RING }] },
];
