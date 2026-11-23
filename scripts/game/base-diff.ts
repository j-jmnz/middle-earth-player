// `pnpm game diff <scenario-id>/<n> --base [<ref>]`: a golden's intents (as golden.json held them at <ref>) replayed on the engine of <ref> and on the working
// tree, to name the first intent after which the two tables differ and the paths at which the states differ. golden.json stores a final state only for the goldens
// a test reads (test/harness/golden-pins.ts), so a golden that moved otherwise shows two hashes and nothing else; this finds the cause. The base engine runs in a
// temporary git worktree of <ref> (node_modules linked in, scripts/game/replay-dump.ts copied in), removed when the replay ends.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { PlayerIntent } from "../../src/rules/engine/reduce.ts";

import { ROOT } from "../data/paths.ts";

import { stateDiff } from "./diff.ts";
import { goldenAt, baseRef } from "./moved.ts";
import { replayDump, type ReplayDump } from "./replay-dump.ts";
import type { GameSource } from "./source.ts";
import { intentText } from "./names.ts";
import { walk, type Move } from "./walk.ts";

/** What the two replays show. `first` is the index (the Keep is 0) of the first intent after which the tables differ, null when none does. */
export type BaseDiff = {
  ref: string;
  intents: number;
  first: number | null;
  /** The base's refusal of an intent, or the working tree's: the replay stops there. */
  refused: string | null;
  /** The paths at which the two tables differ after intent `first`, base → now. */
  atFields: string[];
  /** The paths at which the two final states differ, base → now. */
  finalFields: string[];
  /** The intent `first` as the working tree's table reads it, and the move it makes there (for the cards and records that resolved). */
  intent: string | null;
  move: Move | null;
};

const git = (cwd: string, args: readonly string[]): string => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** Runs `replay-dump.ts` on the engine of `ref`: a worktree of it under the system's temporary folder, removed afterwards. */
function replayOnRef(ref: string, scenarioId: string, goldenName: string, intents: readonly PlayerIntent[], against: readonly string[]): ReplayDump {
  const dir = mkdtempSync(path.join(os.tmpdir(), "game-base-"));
  const tree = path.join(dir, "tree");
  try {
    git(ROOT, ["worktree", "add", "--detach", tree, ref]);
    symlinkSync(path.join(ROOT, "node_modules"), path.join(tree, "node_modules"));
    mkdirSync(path.join(tree, "scripts", "game"), { recursive: true });
    copyFileSync(path.join(ROOT, "scripts", "game", "replay-dump.ts"), path.join(tree, "scripts", "game", "replay-dump.ts"));
    const files = { intents: path.join(dir, "intents.json"), against: path.join(dir, "against.json"), out: path.join(dir, "out.json") };
    writeFileSync(files.intents, JSON.stringify(intents));
    writeFileSync(files.against, JSON.stringify(against));
    const run = (): void => {
      execFileSync(process.execPath, ["--import", "./scripts/game/json-imports.ts", "--disable-warning=ExperimentalWarning", "scripts/game/replay-dump.ts", scenarioId, goldenName, files.intents, files.out, files.against], { cwd: tree, stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, LOG_LEVEL: "warn" }, maxBuffer: 1 << 28 });
    };
    try {
      run();
    } catch (error) {
      const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? "";
      throw new Error(`the replay on ${ref.slice(0, 10)} failed: ${stderr.trim().split("\n").slice(-6).join(" | ") || String(error)}`);
    }
    return JSON.parse(readFileSync(files.out, "utf8")) as ReplayDump;
  } finally {
    try {
      git(ROOT, ["worktree", "remove", "--force", tree]);
    } catch {
      // The worktree may not have been added; the folder goes either way.
    }
    rmSync(dir, { recursive: true, force: true });
    try {
      git(ROOT, ["worktree", "prune"]);
    } catch {
      // Nothing to prune.
    }
  }
}

/**
 * Replays the golden's intents of `ref` (golden.json at `ref`, the Keep first) on the working tree and on the engine of `ref`. `source` is the golden as
 * the working tree plays it (scripts/game/source.ts); `ref` defaults to the merge base with origin/main.
 */
export async function diffAgainstBase(source: GameSource, scenarioId: string, goldenName: string, refArg?: string): Promise<BaseDiff> {
  const ref = baseRef(refArg);
  const row = goldenAt(ref, scenarioId)?.find((golden) => golden.name === goldenName);
  if (!row?.intents) throw new Error(`golden.json of ${scenarioId} at ${ref.slice(0, 10)} holds no golden "${goldenName}": there is no base game to replay`);
  const intents = row.intents as PlayerIntent[];
  const all: PlayerIntent[] = [{ type: "Keep" }, ...intents];
  // The working tree: the tables after each intent, kept so the one after the first difference is at hand.
  const now = await replayDump(scenarioId, goldenName, intents);
  const base = replayOnRef(ref, scenarioId, goldenName, intents, now.hashes);
  const refused = [base.refused && `the base engine refuses intent #${base.refused.index + 1} (golden.json's numbering, the Keep is #1): ${base.refused.reason}`, now.refused && `the working tree refuses intent #${now.refused.index + 1}: ${now.refused.reason}`].filter((line): line is string => line !== null);
  const first = base.first ?? (base.hashes.length !== now.hashes.length ? Math.min(base.hashes.length, now.hashes.length) : null);
  const move = first !== null && first < all.length ? (walk({ ...source, intents: all }, { at: first + 1 }).moves.at(-1) ?? null) : null;
  return {
    ref,
    intents: intents.length,
    first,
    refused: refused.length > 0 ? refused.join("; ") : null,
    atFields: first !== null && base.at && move ? stateDiff(base.at, move.after, 25) : [],
    finalFields: stateDiff(base.final, now.final, 40),
    intent: move ? intentText(move.intent, move.before, source.ctx) : null,
    move,
  };
}

/** The report of `pnpm game diff --base`, one line each. */
export function baseDiffText(label: string, d: BaseDiff): string[] {
  const out = [`${label}: the ${d.intents} intents of golden.json at ${d.ref.slice(0, 10)} replayed on that engine and on the working tree`];
  if (d.refused) out.push(`  ${d.refused}`);
  if (d.first === null && !d.refused) {
    out.push("  the table is the same after every intent: this change does not reach this golden");
    return out;
  }
  if (d.first !== null) {
    out.push(d.move ? `  first intent after which the tables differ: #${d.first + 1} (the Keep is #1): ${d.intent}` : `  the games part after intent #${d.first} (the Keep is #1): one ends there`);
    if (d.atFields.length > 0) out.push("  fields that differ after it, base → working tree:", ...d.atFields.map((line) => `    ${line}`));
  }
  out.push(d.finalFields.length > 0 ? "  fields that differ in the final state, base → working tree:" : "  the final states are the same", ...d.finalFields.map((line) => `    ${line}`));
  return out;
}
