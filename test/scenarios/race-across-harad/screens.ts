import type { ScreenMoment } from "../../harness/screens.ts";
import type { Layout } from "../../harness/layout.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment race-across-harad --landscape`; test/harness/screens.ts): one for each new widget of Race Across Harad's table (docs/scenarios/haradrim/race-across-harad.md, Table), a layout (the same JSON
// `pnpm game scene` takes) and a note that says which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds. A state only a played game reaches is not here: it is read as text from
// the goldens (`pnpm game show race-across-harad/<n> --at <n> --legal`; `pnpm browser shot --fixture` takes only a fixture, so the review reads these as text, and shoots the fixture `harad-lost` for the end of a lost game). The golden numbers are the order of
// HARAD_GOLDENS (test/scenarios/race-across-harad/game.ts):
//   1 --at 2     the Warg-rider Choose (17048:A:1), solo: the first player chooses `staging` or `orcsArea`; 2 --at 4 is the same window in the two-handed golden.
//   4 --at 25    the Racing Warg pick (17044:A:2), solo: the Orc enemy that carries it, in the staging area, engaged, or in the Orcs' area; 8 --at 32 is the same window of the threat loss, 2 --at 133 of the two-handed win.
//   2 --at 22    the Uruk Chieftain's pick (16061, two players): the player it engages; 2 --at 56 is the Mordor Warg (16064:A:1) choice of a host.
//   1 --at 72    the Tamed Mûmak with its first damage of an undefended attack (17038:A:2), two enemies engaged and no defender ready; 6 --at 38 is the last of it: the Mûmak destroyed and the player eliminated (17038:A:3).
//   1 --at 16    the Orcs' advance banner (the Orcs go from stage 1 to stage 2 at the end of the quest phase, 17051:B:2); 1 --at 25 and 1 --at 41 are the next two advances, 3 --at 46 the loss at stage 2D (17052:B:3).
const STAGES = ["17051", "17052", "17053", "17054"];
const AREA = { stages: STAGES, place: ["16061"] };
const base = (stage: string, orcs: NonNullable<Layout["orcs"]>): Layout => ({ seats: 1, stage, side: "B", phase: "Quest", setAside: [...STAGES, "16061"], staging: ["16049", "17042", "16062"], orcs, play: ["17038"] });

export const screens: ScreenMoment[] = [
  {
    name: "orcs-apart",
    note: "17047:A:1, 17040:A:1: the Orcs' area at stage 1 with 4 of its 10 progress while the players are at stage 2: the stage heads the staging row with its \"Apart\" plate, and Uruk Chieftain, Harad Road and Uruk of Mordor stand in the area under the night veil, out of reach (no Threat, no engagement, no travel). Towering Dunes is an ordinary staging card.",
    layout: base("17048", { ...AREA, members: ["17042", "16062"], progress: 4 }),
  },
  {
    name: "orcs-together",
    note: "hrd.orcs-area-same-stage: the players are at stage 1, the Orcs' stage: the veil lifts, Uruk Chieftain, Harad Road and Uruk of Mordor count as staging cards (Threat, engagement, travel, player card effects) and the stage has no \"Apart\" plate.",
    layout: base("17047", { ...AREA, members: ["17042", "16062"], progress: 4 }),
  },
  {
    name: "tamed-mumak-damaged",
    note: "17038:A:2: the first player's Tamed Mûmak (8 hit points) has 6 damage from undefended attacks, with Uruk Chieftain and Uruk of Mordor engaged with the player; its preview says all damage of an undefended attack goes to it and that its leaving play eliminates its controller.",
    layout: { seats: 1, stage: "17049", side: "B", phase: "Combat", setAside: [...STAGES], staging: ["16049"], engaged: [{ code: "16062", seat: 0 }, { code: "16064", seat: 0 }], play: [{ code: "17038", seat: 0, damage: 6 }], orcs: { stages: STAGES, progress: 6 } },
  },
];
