import type { ScreenMoment } from "../../harness/screens.ts";

// The table moments the screen review shoots (`pnpm browser shot --moment desert-crossing --landscape`; test/harness/screens.ts): one for each new widget of Desert Crossing's table (docs/scenarios/haradrim/desert-crossing.md, Table), a layout (the same JSON
// `pnpm game scene` takes) and a note that says which printed line or widget it shows. The Heat dial shows from Setup, so each value is its own moment. A state only a played game reaches is not here: the Heat dial warming through a real game
// (`pnpm browser shot --fixture crossing-lost --at 40` shows a late round of the saved loss); the test src/play/scenarios/desert-crossing-table.test.ts checks every value.
export const screens: ScreenMoment[] = [
  {
    name: "heat-calm",
    note: "The Heat dial at a calm value: the temperature is 10 (the Setup value of 16068:A:1), far from the limit of 60; the dial is plain and its note says the cards read the tens digit as 1.",
    layout: { stage: "16068", temperature: 10, staging: ["16025"] },
  },
  {
    name: "heat-near",
    note: "The Heat dial near the limit: the temperature is 50 (16068:B:3, lose at 60), the dial warms and Burnt Sands in the staging area has its +2 Threat from 40 up.",
    layout: { stage: "16069", temperature: 50, staging: ["16025"] },
  },
  {
    name: "heat-critical",
    note: "The Heat dial at a critical value: the temperature is 56 (16070:B:3), the dial is solid and its warning says how far the limit is; Beasts of Legend adds the tens digit to the staging threat.",
    layout: { stage: "16070", temperature: 56, staging: ["16028"] },
  },
  {
    name: "blank-pill",
    note: "Craft Remedy (16053:A:1) is in the staging area and an ally of the first seat has damage: the ally wears the \"Blank\" pill (its text box is blank while it has damage) and its preview says so.",
    layout: { stage: "16068", temperature: 10, staging: ["16053"], play: [{ code: "ally", seat: 0, damage: 1 }] },
  },
  {
    name: "find-water",
    note: "Find Water (16048:A:1) is in the staging area: a character's preview carries the line that player card effects cannot ready it (no pill: the bar reaches every character).",
    layout: { stage: "16068", temperature: 10, staging: ["16048"], play: ["ally"] },
  },
];
