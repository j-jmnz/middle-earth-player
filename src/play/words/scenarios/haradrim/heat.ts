// Rules: hrd.heat-tracker (data/rules/entries.json); ledger lines 16030:A:3, 16068:B:2.
// The words of the haradrim family's heat verbs (src/catalog/families/haradrim.ts) inside a choice: what a branch of a Choose does ("Raise the temperature by 2, to 60"). The engine decided the number; the words read it from the tracker.
import type { Amount, Instruction } from "../../../../catalog/boundary.ts";
import { temperatureOf } from "../../../../rules/families/haradrim/heat.ts";
import type { ScenarioState } from "../../../../rules/engine/reduce.ts";

// ", to 60": the value the branch leaves, when the amount is a plain number and the Setup has set the tracker (a lowered value stops at 0).
function to(game: ScenarioState, amount: Amount, sign: 1 | -1): string {
  const now = temperatureOf(game);
  return typeof amount === "number" && now != null ? `, to ${Math.max(0, now + sign * amount)}` : "";
}

const by = (amount: Amount): string => (typeof amount === "number" ? String(amount) : "X");

/** One of the heat verbs in words, or null for any other verb. */
export function heatVerbWords(instruction: Instruction, game: ScenarioState): string | null {
  switch (instruction.verb) {
    case "RaiseTemperature":
      return `raise the temperature by ${by(instruction.amount)}${to(game, instruction.amount, 1)}`;
    case "LowerTemperature":
      return `lower the temperature by ${by(instruction.amount)}${to(game, instruction.amount, -1)}`;
    case "SetTemperature":
      return `set the temperature to ${instruction.value}`;
    default:
      return null;
  }
}
