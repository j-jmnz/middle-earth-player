// `pnpm game moved [<base-ref>]`: for every golden whose golden.json differs from <base-ref> (default: the merge base with origin/main), one block a fix
// agent pastes into its commit body: the result and last round before and after, whether the intents changed or only the stored state, the first
// intent whose table differs, and the effect records, rules and cards that resolved at that intent. This file compares the two stored files and prints a
// block; scripts/game/game.ts replays the golden for the step detail.
//
// golden.json stores, for each golden, its intents (after the opening Keep), `checks` (a digest of the table after each intent) and the final `state`.
// The first intent whose check differs is the first move whose table is not the one the base pinned, whether or not the intents themselves changed.
import { execFileSync } from "node:child_process";
import path from "node:path";

import type { Cause } from "../../src/rules/core/cause.ts";
import type { EngineStep, PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { firstDifferent, stateDiff } from "./diff.ts";
import { cardName, intentText, stepText } from "./names.ts";
import type { Move } from "./walk.ts";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");

/** The parts of a golden.json row this reads. */
export type StoredGolden = {
  name: string;
  outcome?: string;
  intents?: unknown[];
  checks?: unknown[];
  state?: { round?: number; lost?: boolean; stageCleared?: boolean; lossReason?: string | null };
};

export type GoldenMove = {
  /** 1-based, as `pnpm game show <scenario-id>/<n>` numbers it; null for a golden the file no longer holds. */
  number: number | null;
  name: string;
  kind: "new" | "removed" | "moved";
  before: string;
  after: string;
  intents: "same" | "changed";
  /** 0-based index into the pinned intents of the first intent whose table or whose move differs, null when none does. */
  first: number | null;
  /** The intent at `first` as the base and the golden now hold it, when the two differ (JSON). */
  was?: string;
  now?: string;
  /** The paths at which the final states differ (a few). */
  fields: string[];
};

function resultOf(golden: StoredGolden | undefined): string {
  if (!golden) return "none";
  const state = golden.state;
  const outcome = golden.outcome ?? (state?.lost ? "lost" : state?.stageCleared ? "won" : "unfinished");
  return `${outcome}${state?.lost && state.lossReason ? ` (${state.lossReason})` : ""}, last round ${state?.round ?? "?"}`;
}

/** The goldens of one scenario that differ between two golden.json files, matched by name. `order` is the registry's names, which number them. */
export function compareGoldens(base: readonly StoredGolden[] | null, now: readonly StoredGolden[], order: readonly string[] = []): GoldenMove[] {
  const numberOf = (name: string, at: number): number => (order.indexOf(name) >= 0 ? order.indexOf(name) + 1 : at + 1);
  const moves: GoldenMove[] = [];
  now.forEach((golden, at) => {
    const was = base?.find((item) => item.name === golden.name);
    if (!was) {
      moves.push({ number: numberOf(golden.name, at), name: golden.name, kind: "new", before: "none", after: resultOf(golden), intents: "changed", first: null, fields: [] });
      return;
    }
    if (JSON.stringify(was) === JSON.stringify(golden)) return;
    const sameIntents = JSON.stringify(was.intents) === JSON.stringify(golden.intents);
    const parts = [firstDifferent(golden.intents ?? [], was.intents ?? []), firstDifferent(golden.checks ?? [], was.checks ?? [])].filter((index): index is number => index !== null);
    const first = parts.length > 0 ? Math.min(...parts) : null;
    const intentAt = (list: readonly unknown[] | undefined): string | undefined => (first !== null && list && first < list.length ? JSON.stringify(list[first]) : undefined);
    const differs = !sameIntents && first !== null && intentAt(was.intents) !== intentAt(golden.intents);
    moves.push({
      number: numberOf(golden.name, at),
      name: golden.name,
      kind: "moved",
      before: resultOf(was),
      after: resultOf(golden),
      intents: sameIntents ? "same" : "changed",
      first,
      ...(differs ? { was: intentAt(was.intents) ?? "(ended)", now: intentAt(golden.intents) ?? "(ended)" } : {}),
      fields: stateDiff(was.state, golden.state, 5),
    });
  });
  for (const was of base ?? []) if (!now.some((golden) => golden.name === was.name)) moves.push({ number: null, name: was.name, kind: "removed", before: resultOf(was), after: "none", intents: "changed", first: null, fields: [] });
  return moves;
}

/** What resolved at one intent: the intent, the records and rules named by the causes of its steps, the cards its steps and it name, and the first steps. */
export type StepDetail = { intent: string; effects: string[]; rules: string[]; cards: string[]; steps: string[]; more: number };

const SHOWN_STEPS = 8;

function causeOf(step: EngineStep): Cause | undefined {
  const cause = (step as { cause?: Cause }).cause;
  return cause && typeof cause === "object" ? cause : undefined;
}

function idsIn(value: unknown, state: ScenarioState, into: Set<string>): void {
  if (typeof value === "string") {
    if (state.cards[value]) into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) idsIn(item, state, into);
  }
}

