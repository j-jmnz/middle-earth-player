import type { Effect } from "../../src/catalog/boundary.ts";
import { flagged, type GameEvent, type ScenarioState } from "../../src/rules/core/state.ts";
import { modifiedStat } from "../../src/rules/core/keywords.ts";
import type { PlayerIntent } from "../../src/rules/engine/reduce.ts";

import type { Layout, LayoutTable, Run } from "./scene-kit.ts";

// Test helper. The vocabulary of a card-spec row (test/harness/card-spec.ts): the actions, the expectations and the row itself, and what an action leaves behind.

export type StatName = Parameters<typeof modifiedStat>[2];
export type FlagName = Parameters<typeof flagged>[2];

/** A scenario value an expectation reads through a named reader (card-spec-check.ts, COUNTERS). */
export type CounterName = "pursuit" | "life";

/** One action of a row. A choice a record opens is answered by the `answer` actions that follow the action that opens it (the first option when none is left). */
export type Act =
  | { act: "resolve"; code: string; timing: Effect["timing"]; source?: string }
  | { act: "quest"; outcome: "success" | "fail" }
  | { act: "attack"; enemy: string; shadow?: string; undefended?: boolean; lands?: Readonly<Record<string, string>> }
  | { act: "defend"; with: string }
  | { act: "reveal"; code: string }
  | { act: "travel"; code: string }
  | { act: "endRound" }
  | { act: "endPhase" }
  | { act: "answer"; id: string }
  | { act: "respond"; code: string }
  | { act: "cancel" }
  | { act: "commit"; heroes: readonly string[] }
  | { act: "announce"; trigger: GameEvent["trigger"]; code?: string; extra?: Partial<GameEvent> };

export type Expect =
  | { expect: "stat"; code: string; name: StatName; value: number }
  | { expect: "flag"; code: string; name: FlagName; value: boolean }
  | { expect: "zone"; code: string; zone: string }
  | { expect: "progressOn"; code: string; value: number }
  | { expect: "resourcesOn"; code: string; value: number }
  | { expect: "damageOn"; code: string; value: number }
  | { expect: "handCount"; value: number; seat: number }
  | { expect: "drew"; value: number; seat: number }
  | { expect: "defender"; code: string; value: boolean }
  | { expect: "attackersOf"; code: string; attackers: readonly string[] }
  | { expect: "refused"; code: string; value: boolean }
  | { expect: "counter"; name: CounterName; value: number }
  | { expect: "heldBy"; code: string; host: string }
  | { expect: "deckCount"; value: number }
  | { expect: "exhausted"; code: string; value: boolean }
  | { expect: "stagingThreat"; value: number }
  | { expect: "threat"; value: number; seat: number }
  | { expect: "revealedBy"; code: string; seat: number }
  | { expect: "lost" }
  | { expect: "won" }
  | { expect: "notWon" }
  | { expect: "frame"; name: string }
  | { expect: "offers"; intent: PlayerIntent["type"]; code?: string };

export type Row = { line: string; layout?: Layout; act: Act | readonly Act[]; expect: Expect | readonly Expect[]; name?: string };

/** What the actions of a row left: the run, the table, and the state of the attack while it was still in progress (an `attack` action). */
export type Done = { run: Run; table: LayoutTable; during?: ScenarioState };
