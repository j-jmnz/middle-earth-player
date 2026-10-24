import type { Effect } from "../../catalog/boundary.ts";

// Campaign cards that come from RingsDB, dealt by A Shadow of the Past (codes 141017, 141077-141079) and
// The One Ring (141085, a local record). Mr. Underhill is MEC109 #44, Gildor Inglorion #45, Gandalf's Delay #46,
// The Ring Draws Them #47, The One Ring #166. MEC109/TFotR printing read via Hall of Beorn 2026-10-24. Confirm on the cards.
// 141077 cancel cost sphere: the TFotR page shows the Fellowship sphere icon (the record's value); RingsDB's
// sphere differs. Sphere source conflict, confirm on the card.
//
// Setup records for 141017, 141078, and 141085 describe placement that the definition (141017, 141078)
// or the campaign script (141085) already runs. They never place a card a second time: see quest.ts.

const RING = "141085";

export const CAMPAIGN_EFFECTS: readonly Effect[] = [
  // 141017 Mr. Underhill, action.
  {
    id: "141017:action:1",
    cardCode: "141017",
    timing: "action",
    cost: { kind: "addSelfToVictory" },
    condition: { kind: "hasEngaged" },
    instructions: [{ verb: "BarAttack" }],
  },
  // 141085 The One Ring, constant.
  {
    id: "141085:constant:1",
    cardCode: RING,
    timing: "constant",
    condition: { kind: "sourceIn", zone: "play" },
    instructions: [{ verb: "Restrict", what: "heroLimit" }],
  },
  // 141085 The One Ring, forced. Two-handed play only: the token only passes with two seats.
  {
    id: "141085:forced:1",
    cardCode: RING,
    timing: "forced",
    trigger: "firstPlayerTokenPassed",
    instructions: [{ verb: "TransferHost", who: "firstPlayer" }],
  },
  // 141017 Mr. Underhill.
  { id: "141017:setup:1", cardCode: "141017", timing: "setup", instructions: [{ verb: "AttachToRingBearer", code: "141017" }] },
  // 141077 Gildor Inglorion. Control record: timing label unconfirmed, confirm on the card.
  { id: "141077:whenRevealed:1", cardCode: "141077", timing: "whenRevealed", instructions: [{ verb: "TakeControl", who: "firstPlayer" }] },
  {
    id: "141077:forced:1",
    cardCode: "141077",
    timing: "forced",
    trigger: "endOfRound",
    cancel: { cost: 1, sphere: "fellowship" },
    instructions: [{ verb: "Discard", target: { kind: "self" } }],
  },
  // 141078 Gandalf's Delay. MEC109 #46 (Gandalf's Delay). Read via Hall of Beorn TFotR printing, 2026-10-24. Confirm on the card.
  // The second Setup record lowers every opening hand by one. The engine applies it before the hand is drawn.
  { id: "141078:setup:1", cardCode: "141078", timing: "setup", instructions: [{ verb: "AddToStaging", code: "141078" }] },
  { id: "141078:setup:2", cardCode: "141078", timing: "setup", instructions: [{ verb: "ReduceOpeningHand", amount: 1 }] },
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
