import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-fords-of-isen --landscape`; test/harness/screens.ts): one for each new widget of The Fords of Isen's table, a layout (the same JSON `pnpm game scene` takes) and a note that says
// which printed line or widget it shows. TODO: write them while the scenario is built, and name them in the `ux` brief. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds.
export const screens: ScreenMoment[] = [];
