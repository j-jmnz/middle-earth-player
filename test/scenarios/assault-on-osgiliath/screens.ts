import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment assault-on-osgiliath --landscape`; test/harness/screens.ts).
export const screens: ScreenMoment[] = [
  {
    name: "controlled-locations",
    note: "Stage 1B (06091:B:2): the first player controls West Gate and West Quarter, so they lie in his play area beside his heroes and the top-bar dial reads 2/3 Controlled (ats.controlling-locations); the King's Library is still in the staging area.",
    layout: { stage: "06091", controlled: ["06096", "06100"], staging: ["06097"] },
  },
];
