import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-fords-of-isen --landscape`; test/harness/screens.ts): one for each new widget of The Fords of Isen's table, a layout (the same JSON `pnpm game scene` takes) and a note that says
// which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds.
const ISLET = { staging: ["07017"], attached: [{ code: "07016", to: "07017", encounter: true as const }] };

export const screens: ScreenMoment[] = [
  { name: "time-dial", layout: { stage: "07059", timeCounters: 5, ...ISLET }, note: "Stage 1B (07059:B:1): the Time dial in the top bar, 5 time counters against Time 5, and Gríma held under The Islet in the staging area, with its held pill." },
  { name: "time-dial-2", layout: { stage: "07059", timeCounters: 2, ...ISLET }, note: "Stage 1B with 2 counters left: the dial warms (near)." },
  { name: "time-dial-1", layout: { stage: "07059", timeCounters: 1, ...ISLET }, note: "Stage 1B with 1 counter left: the dial is critical, the next refresh phase discards Gríma and loses the game (07059:B:2)." },
  { name: "grima-controlled", layout: { stage: "07060", timeCounters: 2, play: ["07016"] }, note: "07016:A:1: Gríma in the first player's play area after the players free him; stage 2B's Time dial at its 2 counters." },
  { name: "ill-tidings", layout: { stage: "07059", timeCounters: 4, hand: ["07023"], heldInHand: ["07023"], ...ISLET }, note: "07023:A:1: Ill Tidings in the hand wears the held pill; a tap opens the preview that says whose hand holds it." },
];
