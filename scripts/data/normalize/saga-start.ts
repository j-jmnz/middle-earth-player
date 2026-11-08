// Rules: mec112.setting-up-the-game (data/rules/entries.json). The saga hero the first player starts a Two Towers scenario with, read from the
// load list's player 1 play area: one ☺ hero, or one hero with the Ring-bearer trait and the cards attached to him (The One Ring).
import type { Card } from "../../../src/catalog/card-facts.ts";
import type { ScenarioData } from "../../../src/catalog/scenario-data.ts";

export function sagaStartOf(byCode: ReadonlyMap<string, Card>, heroes: readonly string[], attached: readonly string[]): ScenarioData["sagaStart"] {
  const [hero, ...rest] = heroes;
  if (hero === undefined || rest.length > 0) return undefined;
  const ringBearer = byCode.get(hero)?.traits.includes("Ring-bearer") === true;
  if (!ringBearer) return attached.length === 0 ? { hero } : undefined;
  return attached.length > 0 ? { ringBearer: true, attached: [...attached] } : undefined;
}
