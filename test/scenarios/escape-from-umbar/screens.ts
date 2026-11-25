import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment escape-from-umbar --landscape`; test/harness/screens.ts): one for each new widget of Escape from Umbar's table (docs/scenarios/haradrim/escape-from-umbar.md, Table).
// A state only a played game reaches is not here: the "danger" colour of the "Lose at 0" pill needs a stage that has been in play a whole round, which the layout cannot set; the test src/play/scenarios/escape-from-umbar-table.test.ts checks it.
export const screens: ScreenMoment[] = [
  {
    name: "under-narrow-alleyway",
    note: "Narrow Alleyway (16016:A:1) is the active location and a Southron Soldier lies faceup under it, out of play: the enemy is drawn under its host and the host wears the \"1 held\" pill.",
    layout: { stage: "16066", active: "16016", under: [{ code: "16042", to: "16016", up: true }], staging: ["16015"] },
  },
  {
    name: "champion",
    note: "Southron Champion (16040:A:1) is in the staging area and the Southron Captain holding its resource token wears the \"Champion\" pill; an engaged Umbar Sentry wears none.",
    layout: { stage: "16066", staging: ["16040", { code: "16041", resources: 1 }], engaged: ["16015"] },
  },
  {
    name: "hand-limit",
    note: "In Enemy Territory (16045:A:2) is in the staging area and each of two seats holds 4 cards: the seat mark \"Hand 4/5\" on each threat dial warms to near.",
    layout: { stage: "16066", seats: 2, staging: ["16045"], hand: ["f0", "f0", "f0", "f0"] },
  },
  {
    name: "seize-them",
    note: "\"Seize Them!\" (16014:A:2) is in the staging area with no progress on the main quest: the card wears the \"Lose at 0\" pill (red once the stage has been in play a whole round, which only a played game reaches).",
    layout: { stage: "16066", progress: 0, staging: ["16014"] },
  },
];
