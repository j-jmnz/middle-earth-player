import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

import type { ScenarioState } from "../../src/rules/engine/reduce.ts";

// Test helper. The final state of an earlier part's golden game, read from its golden.json instead of played again (golden.json stores it only for
// the goldens in test/harness/golden-pins.ts; the others store its hash, scripts/game/golden-file.ts). The scenario's own
// golden test plays every golden and fails while golden.json differs from the played game (test/harness/golden-suite.ts), and checks
// that each state reads back from JSON as it was played, so this is the state that game ends in. A later part's world builds the log
// its campaign hands on from it (the earlier parts' Resolutions written onto a log): one read and parse, where playing the earlier
// game again cost as much as the earlier part's whole golden test, and a campaign's later parts chained every earlier one.

const SCENARIOS = path.resolve(import.meta.dirname, "..", "..", "src", "campaign", "scenarios");

type Pinned = { name: string; state?: ScenarioState };

// One parse per scenario; there are as many entries as scenarios with goldens.
const files = new Map<string, readonly Pinned[]>();

function pinned(scenarioId: string): readonly Pinned[] {
  let goldens = files.get(scenarioId);
  if (!goldens) {
    goldens = JSON.parse(readFileSync(path.join(SCENARIOS, scenarioId, "golden.json"), "utf8")) as Pinned[];
    files.set(scenarioId, goldens);
  }
  return goldens;
}

// `pnpm test pins` sets GOLDEN_READS_FILE: each read is appended there, one JSON pair a line, so the readers in every worker are collected.
const READS_FILE = process.env.GOLDEN_READS_FILE;

/** The final state of the golden named `name` of `scenarioId`, as its golden.json pins it (only the goldens in GOLDEN_PINS store one). A fresh copy: the caller may keep it. */
export function goldenState(scenarioId: string, name: string): ScenarioState {
  if (READS_FILE) appendFileSync(READS_FILE, `${JSON.stringify([scenarioId, name])}\n`);
  const golden = pinned(scenarioId).find((item) => item.name === name);
  if (!golden) throw new Error(`${scenarioId}/golden.json has no golden named ${name}`);
  if (!golden.state) throw new Error(`${scenarioId}/golden.json stores no final state for ${name}: add it to GOLDEN_PINS (test/harness/golden-pins.ts), then write the scenario's golden.json again (\`pnpm vitest run src/campaign/scenarios/${scenarioId}/golden.test.ts -u\`) with no engine move pending: \`pnpm game moved\` must then report only a storage change for that file`);
  return structuredClone(golden.state);
}
