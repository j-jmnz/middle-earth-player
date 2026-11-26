import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment trouble-in-tharbad --landscape`; test/harness/screens.ts): one for each new widget of Trouble in Tharbad's table, a layout (the same JSON `pnpm game scene` takes) and a note that says
// which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds. The open Choose of 08067:B:2 (the Bellach choice) is no layout: a layout cannot open a window, so the choice is checked by
// the words test (`pnpm test scenario trouble-in-tharbad --words`) and the moment "time-dial-2b-last" shows the table it opens on.
export const screens: ScreenMoment[] = [
  { name: "time-dial-1b", layout: { stage: "08066", timeCounters: 4, active: "08069" }, note: "Stage 1B (08066:B:1): the Time dial, 4 time counters against Time 4, and The Empty Mug as the active location." },
  { name: "time-dial-1b-last", layout: { stage: "08066", timeCounters: 1, active: "08069" }, note: "Stage 1B with 1 counter left: the dial warms and its words say that the last counter lowers each player's threat elimination level by 10 (08066:B:2)." },
  { name: "time-dial-2b-last", layout: { stage: "08067", timeCounters: 1, staging: ["08070", "08071"], play: ["08068"] }, note: "Stage 2B (08067:B:1) with 1 counter left, Bellach and The Crossing at Tharbad in the staging area: the dial's words name the first player's choice, each player's threat up by 3 or Bellach's attack on Nalir (08067:B:2)." },
  { name: "nalir-controlled", layout: { stage: "08066", seats: 2, play: ["08068"], active: "08069", timeCounters: 4 }, note: "08068:A:1: Nalir in the first player's play area. In the planning phase a tap opens the preview that names the controller and says that control follows the first player token and that his leaving play loses the game (in the quest phase a tap commits him instead)." },
  { name: "elimination-level", layout: { stage: "08066", seats: 2, eliminationReduction: 10, threat: [36, 33], timeCounters: 4 }, note: "08066:B:2: after the stage lowered the level once, each seat's threat dial fills toward 40 and warms near it; threat 36 is critical, 33 is near." },
];
