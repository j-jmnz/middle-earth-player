import type { Layout } from "../../harness/layout.ts";
import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-long-arm-of-mordor --landscape`; test/harness/screens.ts): one for each new widget of The Long Arm of Mordor's table (docs/scenarios/haradrim/the-long-arm-of-mordor.md, Table), a layout (the same JSON
// `pnpm game scene` takes) and a note that says which printed line or widget it shows. A state only a played game reaches is not here. TakeObjectiveHero is shot from the fixture (`pnpm browser shot --fixture mordor-lost --at 3`, the first player's pick of one of the four objective-heroes, and `--at 4` the second's). The fixture is a loss in round 4 and never reaches
// the other trays, which a layout cannot open either; the golden `the-long-arm-of-mordor/2` (two-handed, won) opens them as text (`pnpm game show the-long-arm-of-mordor/2 --at <n>`): ReleaseStagedHero at 15 and 16 (stage 1B), GuardStagedHeroes at 63 and 64 (the pairing of 16073:A:1)
// and EngageSeatWithMost at 176 (a tie between the two players, 16061:A:3); the words test src/play/words checks their asks.
const ORC = "16062";
const KAHLIEL = "16031";
const FIRYAL = "16032";
// What the settle sweep leaves on a hero in the staging area: the blank text box and the immunity.
const MARKS = (code: string) => ({ code, from: code, stats: [["blankText", 1], ["immuneToPlayerCards", 1]] as const });
const STAGED: Layout = { seats: 2, staging: [ORC, "16035", "16035"], staged: [{ hero: "dh1" }, { hero: "dh2" }, { hero: "dh3" }], modified: [MARKS("dh1"), MARKS("dh2"), MARKS("dh3")] };

export const screens: ScreenMoment[] = [
  {
    name: "heroes-staged",
    note: "16071:A:1: after the Setup of two seats every hero is in the staging area beside the two Sauron's Enforcers, faceup, wearing the Blank pill; a tap opens the owner, the immunity and that a quest stage gives the hero back, exhausted. Each seat's dial says its heroes are in the staging area.",
    layout: { ...STAGED, stage: "16071", side: "B", phase: "Quest" },
  },
  {
    name: "guarded-hero",
    note: "16073:A:1: a hero under the Orc that guards it, faceup, the Orc wearing \"1 held\"; the hero's preview says who guards it and that it returns, exhausted, when the guard leaves play, and the Orc's says whom it holds (16073:B:2).",
    layout: { seats: 2, stage: "16073", side: "B", phase: "Quest", staging: [ORC], staged: [{ hero: "dh1", under: ORC }, { hero: "dh2" }], modified: [MARKS("dh1"), MARKS("dh2")] },
  },
  {
    name: "objective-heroes",
    note: "16031:A:2: two seats each hold an objective-hero with 2 resources; a tap on one says that its player is eliminated from the game if it leaves play, however it leaves play.",
    layout: { seats: 2, stage: "16071", side: "B", phase: "Quest", heroes: [{ code: KAHLIEL, seat: 0, resources: 2 }, { code: FIRYAL, seat: 1, resources: 2 }], modified: [KAHLIEL, FIRYAL].map((code) => ({ code, from: code, stats: [["heroType", 1]] as const })) },
  },
  {
    name: "enforcers-x",
    note: "16035:A:1: Sauron's Enforcers on stage 3 (16073): its preview says X is the stage number of the main quest, so its Threat, Attack and Defense read 3 now; Southron Boma beside it reads 3 for its Threat only (16036:A:1).",
    layout: { stage: "16073", side: "A", phase: "Quest", staging: ["16035", "16036"] },
  },
];
