import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-black-serpent --landscape`; test/harness/screens.ts): one for each piece of The Black Serpent's table (docs/scenarios/haradrim/the-black-serpent.md, Table), a layout (the same JSON `pnpm game scene` takes)
// and a note that says which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds. No new widget: each piece is drawn by the table code that is on `main`.
// The guarded moment uses the layout's `guard` option: the guard is attached to the objective and stays in the staging area, as Guarded leaves it. The held moment
// uses the layout's `claimed` option, which leaves the objective in zone `attached` on the hero as ClaimObjective does. The true shapes are in the fixture `serpent-lost` (`pnpm browser shot --fixture serpent-lost --at 10`: Banner of the Serpent guarded by a Southron Archer).
const SERPENT = "17094";
const BANNER = "17091";
const GARB = "17092";
const GUARD = "17095";
const SIDE_QUEST = "17104";

export const screens: ScreenMoment[] = [
  {
    name: "objective-guarded-in-staging",
    note: "17091:A:1 and rr.guarded: Banner of the Serpent lies in the staging area guarded by a Serpent Guard (attached to it, in the staging area), with The Black Serpent. It wears the Guarded chip. Nobody controls the objective, so no Action is offered; the staged guard counts its Threat.",
    layout: { stage: "17106", side: "B", phase: "Quest", seats: 2, staging: [SERPENT, BANNER], attached: [{ code: GUARD, to: BANNER, guard: true }] },
  },
  {
    name: "objective-held-by-hero",
    note: "17092:A:3 and the stage's claim line (17106:B:1): The Serpent's Garb is claimed (zone attached, as ClaimObjective leaves it) and held by the first hero, drawn under that hero. Its Action (exhaust, raise your threat by 1) is offered to that player only, and only while a Harad enemy is in the staging area (the Serpent is).",
    layout: { stage: "17106", side: "B", phase: "Quest", seats: 2, staging: [SERPENT], claimed: [{ code: GARB, by: "dh1" }] },
  },
  {
    name: "serpent-considered-engaged",
    note: "17107:B:2: a hero holds the Serpent's Garb, so The Black Serpent in the staging area is considered engaged with that player: the Engaged chip on its card, \"The Black Serpent is engaged with you\" in the empty engagement area, the quest readout's note that it adds no threat, and the totals of its stage-number stats in its preview.",
    layout: { stage: "17107", side: "B", phase: "Quest", seats: 1, staging: [SERPENT, GUARD], claimed: [{ code: GARB, by: "dh1" }] },
  },
  {
    name: "objective-hung-on-the-serpent",
    note: "17108:A:1: stage 3A hung the random set-aside objective (Banner of the Serpent) on The Black Serpent, drawn under it in the staging area. Stage 3B cannot be defeated while it hangs there; with 6 progress the Serpent can take damage again (17108:B:2).",
    layout: { stage: "17108", side: "B", phase: "Quest", seats: 2, progress: 3, staging: [SERPENT], attached: [{ code: BANNER, to: SERPENT, encounter: true }] },
  },
  {
    name: "dont-let-them-escape-in-staging",
    note: "17104:A:1: Don't Let Them Escape! lies in the staging area as an encounter side quest, with a Harad Soldier. Its Forced effect (discard all progress from the main quest at the end of the round) is active while it is in the staging area.",
    layout: { stage: "17106", side: "B", phase: "Quest", seats: 2, progress: 4, staging: [SIDE_QUEST, GUARD] },
  },
];
