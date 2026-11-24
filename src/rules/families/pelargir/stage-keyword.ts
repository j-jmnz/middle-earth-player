// Rules: hon.battle, hon.siege, faq.errata.06123 (data/rules/entries.json); ledger line 05076:B:3.
// A stage that loses a keyword it prints: The Last Battle "gains battle and loses siege" once the players have 4 victory points. The constant sets the flag `losesSiege` and a `battle` flag; the quest keyword reads (quest/conditions.ts currentQuestHas) skip the printed Siege while the flag holds.
import { flagged, type ScenarioState } from "../../core/state.ts";

/** Whether the quest stage has lost this keyword by its own text (only Siege can be lost). */
export function losesKeyword(state: ScenarioState, stageId: string, keyword: "battle" | "siege"): boolean {
  return keyword === "siege" && state.modifiers.length > 0 && flagged(state, stageId, "losesSiege");
}
