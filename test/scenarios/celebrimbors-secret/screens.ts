import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment celebrimbors-secret --landscape`; test/harness/screens.ts): one for each new widget of Celebrimbor's Secret's table, a layout (the same JSON `pnpm game scene` takes) and a note that says
// which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds.
const STAGE_1 = "08122";
const STAGE_2 = "08123";
const MOULD = "08127";
const CHAMBER = "08126";
const SEARCH = "08125";
const BELLACH = "08124";
const SCOUT = "08128";
// Cards lying facedown under The Orcs' Search, as the sweep or a Shadow effect leaves them.
const beneath = (count: number) => Array.from({ length: count }, () => ({ code: SCOUT, to: SEARCH }));

export const screens: ScreenMoment[] = [
  { name: "search-dial-under", layout: { stage: STAGE_1, timeCounters: 3, staging: [SEARCH, BELLACH, "08128"], under: beneath(3) }, note: "08125:A:2, 08124:A:1: 3 cards lie facedown under The Orcs' Search. The Search dial shows 3, and its words say each player raises their threat by 3 at the end of the refresh phase and that Bellach's Threat is 3." },
  { name: "location-near-quest-points", layout: { stage: STAGE_1, timeCounters: 3, staging: [SEARCH, { code: "08133", damage: 3 }], under: beneath(1) }, note: "08125:A:1: City Remains with damage near its printed quest points: the Search dial warms and says that the location goes underneath The Orcs' Search at its quest points." },
  { name: "secret-chamber-critical", layout: { stage: STAGE_1, timeCounters: 3, staging: [SEARCH, { code: CHAMBER, damage: 4 }], attached: [{ code: MOULD, to: CHAMBER, encounter: true }] }, note: "08126:A:3, 08125:A:1: The Secret Chamber with 4 of 6 damage: the Search dial is critical and says that at 6 the Chamber goes underneath The Orcs' Search and the players lose the game. The Mould lies on the Chamber and is held by no hero." },
  { name: "mould-on-hero", layout: { stage: STAGE_1, timeCounters: 3, staging: [SEARCH], attached: [{ code: MOULD, to: "dh1", encounter: true }] }, note: "08127:A:1, 08127:A:2: the Mould is attached to a hero. The hero wears the held pill, the Mould's preview says that the hero leaving play loses the game, and the time dial of stage 1 shows that the stage may advance." },
  { name: "mould-on-bellach", layout: { stage: STAGE_2, progress: 4, staging: [SEARCH, BELLACH], attached: [{ code: MOULD, to: BELLACH, encounter: true }], timeCounters: 2 }, note: "08123:A:1, 08123:B:4: the Mould lies on Bellach in the staging area, held by no hero. The stage's gate words say the players cannot defeat the stage until the Mould is on a hero, and Bellach's pill names the Mould." },
  { name: "bellach-preview-before-12", layout: { stage: STAGE_2, progress: 5, staging: [SEARCH, BELLACH], timeCounters: 3 }, note: "08123:B:3: Bellach's preview with 5 progress on the stage: it is immune to player card effects and cannot be engaged, and says it changes at 12 progress." },
  { name: "bellach-preview-after-12", layout: { stage: STAGE_2, progress: 12, staging: [SEARCH, BELLACH], timeCounters: 3 }, note: "08123:B:3: Bellach's preview with 12 progress on the stage: the immunity and the engagement bar are lifted, so a player may engage it." },
  { name: "time-dial-gated", layout: { stage: STAGE_2, progress: 20, staging: [SEARCH, BELLACH], attached: [{ code: MOULD, to: BELLACH, encounter: true }], timeCounters: 1 }, note: "08123:B:1, 08123:B:2, 08123:B:4: the Time 3 dial on its last counter on a gated stage: the words say the last counter triggers each Scour effect in play and places 3 counters again, and the stage with 20 progress waits for the Mould." },
];
