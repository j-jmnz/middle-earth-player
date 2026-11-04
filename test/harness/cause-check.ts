import { readFileSync } from "node:fs";

import { EFFECTS } from "../../src/effects/index.ts";
import type { EngineStep } from "../../src/rules/core/intents.ts";
import { UNATTRIBUTED, type Cause } from "../../src/rules/core/cause.ts";

import { keyOf, loadLedger } from "../../scripts/data/printed/ledger.ts";

// Test helper. Every step that changes a number says why: its cause is a rule span in data/rules, or an effect record
// with one of its printed ledger lines. `causeProblems` lists the steps that fail that, so a card-effect test can call
// it on the steps it collected (a-shadow-of-the-past/scene.ts and harness/scene.ts do, in `send`).
export const NUMBER_STEPS: ReadonlySet<string> = new Set(["threat", "damage", "progress", "gainResource", "draw", "reveal", "life"]);

const ruleIds = new Set((JSON.parse(readFileSync(new URL("../../data/rules/entries.json", import.meta.url), "utf8")) as { id: string }[]).map((entry) => entry.id));
const ledger = loadLedger();

export function verified(cause: Cause | undefined): string | null {
  if (!cause) return "has no cause";
  if ("rule" in cause) {
    if (cause.rule === UNATTRIBUTED.rule) return "has the unattributed cause";
    return ruleIds.has(cause.rule) ? null : `names ${cause.rule}, which is not a rule span`;
  }
  const effect = EFFECTS.find((candidate) => candidate.id === cause.effect);
  if (!effect) return `names ${cause.effect}, which is not an effect record`;
  if (!effect.lines.includes(cause.line)) return `names line ${cause.line}, which ${cause.effect} does not implement`;
  const [code, side, n] = cause.line.split(":");
  return ledger.byKey.get(keyOf(code ?? "", side ?? ""))?.lines[Number(n) - 1] ? null : `names line ${cause.line}, which is not in the ledger`;
}

export function causeProblems(steps: readonly EngineStep[]): string[] {
  return [...new Set(steps.filter((step) => NUMBER_STEPS.has(step.kind)).flatMap((step) => {
    const why = verified((step as { cause?: Cause }).cause);
    return why ? [`${step.kind} ${why}`] : [];
  }))];
}
