import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-morgul-vale --landscape`; test/harness/screens.ts).
export const screens: ScreenMoment[] = [
  {
    name: "captain-bodyguard",
    note: "Stage 1B (06144:B:1): Murzag, the Captain, is engaged with 2 damage while a Morgul Bodyguard lies in the staging area, so damage to him goes to the Bodyguard (06148:A:1; tap either card for its preview); the Tower dial reads 8/10 (06147:A:3: 10 loses).",
    layout: { phase: "Combat", stage: "06144", engaged: [{ code: "06151", damage: 2 }], staging: ["06148", { code: "06147", progress: 8 }] },
  },
  {
    name: "to-the-tower-nine",
    note: "To the Tower with 9 progress (06147:A:3): the Tower dial reads 9/10, one step from the 10 that lose the game.",
    layout: { stage: "06144", staging: [{ code: "06147", progress: 9 }, "06151"] },
  },
];
