// Rules: emce.treasure, emce.campaign-pool-encounter, emce.campaign-log (data/rules/entries.json); ledger lines 12193:B:4, 12193:B:5.
// What the instructions after a Resolution choice do, told before the choice is confirmed: the encounter cards a RemoveFromPool takes out of the campaign pool and the ones an AddEncounterToPool adds once the log holds enough treasures. Read from the record's fields (`codes`, `when`),
// never from a card code; an instruction that changes nothing now (a card the pool does not hold) is not told.
import type { ScenarioState } from "../rules/core/state.ts";
import { poolTally } from "../rules/families/wilderland/pool.ts";

import { andList } from "./carry-words.ts";

/** The sentences for the Resolution instructions that follow step `step`: cards that leave the campaign pool, and cards that join it when the treasures recorded reach the record's count. `nameOf` gives a card's name. */
export function afterwardsWords(state: ScenarioState, step: number, nameOf: (code: string) => string): string[] {
  const words: string[] = [];
  const pool = poolTally(state);
  for (const instruction of state.resolution.slice(step + 1)) {
    if (instruction.verb === "RemoveFromPool" && instruction.choice == null && instruction.codes) {
      const held = instruction.codes.filter((code) => (pool[code] ?? 0) > 0).map(nameOf);
      if (held.length > 0) words.push(`${andList(held)} ${held.length === 1 ? "leaves" : "leave"} the campaign pool.`);
    }
    if (instruction.verb === "AddEncounterToPool" && instruction.codes && instruction.when?.kind === "treasuresLogged") {
      const recorded = state.campaignFacts?.treasures?.length ?? 0;
      const names = andList(instruction.codes.map(nameOf));
      const min = instruction.when.min;
      // This treasure alone settles it when it brings the log to the count; else the treasures the players control may.
      words.push(recorded + 1 >= min ? `${names} joins the campaign pool as an encounter card: this treasure makes ${recorded + 1} recorded, and ${min} or more is enough.` : `${names} joins the campaign pool as an encounter card if ${min} or more treasures are recorded once this one and the treasures the players control are added (${recorded} ${recorded === 1 ? "is" : "are"} recorded now).`);
    }
  }
  return words;
}
