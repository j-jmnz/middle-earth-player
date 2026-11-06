// Rules: emce.treasure, emce.campaign-pool-encounter, emce.campaign-log (data/rules/entries.json); ledger lines 12193:B:4, 12193:B:5.
// What the instructions after a Resolution choice do, told before the choice is confirmed: the encounter cards an AddEncounterToPool adds once the log holds enough treasures, then the ones a RemoveFromPool takes out of the campaign pool (the order the settled sentence lists them in).
// Read from the record's fields (`codes`, `when`), never from a card code; an instruction that changes nothing now (a card the pool does not hold) is not told.
import type { PrintedCard } from "../rules/core/printed.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { poolTally } from "../rules/families/wilderland/pool.ts";
import { controlledTreasures } from "../rules/families/wilderland/treasure.ts";

import { andList } from "./carry-words.ts";

const treasures = (count: number): string => `${count} ${count === 1 ? "treasure" : "treasures"}`;

/**
 * The sentences for the Resolution instructions that follow step `step`: cards that join the campaign pool when the treasures recorded reach the record's count, then cards that leave it. `taking`: the choice adds a treasure to the log (the treasure tapped), so it counts;
 * declining it does not. The treasures the players control are discovered by a later step and count too. `nameOf` gives a card's name.
 */
export function afterwardsWords(state: ScenarioState, step: number, nameOf: (code: string) => string, cards: ReadonlyMap<string, PrintedCard>, taking: boolean): string[] {
  const joins: string[] = [];
  const leaves: string[] = [];
  const pool = poolTally(state);
  for (const instruction of state.resolution.slice(step + 1)) {
    if (instruction.verb === "RemoveFromPool" && instruction.choice == null && instruction.codes) {
      const held = instruction.codes.filter((code) => (pool[code] ?? 0) > 0).map(nameOf);
      if (held.length > 0) leaves.push(`${andList(held)} ${held.length === 1 ? "leaves" : "leave"} the campaign pool.`);
    }
    if (instruction.verb === "AddEncounterToPool" && instruction.codes && instruction.when?.kind === "treasuresLogged") {
      const logged = new Set(state.campaignFacts?.treasures ?? []);
      const recorded = state.campaignFacts?.treasures?.length ?? 0;
      const controlled = controlledTreasures(state, { cards }).filter((code) => !logged.has(code)).length;
      const names = andList(instruction.codes.map(nameOf));
      const verb = instruction.codes.length === 1 ? "joins" : "join";
      const min = instruction.when.min;
      const own = taking ? 1 : 0;
      const total = recorded + own + controlled;
      const you = controlled > 0 ? `the ${controlled} you control` : "";
      // What the count is made of: "this treasure and the 1 you control" (this one, in the sentence that says it does not join).
      const made = (this_: string): string => [taking ? this_ : "", you].filter((part) => part !== "").join(" and ");
      if (recorded + own >= min) joins.push(`${names} ${verb} the campaign pool: ${taking ? `with this treasure ${recorded + own} are recorded` : `${recorded} are recorded`}, and ${min} is enough.`);
      else if (total >= min) joins.push(`${names} ${verb} the campaign pool: with ${made("this treasure")}, ${total} are recorded.`);
      else joins.push(`${names} does not join the campaign pool: ${treasures(total)} ${total === 1 ? "is" : "are"} recorded${made("this one") ? ` with ${made("this one")}` : ""}, and it takes ${min}.`);
    }
  }
  return [...joins, ...leaves];
}
