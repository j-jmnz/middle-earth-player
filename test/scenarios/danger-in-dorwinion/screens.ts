import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment danger-in-dorwinion --landscape`; test/harness/screens.ts): one for each new widget of Danger in Dorwinion's table (docs/scenarios/vengeance-of-mordor/danger-in-dorwinion.md, Table), a layout (the same JSON
// `pnpm game scene` takes) and a note that says which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds. The dials are src/play/readouts/mordor/dorwinion.ts, the pill is
// src/play/readouts/mordor/tavern.ts. The loss fixture `dorwinion-lost` (`pnpm browser shot --fixture dorwinion-lost --at <n>`) shows the same widgets in a played game. Checked by tests only (src/play/scenarios/danger-in-dorwinion-table.test.ts): the Hillside Manor
// mark at "Cap 1/1" (a layout cannot set the threat player card effects lowered this round).
const SIDE_STREET = "21049";
const MANOR = "21037";
const TAVERN = "21047";
const BRIBES = "21033";
const WORSHIP = "21035";

export const screens: ScreenMoment[] = [
  {
    name: "gate-dial",
    note: "21077:B:2: stage 1B with no resources on it and 5 progress, its 5 quest points. The top bar's \"Gate\" dial counts the resources against the 2 that let the stage be defeated; it is a goal dial (never warm) and says \"near\" once the progress would defeat the stage but the resources do not.",
    layout: { stage: "21077", side: "B", phase: "Quest", seats: 1, progress: 5, staging: [SIDE_STREET] },
  },
  {
    name: "gate-dial-two-players",
    note: "21078:B:2: stage 2B with two players, so the Gate dial counts against 5 (the players plus 3). The widest top bar with the two threat rings.",
    layout: { stage: "21078", side: "B", phase: "Quest", seats: 2, progress: 4, staging: [SIDE_STREET] },
  },
  {
    name: "bribes-dial",
    note: "21033:A:1: Bribes in the staging area holding 3 resources, each adding 1 Threat to the staging area. The \"Bribes\" dial has no limit; its note says what the Forced effect does with the resources.",
    layout: { stage: "21078", side: "B", phase: "Quest", seats: 1, staging: [SIDE_STREET, { code: BRIBES, resources: 3 }] },
  },
  {
    name: "worship-dial",
    note: "21035:A:2: Sauron Worship in the staging area holding 2 damage, each lowering every player's elimination level by 1. The \"Worship\" dial has no limit.",
    layout: { stage: "21078", side: "B", phase: "Quest", seats: 2, staging: [SIDE_STREET, { code: WORSHIP, damage: 2 }] },
  },
  {
    name: "manor-seat-mark-solo",
    note: "21037:A:1: Hillside Manor in the staging area, true solo. The one threat ring wears \"Cap 0/1\" in place of \"Threat\": the threat player card effects took off it this round against the 1 allowed.",
    layout: { stage: "21077", side: "B", phase: "Quest", seats: 1, staging: [SIDE_STREET, MANOR] },
  },
  {
    name: "manor-seat-mark",
    note: "21037:A:1: Hillside Manor in the staging area. Two-handed: each seat's label is \"P1 0/1\", short enough for a crowded top bar's caption (captionOf), so the count shows under each ring.",
    layout: { stage: "21077", side: "B", phase: "Quest", seats: 2, staging: [SIDE_STREET, MANOR] },
  },
  {
    name: "tavern-facedown",
    note: "21047:A:3: Seedy Tavern in the staging area with 2 encounter cards facedown under it. The location wears the pill \"2 facedown\" and never says which cards.",
    layout: { stage: "21077", side: "B", phase: "Quest", seats: 1, staging: [SIDE_STREET, TAVERN], under: [{ code: "21034", to: TAVERN }, { code: "21035", to: TAVERN }] },
  },
];
