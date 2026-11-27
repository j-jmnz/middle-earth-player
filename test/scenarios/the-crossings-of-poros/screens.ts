import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-crossings-of-poros --landscape`; test/harness/screens.ts): one for each new widget of The Crossings of Poros's table (docs/scenarios/haradrim/the-crossings-of-poros.md, Table), a layout (the same JSON
// `pnpm game scene` takes) and a note that says which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds. The dials are src/play/readouts/haradrim/poros.ts; the true shapes are in the fixture `poros-lost`
// (`pnpm browser shot --fixture poros-lost --at 10`).
const SERPENT = "17146";
const GARRISON = "17145";
// The cards the Setup sets aside (17157:A:1): Mountains of Shadow, Desert Sands, Desert Creatures, Harad Soldiers and Mordor Orcs, in the order the scenario deals them.
const ASIDE = ["17153", "17154", "17155", "17156", "16048", "16049", "16050", "16051", "16052", "16053", "16054", "16055", "16040", "16041", "16042", "16043", "16044", "16060", "16061", "16062", "16063", "16064", "16065"];
const SOUTHRON_ARCHER = "16043";
const URUK_PROWLER = "17148";

export const screens: ScreenMoment[] = [
  {
    name: "aside-and-path-dials",
    note: "17157:A:1 and 17157:B:2: after the Setup, the top bar's \"Aside\" dial counts the cards the five set aside sets still hold (the set with the most is marked, ties are named and the first player chooses), the \"Path\" dial shows stage 1 of 4 with the stage 2 and 3 cards not chosen yet, and The Black Serpent lies in the staging area. Poros Garrison is set aside, so no \"Garrison\" dial.",
    layout: { stage: "17157", side: "B", phase: "Planning", seats: 2, staging: [SERPENT], setAside: [GARRISON, ...ASIDE] },
  },
  {
    name: "path-stage-3-after-stage-2",
    note: "17159:B:2 and 17161:A:1: the players are on Southron Pursuit (stage 3 of 4). The \"Path\" dial lists the stage cards as played, in play, removed or not chosen yet; the \"Aside\" dial counts what is still set aside: only the Mordor Orcs set (6 cards); the sets the earlier stages shuffled in or removed are gone from it. Southron Pursuit's -10 engagement cost shows on the staged Uruk Prowler.",
    layout: { stage: "17161", side: "B", phase: "Quest", seats: 1, stages: ["17157", "17159", "17161", "17163"], staging: [SERPENT, URUK_PROWLER], setAside: [GARRISON, "16060", "16061", "16062", "16063", "16064", "16065", "17160", "17162"] },
  },
  {
    name: "garrison-in-play",
    note: "17145:A:1, 17145:A:3, 17145:A:4 and 17163:A:1: stage 4B, Poros Garrison in the first player's play area with 4 damage. The \"Garrison\" dial shows the damage against its hit points and warms near them, the first player's seat wears the mark \"P1 · Garrison\", and its note says the players lose when it leaves play.",
    layout: { stage: "17163", side: "B", phase: "Combat", seats: 2, play: [{ code: GARRISON, seat: 0, damage: 4 }], staging: [SERPENT, URUK_PROWLER, SOUTHRON_ARCHER], setAside: ASIDE },
  },
  {
    name: "garrison-near-leaving-play",
    note: "17145:A:4: Poros Garrison holds all but one of its hit points, so the \"Garrison\" dial is in its critical state and says that one more damage makes the players lose the game. True solo, so its mark is \"Garrison\" with no seat.",
    layout: { stage: "17163", side: "B", phase: "Combat", seats: 1, play: [{ code: GARRISON, seat: 0, damage: 5 }], staging: [SERPENT, URUK_PROWLER] },
  },
  {
    name: "black-serpent-staged",
    note: "17146:A:1 to A:3: The Black Serpent in the staging area on stage 2 (X = 2): its Threat, Attack and Defense with the stage number added, in its preview. It is never considered engaged here (no objective to claim), so it wears no Engaged chip and the engagement area reads empty.",
    layout: { stage: "17158", side: "B", phase: "Quest", seats: 1, staging: [SERPENT, URUK_PROWLER] },
  },
];
