import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment beneath-the-sands --landscape`; test/harness/screens.ts): a layout (the same JSON `pnpm game scene` takes) and a note that says which printed line it shows
// (docs/scenarios/haradrim/beneath-the-sands.md, Table). Beneath the Sands adds no widget: its pieces are cards the table already draws, so each moment shows one of them.
// `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds.
export const screens: ScreenMoment[] = [
  {
    name: "off-track",
    note: "The Search objective Off Track (17079) in the staging area with 2 resources on it, as its Forced effect places them; Grabbed by Spiders (17074) is attached to the main quest and shows as one peek below the stage card.",
    layout: { stage: "17076", staging: [{ code: "17079", resources: 2 }], attached: [{ code: "17074", to: "17076", encounter: true }] },
  },
  {
    name: "on-track",
    note: "The Search objective On Track (17080, the back of the same card) in the staging area with no resources: the flip discards them (17080 is its own face).",
    layout: { stage: "17076", staging: ["17080"] },
  },
];
