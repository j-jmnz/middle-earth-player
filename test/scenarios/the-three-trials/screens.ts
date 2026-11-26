import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-three-trials --landscape`; test/harness/screens.ts): one for each new widget of The Three Trials's table, a layout (the same JSON `pnpm game scene` takes) and a note that says
// which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds.
const STRENGTH = "08036";
const PERSEVERANCE = "08037";
// The Key a 2A marked as the current trial's: held from the stage in play, as its When Revealed record leaves it (the flag `trialKey`).
const marked = (key: string, stage: string) => ({ modified: [{ code: key, from: stage, stats: [["trialKey", 1]] as const }] });
const keyOnGuardian = { attached: [{ code: "08043", to: "08040", encounter: true as const }], ...marked("08043", STRENGTH) };

export const screens: ScreenMoment[] = [
  { name: "trial-key-on-guardian", layout: { stage: STRENGTH, staging: [{ code: "08040", resources: 2 }, "08046"], ...keyOnGuardian }, note: "08036:B:2: the Key dial says Key of the Boar is the current trial's and lies on Boar's Guardian, controlled by no player; the Guardian's pill names the Key (08043:A:1)." },
  { name: "trial-key-claimed", layout: { stage: STRENGTH, staging: ["08046"], attached: [{ code: "08043", to: "dh1", encounter: true }], ...marked("08043", STRENGTH), committed: ["dh1"] }, note: "08036:B:2: a hero holds the current trial's Key, so the Key dial is full and says the players control it; the hero's pill names the Key and its preview says it counts toward Hallowed Circle's cost." },
  { name: "trial-key-barrow", layout: { stage: PERSEVERANCE, staging: ["08046", "08044"], attached: [{ code: "08044", to: "08046", encounter: true }], ...marked("08044", PERSEVERANCE) }, note: "08037:A:1: the Key lies on a Barrow location in the staging area; the Barrow's pill names the Key." },
  { name: "guardian-time", layout: { stage: STRENGTH, engaged: [{ code: "08041", resources: 3 }] }, note: "08041:A:2: Wolf's Guardian engaged, 3 time counters against Time 3; the dial says one comes off each refresh phase and what the last one does to the engaged player." },
  { name: "guardian-time-last", layout: { stage: PERSEVERANCE, engaged: [{ code: "08042", resources: 1 }] }, note: "08042:A:2: Raven's Guardian on its last counter: the dial warms and says the refresh phase takes it, it deals 1 damage to each character the engaged player controls, and 4 counters return." },
  { name: "guardian-time-two-players", layout: { seats: 2, stage: STRENGTH, engaged: [{ code: "08040", seat: 1, resources: 1 }], threat: [31, 28] }, note: "08040:A:2: two players, Boar's Guardian engaged with Player 2 on its last counter: the dial names Player 2, and both threat dials and the Guardian's dial fit the top bar." },
  { name: "guardian-staging", layout: { stage: STRENGTH, staging: [{ code: "08040", resources: 1 }] }, note: "08040:A:2: a Guardian in the staging area on its last counter: the dial says no player is engaged, so the effect does nothing and the counters return." },
  { name: "victory-guardians", layout: { stage: "08039", side: "A", victory: ["08040", "08041"] }, note: "08039:A:1: two Guardians in the victory display; the Victory dial lists them and says stage 3A reveals each again with fresh counters." },
  { name: "hallowed-circle-cost", layout: { stage: "08039", staging: ["08049"], attached: [{ code: "08043", to: "dh1", encounter: true }, { code: "08044", to: "dh2", encounter: true }], committed: ["dh1"] }, note: "08049:A:2: Hallowed Circle in staging with 2 ready Keys held; tap it: the preview says the Travel cost is 3 ready Key objectives, not their heroes, and the players cannot yet pay." },
];
