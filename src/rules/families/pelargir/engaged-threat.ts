// Rules: rr.lasting-effects, rr.staging-area, rr.engaged (data/rules/entries.json); ledger line 06131:A:1.
// Conflict at the Crossroads: "Until the end of the phase, Orc enemies engaged with players add their Threat to the staging area." The record holds the flag `engagedOrcThreat` on the table until the end of the phase, and the total Threat in the staging area reads it live
// (families/attachments/hold.ts withStagingThreat): each Orc enemy engaged with any player adds its Threat as it stands, so an Orc that engages later in the phase counts and one that leaves does not.
import { modifiedStat } from "../../core/keywords.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import { heldAmount, type ScenarioState } from "../../core/state.ts";

/** The Threat the engaged Orc enemies add, once for each lasting effect that holds the flag; 0 in any game with none. */
export function engagedOrcRaise(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): number {
  const raises = state.modifiers.length > 0 ? heldAmount(state, "table", "engagedOrcThreat") : 0;
  if (raises <= 0) return 0;
  let total = 0;
  for (const instance of Object.values(state.cards)) {
    if (instance.zone === "engaged" && printedOf(cards, instance.code).type === "enemy" && printedOf(cards, instance.code).traits.includes("Orc")) total += modifiedStat(state, instance, "threat", cards);
  }
  return raises * total;
}
