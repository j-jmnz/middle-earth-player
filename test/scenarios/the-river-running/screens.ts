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
    note: "21012:A:1 and 21075:B:2: stage 1B with Easterling Pursuit in the staging area holding 1 resource. The top bar's \"Pursuit\" dial counts the resources against the 3 that make the end of the round add enemies; it is not warm yet, and its note says the same resources add Threat to the staging area. The resources also show on the card.",
    layout: { stage: "21075", side: "B", phase: "Quest", seats: 1, staging: [{ code: PURSUIT, resources: 1 }, RIVER, OUTRIDER] },
  },
  {
    name: "pursuit-dial-near",
    note: "21012:A:1: Easterling Pursuit holds 2 resources, so the end of the round brings it to 3 and adds enemies: the \"Pursuit\" dial warms and says \"near\". It is never critical. Two-handed.",
    layout: { stage: "21075", side: "B", phase: "Quest", seats: 2, staging: [{ code: PURSUIT, resources: 2 }, RIVER, OUTRIDER] },
  },
  {
    name: "pursuit-dial-over",
    note: "21012:A:1: Easterling Pursuit holds 3 resources during the round (Enemies Close Behind or the Outrider added them), so the \"Pursuit\" dial stays warm and its warning says the end of the round takes 3 off and adds enemies. Two-handed.",
    layout: { stage: "21075", side: "B", phase: "Quest", seats: 2, staging: [{ code: PURSUIT, resources: 3 }, RIVER, OUTRIDER] },
  },
  {
    name: "cap-dial",
    note: "21076:B:2: stage 2B (The Crossing of Araw) with a player engaged with an Easterling Raider. The top bar's \"Cap\" dial shows 0 of the 5 progress that can be placed on the stage this round; it appears only while the cap is held (no cap, no dial, with nobody engaged).",
    layout: { stage: "21076", side: "B", phase: "Quest", seats: 1, staging: [OUTRIDER], engaged: [RAIDER] },
  },
  {
    name: "cap-dial-full",
    note: "21076:B:2: 5 progress are placed on stage 2B this round, so the \"Cap\" dial is full and says \"near\": no more progress can be placed until the round ends.",
    layout: { stage: "21076", side: "B", phase: "Quest", seats: 1, staging: [OUTRIDER], engaged: [RAIDER], progressPlaced: 5 },
  },
  {
    name: "two-players-stage-2b",
    note: "21076:B:2 and 21012:A:1: two players on stage 2B with the Cap dial and the Pursuit dial (holding 2) beside both threat rings, the widest top bar of the scenario. The Cap dial comes first.",
    layout: { stage: "21076", side: "B", phase: "Quest", seats: 2, staging: [{ code: PURSUIT, resources: 2 }, OUTRIDER], engaged: [RAIDER], progressPlaced: 3 },
  },
];
