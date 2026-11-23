// The text of a golden.json, shared by the golden suite that writes it (test/harness/golden-suite.ts), `goldenState` that reads it and `pnpm game`.
// It reads no game and loads no engine. A golden's row holds what the scenario's spec says (name, seed, loadout, options), its `intents` after the
// opening Keep, `checks` (the digest of the table after each intent, src/campaign/digest.ts) and `end`: the result, the last round and `hash`, a hash of
// the whole final state as JSON, so a change to any field of it still moves the file. The final state itself is stored only for the goldens
// a test reads without playing them (`state`; test/harness/golden-pins.ts). Any other final state is the replay of the intents.
import { createHash } from "node:crypto";

/** The facts of a game's end that a reader wants without a replay. */
export type GoldenEnd = { round: number; lost: boolean; cleared: boolean; lossReason?: string; hash: string };

/** The parts of a final state `endOf` reads. */
type EndState = { round: number; lost: boolean; stageCleared: boolean; lossReason?: string | null };

/** The hash of a final state: sha256 of its JSON text (the form the file stored before `end` existed), cut to 24 hex digits. */
export function stateHash(state: unknown): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 24);
}

/** The end of a game; `whole` is the state to hash when `state` is only the part of it that holds the facts. */
export function endOf(state: EndState, whole: unknown = state): GoldenEnd {
  return { round: state.round, lost: state.lost, cleared: state.stageCleared, ...(state.lossReason ? { lossReason: state.lossReason } : {}), hash: stateHash(whole) };
}

/**
 * The text of a golden.json: a JSON array with one row for each golden and one line for each field of a row, so a moved digest changes the `checks` and `end`
 * lines of its golden and no other, not the whole file.
 */
export function goldenText(rows: readonly Record<string, unknown>[]): string {
  const row = (golden: Record<string, unknown>): string =>
    `{\n${Object.entries(golden)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`)
      .join(",\n")}\n}`;
  return `[\n${rows.map(row).join(",\n")}\n]\n`;
}
