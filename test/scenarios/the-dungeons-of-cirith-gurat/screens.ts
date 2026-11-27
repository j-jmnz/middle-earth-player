import type { Layout } from "../../harness/layout.ts";
import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-dungeons-of-cirith-gurat --landscape`; test/harness/screens.ts): one for each new widget of The Dungeons of Cirith Gurat's table (docs/scenarios/haradrim/the-dungeons-of-cirith-gurat.md, Table), a layout
// (the same JSON `pnpm game scene` takes) and a note that says which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds. A state only a played game reaches is not here: the fixture
// `gurat-lost` (`pnpm browser shot --fixture gurat-lost --at <n>`) and the goldens (`pnpm game show the-dungeons-of-cirith-gurat/<n> --at <n>`) show the rest.
const CELL = "17125";
const JAILER = "17121";
const CAPTURED = "17131";
const ABAAN = "17120";
const ALLY = "01013";
const BASE: Layout = { seats: 2, stage: "17132", side: "B", phase: "Quest" };

export const screens: ScreenMoment[] = [
  {
    name: "ally-under-dungeon-cell",
    note: "17125:A:3: an ally destroyed while Dungeon Cell is in the staging area is attached to it: drawn faceup under Dungeon Cell, its preview names its owner (\"Player 1's ally\"), its holder and that it returns, exhausted, when Dungeon Cell leaves play; Dungeon Cell's preview lists it.",
    layout: { ...BASE, staging: [CELL], play: [ALLY], captive: [{ hero: ALLY, under: CELL }] },
  },
  {
    name: "abaan-held",
    note: "17120:A:1, 17132:A:1: Abaan lies faceup under Dungeon Cell with no owner; his preview says who holds him, that the first player gains control of him when Dungeon Cell leaves play and that the players lose if he leaves play.",
    layout: { ...BASE, staging: [CELL, ABAAN], captive: [{ hero: ABAAN, under: CELL }] },
  },
  {
    name: "hero-captured",
    note: "17134:A:1: at stage 3A (Fight Your Way Out) each player's chosen hero lies faceup under an enemy in the staging area, the enemy wearing \"1 held\"; the hero's preview says who guards it and that it returns, exhausted, and its seat's dial says it is guarded by that enemy.",
    layout: { ...BASE, stage: "17134", side: "A", staging: [JAILER, "16062"], staged: [{ hero: "dh1", under: JAILER }, { hero: "dh2", under: "16062" }] },
  },
  {
    name: "captured-holds-allies",
    note: "17131:A:1: the side quest Captured! in the staging area holds the ally attached to it, drawn faceup under it; the ally's preview says it returns to its owner, exhausted, when Captured! leaves play, and its owner's dial says it is captured by Captured!.",
    layout: { ...BASE, staging: [CAPTURED], play: [ALLY], captive: [{ hero: ALLY, under: CAPTURED }] },
  },
  {
    name: "abaan-freed",
    note: "17120:A:1: Abaan free of encounters lies in the first player's play area as any card that player controls (no held mark, no guard); the loss line is still in his preview.",
    layout: { ...BASE, stage: "17133", play: [ABAAN] },
  },
];
