import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment into-fangorn --landscape`; test/harness/screens.ts): one for each new widget of Into Fangorn's table, a layout (the same JSON `pnpm game scene` takes) and a note that says
// which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds.
const MUGASH = "07031";
const EDGE = "07032";
const ON_EDGE = { attached: [{ code: MUGASH, to: EDGE, encounter: true as const }] };
const ON_HERO = { attached: [{ code: MUGASH, to: "dh1", encounter: true as const }] };

export const screens: ScreenMoment[] = [
  { name: "time-dial-1b", layout: { stage: "07065", timeCounters: 4, staging: [EDGE], ...ON_EDGE }, note: "Stage 1B (07065:B:1): the Time dial in the top bar, 4 counters against Time 4, and Mugash held under Edge of Fangorn (07031:A:2): its pill names him." },
  { name: "time-dial-1b-last", layout: { stage: "07065", timeCounters: 1, staging: [EDGE], ...ON_EDGE }, note: "Stage 1B with 1 counter left: the dial warms and says the refresh phase takes the last one, which shuffles Mugash into the deck and advances to stage 3 (07065:B:2)." },
  { name: "time-dial-2b", layout: { stage: "07066", timeCounters: 2, ...ON_HERO, committed: ["dh1"] }, note: "Stage 2B (07066:B:1): 2 counters against Time 4 warm near; Mugash held by a hero shows on the hero as a pill." },
  { name: "time-dial-3b", layout: { stage: "07067", timeCounters: 1 }, note: "Stage 3B (07067:B:1): 1 counter left against Time 3; the dial says the last one discards 5 cards, each player adds an enemy or objective to staging, and 3 counters return (07067:B:2)." },
  { name: "time-dial-two", layout: { seats: 2, stage: "07065", timeCounters: 3, staging: [EDGE], ...ON_EDGE, threat: [31, 28] }, note: "Stage 1B with two players: both threat dials and the Time dial fit the top bar, none cut off." },
  { name: "mugash-held-hero", layout: { stage: "07066", timeCounters: 3, ...ON_HERO, committed: ["dh1"] }, note: "07031:A:3: Mugash claimed by a hero; a tap on the hero opens the line that says damage returns him to the top of the deck and any other leaving play returns him to staging." },
  { name: "mugash-free", layout: { stage: "07066", timeCounters: 3, staging: [MUGASH] }, note: "07031:A:2: Mugash lying free in the staging area once Edge of Fangorn has left play; a player can exhaust a ready hero to claim him." },
  { name: "hinder-engaged", layout: { stage: "07066", timeCounters: 3, engaged: ["07033"] }, note: "07033:A:1 Hinder: a Huorn engaged with the player; its preview says it makes no attack in combat and removes progress instead." },
  { name: "hinder-staging", layout: { stage: "07066", timeCounters: 3, staging: ["07035"] }, note: "07035:A:1 Hinder: a Huorn in the staging area; its preview says what it does once engaged." },
  { name: "off-track", layout: { stage: "07066", timeCounters: 3, staging: ["07050"], attached: [{ code: "07057", to: "07050", encounter: true }] }, note: "07057:A:2: Off Track attached to a location in the staging area; the location's preview says +2 quest points and the extra counter at each refresh phase." },
  { name: "in-need-of-rest", layout: { stage: "07066", timeCounters: 3, attached: [{ code: "07058", to: "dh1", encounter: true }], committed: ["dh1"] }, note: "07058:A:1: In Need of Rest on a hero (committed here so a tap opens its preview); its preview says the damage after each time counter comes off the current quest." },
];
