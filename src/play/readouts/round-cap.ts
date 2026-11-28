// Rules: rr.quest-advancement (data/rules/entries.json); ledger lines 51103:B:2, 51104:B:3, 51105:B:2 (The Woodland Realm) and 21076:B:2 (The River Running). The top-bar dial of a stage that limits the progress placed on the quest each round ("no more than 5 progress can be placed here each round"): the ring fills toward the cap and says "near" at it, as a plain limit. Shared by
// readouts/standalone-scenarios/woodland.ts and readouts/mordor/river.ts. The engine decided every number (`questProgressCap`, `questProgressPlaced`); nothing here changes one. Pure.
import { heldLeast } from "../../rules/core/state.ts";
import type { CardInstance, ScenarioState } from "../../rules/core/state.ts";

import type { TableDial } from "./dials.ts";

/** What the dial's ring is counting toward. */
export const roundCapLimitWords = (cap: number): string => `No more than ${cap} progress each round`;

/** The warning at the cap. */
export const roundCapFullWords = (stage: string): string => `No more progress can be placed on ${stage} this round.`;

/** The cap dial of the stage, or null while no cap is held. `note` says what a tap on it reads: what this round has placed against the cap and why it is that number. */
export function roundCapDial(game: ScenarioState, stage: CardInstance, name: string, testID: string, note: (placed: number, cap: number) => string): TableDial | null {
  const cap = heldLeast(game, "table", "questProgressCap");
  if (cap <= 0) return null;
  const placed = game.modifiers.filter((modifier) => modifier.stat === "questProgressPlaced" && modifier.instanceId === "table").reduce((sum, modifier) => sum + modifier.amount, 0);
  // A plain limit, not a loss: it says "near" once the cap is reached and never warms (as the Hunt's progress cap does).
  const warn = placed >= cap ? { level: "near" as const, words: roundCapFullWords(name) } : null;
  return { id: "cap", testID, label: "Cap", name: `Progress placed on ${name} this round, no more than ${cap}:`, value: placed, limit: cap, limitWords: roundCapLimitWords(cap), ...(warn ? { warn } : {}), cardId: stage.id, note: note(placed, cap) };
}
