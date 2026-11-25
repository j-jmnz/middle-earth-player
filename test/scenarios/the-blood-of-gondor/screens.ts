import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-blood-of-gondor --landscape`; test/harness/screens.ts). The hidden cards are never named on the table, only counted.
export const screens: ScreenMoment[] = [
  {
    name: "hidden-cards",
    note: "Stage 1B (06117:B:1): a two-player table where seat 1 holds two hidden cards and seat 2 one: the count is a Hidden-n mark on each seat's threat dial (ats.hidden-cards), never a card.",
    layout: { seats: 2, stage: "06117", hidden: ["06119", "06120", { code: "06121", seat: 1 }] },
  },
  {
    name: "captured-at-four",
    note: "Stage 2 Captured! (06118:B:3): a seat holds 4 hidden cards, so the dial reads Hidden 4 beside the total hidden dial, and the quest card (the shot opens past it) says one more turns them all faceup.",
    layout: { stage: "06118", hidden: ["06119", "06120", "06121", "06122"] },
  },
];
