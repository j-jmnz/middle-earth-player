// Two golden.json files compared row by row: the one comparison behind `pnpm game moved` (scripts/game/moved.ts) and the hint a failed golden snapshot
// prints (test/harness/golden-moved.ts). It reads no game and loads no engine, so a test helper can import it.
import { firstDifferent, stateDiff } from "./diff.ts";
import { endOf, type GoldenEnd } from "./golden-file.ts";

/** The parts of a golden.json row this reads. A row of an older scenario has no `name`; it is keyed by its seed and its place. `state` is stored only for the goldens a test reads (golden-file.ts); a file written before `end` existed has `state` and no `end`. */
export type StoredGolden = {
  name?: string;
  seed?: number;
  outcome?: string;
  intents?: unknown[];
  checks?: unknown[];
  end?: GoldenEnd;
  state?: { round?: number; lost?: boolean; stageCleared?: boolean; lossReason?: string | null };
};

/** The end of a row: the stored `end`, or the one its stored state gives (a file in the earlier format). */
function endOfRow(golden: StoredGolden): GoldenEnd | undefined {
  return golden.end ?? (golden.state ? endOf({ round: golden.state.round ?? 0, lost: golden.state.lost ?? false, stageCleared: golden.state.stageCleared ?? false, lossReason: golden.state.lossReason }, golden.state) : undefined);
}

/** The row with the fields that hold the game left out: what is left is what the scenario's spec says (name, seed, loadout, options). */
function specOf(golden: StoredGolden): string {
  const { intents: _intents, checks: _checks, end: _end, state: _state, ...spec } = golden;
  return JSON.stringify(spec);
}

export type GoldenMove = {
  /** 1-based, as `pnpm game show <scenario-id>/<n>` numbers it; null for a golden the file no longer holds. */
  number: number | null;
  name: string;
  kind: "new" | "removed" | "moved";
  before: string;
  after: string;
  intents: "same" | "changed";
  /** 0-based index into the intents of the first intent whose table or whose move differs, null when none does. */
  first: number | null;
  /** True when the golden now ends at `first`: it is shorter than the base, so no intent there is the cause. */
  endsNow: boolean;
  /** The intent at `first` as the base and the golden now hold it, when the two differ (JSON). */
  was?: string;
  now?: string;
  /** The paths at which the final states differ (a few); one line naming the two hashes when a state is not stored in both files. */
  fields: string[];
  /** True when the two files hold the same spec, intents, per-intent digests and final state hash and differ only in how they store them. */
  storage?: true;
};

function resultOf(golden: StoredGolden | undefined): string {
  if (!golden) return "none";
  const end = endOfRow(golden);
  const outcome = golden.outcome ?? (end?.lost ? "lost" : end?.cleared ? "won" : "unfinished");
  return `${outcome}${end?.lost && end.lossReason ? ` (${end.lossReason})` : ""}, last round ${end?.round ?? "?"}`;
}

/** A row's key: its name, or its seed and its 1-based place when it has none. */
function keyOf(golden: StoredGolden, at: number): string {
  return golden.name ?? `seed ${golden.seed ?? "?"}, row ${at + 1}`;
}

/** The goldens of one scenario that differ between two golden.json files, matched by name (or by seed and place). `order` is the registry's names, which number them. */
export function compareGoldens(base: readonly StoredGolden[] | null, now: readonly StoredGolden[], order: readonly string[] = []): GoldenMove[] {
  const numberOf = (name: string, at: number): number => (order.indexOf(name) >= 0 ? order.indexOf(name) + 1 : at + 1);
  const baseByKey = new Map((base ?? []).map((golden, at) => [keyOf(golden, at), golden] as const));
  const nowKeys = new Set(now.map(keyOf));
  const moves: GoldenMove[] = [];
  now.forEach((golden, at) => {
    const name = keyOf(golden, at);
    const was = baseByKey.get(name);
    if (!was) {
      moves.push({ number: numberOf(name, at), name, kind: "new", before: "none", after: resultOf(golden), intents: "changed", first: null, endsNow: false, fields: [] });
      return;
    }
    if (JSON.stringify(was) === JSON.stringify(golden)) return;
    const wasEnd = endOfRow(was);
    const nowEnd = endOfRow(golden);
    const sameIntents = JSON.stringify(was.intents) === JSON.stringify(golden.intents);
    const parts = [firstDifferent(golden.intents ?? [], was.intents ?? []), firstDifferent(golden.checks ?? [], was.checks ?? [])].filter((index): index is number => index !== null);
    const first = parts.length > 0 ? Math.min(...parts) : null;
    const intentAt = (list: readonly unknown[] | undefined): string | undefined => (first !== null && list && first < list.length ? JSON.stringify(list[first]) : undefined);
    const storage = sameIntents && first === null && specOf(was) === specOf(golden) && wasEnd?.hash === nowEnd?.hash;
    const differs = !sameIntents && first !== null && intentAt(was.intents) !== intentAt(golden.intents);
    moves.push({
      number: numberOf(name, at),
      name,
      kind: "moved",
      before: resultOf(was),
      after: resultOf(golden),
      intents: sameIntents ? "same" : "changed",
      first,
      endsNow: first !== null && first >= (golden.intents ?? []).length,
      ...(differs ? { was: intentAt(was.intents) ?? "(ended)", now: intentAt(golden.intents) ?? "(ended)" } : {}),
      fields: was.state && golden.state ? stateDiff(was.state, golden.state, 5) : wasEnd?.hash === nowEnd?.hash ? [] : [`state hash ${wasEnd?.hash ?? "none"} → ${nowEnd?.hash ?? "none"} (\`pnpm game diff <scenario-id>/<n> --base <ref>\` replays the golden's intents on the engine of <ref> and on this tree and names the first intent and the fields)`],
      ...(storage ? { storage: true as const } : {}),
    });
  });
  base?.forEach((was, at) => {
    const name = keyOf(was, at);
    if (!nowKeys.has(name)) moves.push({ number: null, name, kind: "removed", before: resultOf(was), after: "none", intents: "changed", first: null, endsNow: false, fields: [] });
  });
  return moves;
}
