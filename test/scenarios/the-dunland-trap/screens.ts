import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-dunland-trap --landscape`; test/harness/screens.ts): one for each new widget of The Dunland Trap's table, a layout (the same JSON `pnpm game scene` takes) and a note that says
// which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds.
const TURCH = "08014";
const RAVINE = "08015";

export const screens: ScreenMoment[] = [
  { name: "time-dial-1b", layout: { stage: "08011", timeCounters: 2 }, note: "Stage 1B (08011:B:1): the Time dial in the top bar, 2 counters against Time 2." },
  { name: "time-dial-1b-last", layout: { stage: "08011", timeCounters: 1 }, note: "Stage 1B with 1 counter left: the dial warms and says the last one makes each player discard the hand and draw 2, and 2 counters return (08011:B:2)." },
  { name: "time-dial-3b", layout: { stage: "08013", timeCounters: 5, engaged: [TURCH] }, note: "Stage 3B (08013:B:1), one player: 5 counters against Time 5 x 1 player, with Chief Turch engaged." },
  { name: "time-dial-3b-two", layout: { seats: 2, stage: "08013", timeCounters: 10, engaged: [TURCH], threat: [31, 28] }, note: "Stage 3B with two players: Time 5 x 2 players, 10 counters; both threat dials and the Time dial fit the top bar, none cut off." },
  { name: "time-dial-3b-last", layout: { stage: "08013", timeCounters: 1, engaged: [TURCH] }, note: "Stage 3B with 1 counter left: the dial says the last one makes the checks and attacks, and the players win unless a hero is destroyed (08013:B:3)." },
  { name: "turch-engaged", layout: { stage: "08013", timeCounters: 5, engaged: [TURCH] }, note: "08014:A:1 to A:3: Chief Turch engaged with the first player; a tap opens his preview (cannot leave play or be destroyed, follows the first player, a counter for each engagement)." },
  { name: "hills-staging", layout: { stage: "08012", staging: ["08020"] }, note: "08020:A:1: Hills of Dunland in the staging area; its preview says the draw effect, once for all copies." },
  { name: "ravine-dunland", layout: { stage: "08012", active: RAVINE, engaged: ["07046"] }, note: "08015:A:1: Munuv Dûv Ravine is the active location; the Ravine's preview and the engaged Dunland enemy's Effects rows name the +1 Attack and +1 Defense." },
  { name: "old-south-road", layout: { stage: "08011", timeCounters: 2, active: "08016" }, note: "08016:A:1 on stage 1B: Old South Road is the active location with 2 counters left; the dial warns that the next refresh phase takes both, and the Road's preview says the extra counter." },
];