export function detailOf(move: Move, ctx: ReduceContext): StepDetail {
  const state = move.after;
  const effects = new Set<string>();
  const rules = new Set<string>();
  const ids = new Set<string>();
  for (const value of Object.values(move.intent as Record<string, unknown>)) idsIn(value, move.before, ids);
  for (const step of move.steps) {
    const cause = causeOf(step);
    if (cause && "effect" in cause) effects.add(cause.effect);
    else if (cause) rules.add(cause.rule);
    for (const [key, value] of Object.entries(step)) if (key !== "cause") idsIn(value, state, ids);
  }
  const intent = move.intent as { effectId?: string };
  if (intent.effectId) effects.add(intent.effectId);
  const nameOfRecord = (id: string): string => `${id} (${ctx.cards.get(id.slice(0, id.indexOf(":")))?.name ?? "?"})`;
  const cards = [...new Set([...ids].map((id) => cardName(state.cards[id] ? state : move.before, ctx, id).replace(/ #\S+$/, "")))];
  return {
    intent: intentText(move.intent as PlayerIntent, move.before, ctx),
    effects: [...effects].map(nameOfRecord),
    rules: [...rules],
    cards,
    steps: move.steps.slice(0, SHOWN_STEPS).map((step) => stepText(step, state, ctx)),
    more: Math.max(0, move.steps.length - SHOWN_STEPS),
  };
}

/** The block for one moved golden. `detail` is the replay of the intent at `first` (null when none differs); `refused` says the replay stopped before it. */
export function renderMoved(scenarioId: string, move: GoldenMove, detail: StepDetail | null, refused?: string): string {
  const head = move.number === null ? `${scenarioId} "${move.name}" (no longer in golden.json)` : `${scenarioId} golden ${move.number} "${move.name}"${move.kind === "new" ? " (new)" : ""}`;
  const out = [head, `  result: ${move.before} → ${move.after}`];
  if (move.kind === "moved") out.push(`  intents: ${move.intents === "same" ? "unchanged, only the stored table and state moved" : "changed"}`);
  if (move.first !== null) out.push(`  first differing step: intent #${move.first + 2} (golden.json's numbering, the Keep is #1)${detail ? `: ${detail.intent}` : ""}`);
  else if (move.kind === "moved") out.push("  first differing step: none, no intent's table differs; only the final state does");
  if (move.was !== undefined) out.push(`  intent in the base: ${move.was}`, `  intent now: ${move.now}`);
  if (refused) out.push(`  replay now: ${refused}`);
  if (detail) {
    out.push(`  records that resolved there: ${detail.effects.length > 0 ? detail.effects.join(", ") : "none"}`);
    if (detail.rules.length > 0) out.push(`  rules that resolved there: ${detail.rules.join(", ")}`);
    out.push(`  cards named there: ${detail.cards.length > 0 ? detail.cards.join(", ") : "none"}`);
    out.push("  steps:", ...detail.steps.map((line) => `    ${line}`), ...(detail.more > 0 ? [`    ... ${detail.more} more`] : []));
  }
  if (move.fields.length > 0) out.push("  final state, base → now:", ...move.fields.map((line) => `    ${line}`));
  return out.join("\n");
}

function git(args: readonly string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });
}

/** The ref to compare with: the argument, or the merge base of HEAD and origin/main. */
export function baseRef(arg: string | undefined): string {
  if (arg) return git(["rev-parse", "--verify", `${arg}^{commit}`]).trim();
  try {
    return git(["merge-base", "HEAD", "origin/main"]).trim();
  } catch {
    throw new Error("no merge base with origin/main (git fetch origin main first); name a base ref: pnpm game moved <ref>");
  }
}

/** The scenario ids whose golden.json differs from `ref` in the tree, committed or not, a new file included. */
export function changedScenarios(ref: string): string[] {
  const listed = [...git(["diff", "--name-only", ref, "--", "src/campaign/scenarios"]).split("\n"), ...git(["ls-files", "--others", "--exclude-standard", "src/campaign/scenarios"]).split("\n")];
  return [...new Set(listed.map((file) => /^src\/campaign\/scenarios\/([^/]+)\/golden\.json$/.exec(file)?.[1]).filter((id): id is string => id !== undefined))].sort();
}

/** golden.json as `ref` had it, null when it had none. */
export function goldenAt(ref: string, scenarioId: string): StoredGolden[] | null {
  try {
    return JSON.parse(git(["show", `${ref}:src/campaign/scenarios/${scenarioId}/golden.json`])) as StoredGolden[];
  } catch {
    return null;
  }
}
