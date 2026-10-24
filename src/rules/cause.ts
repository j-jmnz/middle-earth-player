import type { Effect } from "../catalog/boundary.ts";

// Why a step happened. A step that changes a number (threat, damage, progress, resources, a draw, a reveal) names
// either the rule that moved it (a span id in data/rules/entries.json) or the effect record and the printed line
// (a ledger line id in data/printed) it implements. A test plays the goldens and refuses any other cause.
export type Cause = { rule: string } | { effect: string; line: string };

export function ruleCause(rule: string): Cause {
  return { rule };
}

export function effectCause(effect: Effect): Cause {
  return { effect: effect.id, line: effect.lines[0] ?? "" };
}

// What a verb run outside any effect record falls back to. The cause test fails on it, so a path that forgot to
// pass its cause is found rather than hidden.
export const UNATTRIBUTED: { rule: string } = { rule: "rr.effects" };

// The effect that is running right now. Effect runners push their cause around the verbs they run; a step pushed
// while one is active takes it, and any other step takes the rule its framework code names.
const active = new WeakMap<object, Cause[]>();

export function inCause<T>(steps: object, cause: Cause | undefined, run: () => T): T {
  if (!cause) return run();
  const stack = active.get(steps) ?? [];
  active.set(steps, [...stack, cause]);
  try {
    return run();
  } finally {
    active.set(steps, stack);
  }
}

export function currentCause(steps: object, fallback: Cause): Cause {
  return active.get(steps)?.at(-1) ?? fallback;
}
