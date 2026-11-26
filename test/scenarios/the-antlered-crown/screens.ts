import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-antlered-crown --landscape`; test/harness/screens.ts): one for each new widget of The Antlered Crown's table, a layout (the same JSON `pnpm game scene` takes) and a note that says
// which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds.
const BATTLEFIELD = (counters: number) => ({ code: "08157", resources: counters });
const CAMP = { code: "08152", resources: 3 };

export const screens: ScreenMoment[] = [
  { name: "raven-deck", layout: { stage: "08147", timeCounters: 3, active: BATTLEFIELD(3), piles: { ravenDeck: ["08153", "08154", "08155", "07046"], ravenDiscard: ["07048"] } }, note: "08147:A:1: the Raven deck (count, the word Raven) and its discard pile, the second piles of the table; the pair appears once the Setup built the deck." },
  { name: "stage-dial-warm", layout: { stage: "08147", timeCounters: 1, active: BATTLEFIELD(2) }, note: "08147:B:1: the stage 1 time dial at its last counter (warm): the next refresh phase takes it, and 08147:B:2 then takes a counter off each location in play and puts 3 back on the stage." },
  { name: "location-dial-last", layout: { stage: "08148", timeCounters: 2, active: BATTLEFIELD(1), staging: [{ code: "08155", resources: 2 }] }, note: "08157:A:1: Dunland Battlefield's time dial at its last counter, next to Raven War-camp's dial at 2: the last counter makes each player assign damage equal to the cards in their hand." },
  { name: "turch-two-handed", layout: { seats: 2, stage: "08147", timeCounters: 3, active: BATTLEFIELD(3), play: ["08150"] }, note: "08150:A:1 to 08150:A:3: Chief Turch in the first player's play area, two-handed; his preview names who controls him, that he follows the first player token and that the players lose if he leaves play." },
  { name: "raven-chief-with-camp", layout: { stage: "08149", timeCounters: 2, staging: ["08151", CAMP] }, note: "08151:A:1 and 08152:A:2: Raven Chief in the staging area while the Camp is in play, so he cannot be damaged; the Camp's time dial shows 3 counters." },
  { name: "raven-chief-without-camp", layout: { stage: "08149", timeCounters: 2, staging: ["08151"], victory: ["08152"] }, note: "08151:A:1: the Camp lies in the victory display, so Raven Chief can be damaged: the preview no longer says he is shielded." },
  { name: "stage-3-win", layout: { stage: "08149", timeCounters: 1, victory: ["08151", "08152"] }, note: "08149:B:3: Raven Chief in the victory display on stage 3; the stage's objective line reads the win at the end of the round, and the stage 3 time dial warms at its last counter (08149:B:2)." },
  { name: "location-dials-two-handed", layout: { seats: 2, stage: "08148", timeCounters: 2, active: BATTLEFIELD(3), staging: [{ code: "08155", resources: 2 }, { code: "08156", resources: 1 }, { code: "08158", resources: 4 }, CAMP] }, note: "08155:A:1 to 08158:A:1: two-handed, only the active location (accent ring) and the location on its last counter (Village) have a dial beside the stage dial; the others show their counters on the card token." },
];
