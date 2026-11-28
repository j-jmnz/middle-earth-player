import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --scene` or `--moment wrath-and-ruin --landscape`; test/harness/screens.ts): one for each new widget of Wrath and Ruin's table (docs/scenarios/vengeance-of-mordor/wrath-and-ruin.md, Table), a layout
// (the same JSON `pnpm game scene` takes) and a note that says which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds. The dials and marks are src/play/readouts/mordor/wrath.ts. A layout lets
// only the first player take control, so the two-handed seat marks at a count for both seats are checked by tests only (src/play/scenarios/wrath-and-ruin-table.test.ts).
const ULCHOR = "22011";
const GATE = "22014";
const SQUARE = "22015";
const HOUSE = "22016";
const FORTIFICATION = "22017";
const TOWER = "22018";

export const screens: ScreenMoment[] = [
  {
    name: "control-dial",
    note: "22025:B:3: stage 1B, true solo. Contested Square is under the first player's control and lies in the play row; Ransacked House, Captured Tower and Gate of Dorwinion lie in the staging area. The \"Control\" dial counts the locations controlled (1) against more than the staging area holds (4); it is a goal dial and never warms.",
    layout: { stage: "22025", side: "B", phase: "Quest", seats: 1, active: FORTIFICATION, staging: [ULCHOR, GATE, HOUSE, TOWER], controlled: [SQUARE] },
  },
  {
    name: "control-marks",
    note: "22025:B:3: stage 1B, two-handed. The Control dial and each seat's mark \"P1 1\" and \"P2 0\", the locations the seat controls (the count stays in the caption). The first player controls Contested Square.",
    layout: { stage: "22025", side: "B", phase: "Quest", seats: 2, active: FORTIFICATION, staging: [ULCHOR, GATE, HOUSE, TOWER], controlled: [SQUARE] },
  },
  {
    name: "gate-dial",
    note: "22014:A:3, 22026:B:2: stage 2B holding 7 progress. The \"Gate\" dial counts the progress against the 12 that let the players travel to Gate of Dorwinion; it follows the Control dial and is a goal dial.",
    layout: { stage: "22026", side: "B", phase: "Quest", seats: 1, progress: 7, active: FORTIFICATION, staging: [ULCHOR, GATE, HOUSE], controlled: [SQUARE, TOWER] },
  },
];
