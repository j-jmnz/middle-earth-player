import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment the-temple-of-doom --landscape`; test/harness/screens.ts): one for each new widget of The Temple of Doom's table (docs/scenarios/vengeance-of-mordor/the-temple-of-doom.md, Table), a layout (the same JSON
// `pnpm game scene` takes) and a note that says which printed line or widget it shows. `scripts/browser/scene.test.ts` builds each one in Node and fails when a layout no longer builds. The dials and marks are src/play/readouts/mordor/temple.ts. A layout cannot put cards
// under a threat dial or set the threat player card effects lowered this round, so the seat marks of Lost in the Dark and Covered in Darkness at a count above 0 are checked by tests only (src/play/scenarios/the-temple-of-doom-table.test.ts).
const TRIBUTE = "21053";
const ULCHOR = "21054";
const DARK = "21065";
const NARROW = "21062";
const COVERED = "21070";
const POWER = ["21066", "21067", "21068"];

export const screens: ScreenMoment[] = [
  {
    name: "tribute-dial",
    note: "21053:A:1: Tribute to Mordor in the staging area holding 3 damage and the Power of Mordor deck beside the quest deck with 3 cards. The \"Tribute\" dial counts the damage against the 4 that reveal a card and warms near it; Thane Ulchor's dial shows his hit points beside it.",
    layout: { stage: "21080", side: "B", phase: "Quest", seats: 1, staging: [{ code: TRIBUTE, damage: 3 }, ULCHOR], piles: { powerOfMordorDeck: POWER } },
  },
  {
    name: "tribute-dial-empty-deck",
    note: "21053:A:1: the same table with the Power of Mordor deck empty. The Tribute dial warns critical: at 4 damage with no card to reveal the players lose.",
    layout: { stage: "21080", side: "B", phase: "Quest", seats: 2, staging: [{ code: TRIBUTE, damage: 3 }, ULCHOR] },
  },
  {
    name: "ulchor-dial",
    note: "21054:A:2: Thane Ulchor with 4 damage. The \"Ulchor\" dial shows his hit points left; its note says X (1 more than the quest stages in the victory display, 4 here, so X is 5 and he can be engaged).",
    layout: { stage: "21085", side: "B", phase: "Quest", seats: 1, staging: [TRIBUTE, { code: ULCHOR, damage: 4 }], victory: ["21080", "21081", "21083"] },
  },
  {
    name: "stage-one-gate",
    note: "21080:B:2: stage 1B holding no resources. The \"Temple\" dial counts the resources against the 2 that advance the quest; it is a goal dial (never warm).",
    layout: { stage: "21080", side: "B", phase: "Planning", seats: 2, staging: [TRIBUTE, ULCHOR] },
  },
  {
    name: "narrow-opening-marks",
    note: "21062:A:1: Narrow Opening is the active location, two-handed. Each seat's label is \"P1 0/1\", the cards played this round against the 1 allowed.",
    layout: { stage: "21081", side: "B", phase: "Planning", seats: 2, active: NARROW, staging: [TRIBUTE, ULCHOR] },
  },
  {
    name: "lost-in-the-dark-solo",
    note: "21065:A:1: Lost in the Dark in the staging area, true solo. The one threat ring wears \"Dark 0\": the cards under the threat dial.",
    layout: { stage: "21081", side: "B", phase: "Quest", seats: 1, staging: [TRIBUTE, ULCHOR, DARK] },
  },
  {
    name: "covered-in-darkness-marks",
    note: "21070:A:2: Covered in Darkness in the staging area, two-handed. Each seat wears \"P1 0/1\", the threat its player card effects took off this round against the 1 allowed.",
    layout: { stage: "21081", side: "B", phase: "Quest", seats: 2, staging: [TRIBUTE, ULCHOR, COVERED] },
  },
  {
    name: "covered-in-darkness-solo",
    note: "21070:A:2: Covered in Darkness in the staging area, true solo. The threat ring wears \"Lower 0/1\" (never \"Cap\", the word of stage 2B's dial).",
    layout: { stage: "21081", side: "B", phase: "Quest", seats: 1, staging: [TRIBUTE, ULCHOR, COVERED] },
  },
];
