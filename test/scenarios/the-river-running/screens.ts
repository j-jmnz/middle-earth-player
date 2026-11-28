import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-river-running --landscape`; test/harness/screens.ts): one for each new widget of The River Running's table (docs/scenarios/vengeance-of-mordor/the-river-running.md, Table), a layout (the same JSON
// `pnpm game scene` takes) and a note that says which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds. The dials are src/play/readouts/mordor/river.ts. The loss fixture `running-lost`
// (`pnpm browser shot --fixture running-lost --at <n>`) shows the same dials in a played game.
const PURSUIT = "21012";
const RIVER = "21014";
const OUTRIDER = "21013";
const RAIDER = "21020";

export const screens: ScreenMoment[] = [
  {
    name: "pursuit-dial",
    note: "21012:A:1 and 21075:B:1: stage 1B with Easterling Pursuit in the staging area holding 1 resource. The top bar's \"Pursuit\" dial counts the resources against the 3 that make the end of the round add enemies; it is not warm yet, and its note says the same resources add Threat to the staging area. The resources also show on the card.",
    layout: { stage: "21075", side: "B", phase: "Quest", seats: 1, staging: [{ code: PURSUIT, resources: 1 }, RIVER, OUTRIDER] },
  },
  {
    name: "pursuit-dial-near",
    note: "21012:A:1: Easterling Pursuit holds 2 resources, one short of the 3 that add enemies at the end of the round, so the \"Pursuit\" dial warms and says \"near\". It is never critical: the Forced effect removes the 3 at once. Two-handed.",
    layout: { stage: "21075", side: "B", phase: "Quest", seats: 2, staging: [{ code: PURSUIT, resources: 2 }, RIVER, OUTRIDER] },
  },
  {
    name: "cap-dial",
    note: "21076:B:2: stage 2B (The Crossing of Araw) with a player engaged with an Easterling Raider. The top bar's \"Cap\" dial shows 0 of the 5 progress that can be placed on the stage this round; it appears only while the cap is held (no cap, no dial, with nobody engaged).",
    layout: { stage: "21076", side: "B", phase: "Quest", seats: 1, staging: [OUTRIDER], engaged: [RAIDER] },
  },
];
