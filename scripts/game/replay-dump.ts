// Replays a golden's intents on the engine of the tree it runs in and reports the table after each one: the half of `pnpm game diff <scenario-id>/<n> --base`
// (scripts/game/base-diff.ts) that runs on the base ref's engine. It is copied into a temporary worktree of the base and run there, so it imports only what
// every ref holds (the golden registry and the reducer) and writes the one JSON a report needs. The table is the whole state as JSON, hashed, so a field
// the per-intent digest (src/campaign/digest.ts) leaves out still shows.
//
//   node --import ./scripts/game/json-imports.ts scripts/game/replay-dump.ts <scenario-id> <golden name> <intents.json> <out.json> [<hashes.json>]
//
// `intents.json` is the intents after the opening Keep; `hashes.json` is another run's `hashes`. Output: `hashes` (the hash of the state after each intent,
// the Keep first), `refused` (the intent the reducer stopped at and why), `first` (the index of the first hash that differs from `hashes.json`, or null)
// and `at` and `final` (the states at that index and at the end).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { GOLDEN_REGISTRY } from "../../test/harness/golden-registry.ts";
import { reduce, startScenario, type PlayerIntent } from "../../src/rules/engine/reduce.ts";

export type ReplayDump = { hashes: string[]; refused: { index: number; reason: string } | null; first: number | null; at: unknown; final: unknown };

/** The hash of a state as JSON: the whole table, nothing left out. */
export const tableHash = (state: unknown): string => createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 24);

/** The golden's game started and its intents applied one by one (`intents` follow the Keep). */
export async function replayDump(scenarioId: string, goldenName: string, intents: readonly PlayerIntent[], against?: readonly string[]): Promise<ReplayDump> {
  const entry = GOLDEN_REGISTRY.find((item) => item.scenarioId === scenarioId);
  const golden = entry?.goldens.find((item) => item.name === goldenName);
  if (!entry || !golden) throw new Error(`${scenarioId} has no golden named "${goldenName}" in this tree`);
  const { ctx } = await entry.world(golden.decks);
  const played = entry.play(golden, ctx);
  let state = startScenario(played.start, ctx);
  const hashes: string[] = [];
  let first: number | null = null;
  let at: unknown = null;
  let refused: ReplayDump["refused"] = null;
  for (const [index, intent] of [{ type: "Keep" } as PlayerIntent, ...intents].entries()) {
    let result: ReturnType<typeof reduce>;
    try {
      result = reduce(state, intent, ctx);
    } catch (error) {
      refused = { index, reason: `the reducer threw: ${error instanceof Error ? error.message : String(error)}` };
      break;
    }
    if (!result.ok) {
      refused = { index, reason: result.reason };
      break;
    }
    state = result.state;
    hashes.push(tableHash(state));
    if (first === null && against && hashes[index] !== against[index]) {
      first = index;
      at = state;
    }
  }
  // A run that ends before the other, or after it, parts at the index where the shorter one stops.
  if (first === null && against && hashes.length !== against.length) first = Math.min(hashes.length, against.length);
  return { hashes, refused, first, at, final: state };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [scenarioId, goldenName, intentsFile, outFile, againstFile] = process.argv.slice(2);
  if (!scenarioId || !goldenName || !intentsFile || !outFile) throw new Error("usage: replay-dump.ts <scenario-id> <golden name> <intents.json> <out.json> [<hashes.json>]");
  const intents = JSON.parse(readFileSync(intentsFile, "utf8")) as PlayerIntent[];
  const against = againstFile ? (JSON.parse(readFileSync(againstFile, "utf8")) as string[]) : undefined;
  writeFileSync(outFile, JSON.stringify(await replayDump(scenarioId, goldenName, intents, against)));
}
