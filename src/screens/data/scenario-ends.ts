// Whether a scenario ends when its last player falls: its campaign card holds the constant `endsInDefeat` (146074:constant:1, The Black Gate Opens; docs/scenarios/the-return-of-the-king.md, The Black Gate Opens). A fixed fact of the records, read for the path's stops. Pure.
import type { Effect } from "../../catalog/boundary.ts";

import { EFFECTS } from "../../effects";
import { scenarioOf } from "./campaign-data";

const holdsFlag = (effect: Effect): boolean => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === "endsInDefeat");

const KNOWN = new Map<string, boolean>();

/** The scenario's campaign card holds `endsInDefeat`, so its completed stop reads "Ended". */
export function scenarioEndsInDefeat(scenarioId: string): boolean {
  const kept = KNOWN.get(scenarioId);
  if (kept != null) return kept;
  const card = scenarioOf(scenarioId)?.campaignCard;
  const ends = card != null && EFFECTS.some((effect) => effect.cardCode === card && holdsFlag(effect));
  KNOWN.set(scenarioId, ends);
  return ends;
}
