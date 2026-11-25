import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-fords-of-isen --landscape`; test/harness/screens.ts): one for each new widget of The Fords of Isen's table, a layout (the same JSON `pnpm game scene` takes) and a note that says
// which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds.
export const screens: ScreenMoment[] = [
  { name: "time-dial", layout: { stage: "07059", staging: ["07017"], attached: [{ code: "07016", to: "07017", encounter: true }] }, note: "Stage 1B (07059:B:1): the Time dial in the top bar, 5 time counters against Time 5, and Gríma held under The Islet in the staging area." },
  { name: "grima-controlled", layout: { stage: "07060", play: ["07016"] }, note: "07016:A:1: Gríma in the first player's play area after the players free him; stage 2B's Time dial against Time 2." },
];
