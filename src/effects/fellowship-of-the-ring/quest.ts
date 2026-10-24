import type { Effect } from "../../catalog/boundary.ts";

// Quest cards for A Shadow of the Past (MEC109 quest cards 22-24, codes 141022-141024).
// Read via Hall of Beorn 2026-10-24, TBR printing (quest cards 28-30 there). Confirm on the cards.
//
// A Setup record for a card the definition puts out describes the instructions that the scenario
// definition already runs (see scenario-fixture.ts). searchSetup only runs a Setup record for a card it
// finds in a deck, so these records never place a card a second time. A test keeps them in step.

const NAZGUL_ENGAGE: Omit<Effect, "id" | "cardCode"> = {
  timing: "triggered",
  trigger: "hideFailed",
  instructions: [{ verb: "EngageAll", trait: "Nazgûl", who: "actor" }],
};

const FIND_BLACK_RIDER: Effect["instructions"] = [
  { verb: "SearchReveal", code: "141039", who: "firstPlayer" },
  { verb: "ShuffleEncounterDeck" },
];

export const QUEST_EFFECTS: readonly Effect[] = [
  // 141022 Three is Company, side A.
  {
    id: "141022:setup:1",
    cardCode: "141022",
    timing: "setup",
    instructions: [
      { verb: "SetAside", code: "141035" },
      { verb: "AddToStaging", code: "141039" },
      { verb: "MakeActiveLocation", code: "141031" },
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  { id: "141022:triggered:1", cardCode: "141022", ...NAZGUL_ENGAGE },
  // 141023 A Shortcut to Mushrooms.
  { id: "141023:whenRevealed:1", cardCode: "141023", timing: "whenRevealed", instructions: FIND_BLACK_RIDER },
  { id: "141023:triggered:1", cardCode: "141023", ...NAZGUL_ENGAGE },
  // 141024 Escape to Buckland.
  {
    id: "141024:whenRevealed:1",
    cardCode: "141024",
    timing: "whenRevealed",
    instructions: [{ verb: "AddSetAsideToStaging", code: "141035" }],
  },
  { id: "141024:whenRevealed:2", cardCode: "141024", timing: "whenRevealed", instructions: FIND_BLACK_RIDER },
  { id: "141024:triggered:1", cardCode: "141024", ...NAZGUL_ENGAGE },
];
