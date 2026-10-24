// The table's log: this round's engine steps in words, each with its cause from phase 8d (the rule title, or the card and
// its printed line), so a player can check a number against its source. It is text, not a control.
import type { Cause } from "../rules/cause.ts";
import type { EngineStep } from "../rules/intents.ts";

export type LogNames = {
  // A card instance by id.
  card: (cardId: string) => string;
  // A card code (the card an effect record belongs to).
  code: (code: string) => string;
  // The card code an effect record id belongs to.
  effectCard: (effectId: string) => string | null;
  rule: (ruleId: string) => string | null;
  line: (lineId: string) => string | null;
};

// The mark beside a log line: a game icon (threat, willpower), or a token coin for damage, progress and a resource (no
// high-resolution source of those tokens exists; docs/design-system.md, Icons).
export type LogMark = "threat" | "willpower" | "damage" | "progress" | "resource" | null;

export type LogLine = { key: string; text: string; cause: string | null; mark: LogMark };

function markOf(step: EngineStep): LogMark {
  switch (step.kind) {
    case "threat":
      return "threat";
    case "hideTest":
      return "willpower";
    case "damage":
      return "damage";
    case "progress":
      return "progress";
    case "gainResource":
      return "resource";
    default:
      return null;
  }
}

function player(seat: number): string {
  return `Player ${seat + 1}`;
}

function signed(amount: number): string {
  return amount >= 0 ? `+${amount}` : String(amount);
}

/** The cause of a step in words: "Rule: <title>", or "<card>: <printed line>". */
export function causeText(cause: Cause, names: LogNames): string {
  if ("rule" in cause) return `Rule: ${names.rule(cause.rule) ?? cause.rule}`;
  const code = names.effectCard(cause.effect);
  const card = code ? names.code(code) : cause.effect;
  const line = names.line(cause.line);
  return line ? `${card}: ${line}` : card;
}

function words(step: EngineStep, names: LogNames): string | null {
  switch (step.kind) {
    case "push":
    case "pop":
      return null;
    case "draw":
      return `${player(step.seat)} draws a card`;
    case "gainResource":
      return `${names.card(step.heroId)} gains 1 resource`;
    case "damage":
      return `${step.amount} damage on ${names.card(step.targetId)}`;
    case "threat":
      return `${player(step.seat)} threat ${signed(step.amount)}`;
    case "progress":
      return `${step.amount} progress on ${names.card(step.targetId)}`;
    case "destroy":
      return `${names.card(step.targetId)} is destroyed`;
    case "eliminate":
      return `${player(step.seat)} is eliminated`;
    case "reveal":
      return `${player(step.seat)} reveals ${names.card(step.cardId)}`;
    case "engage":
      return `${names.card(step.enemyId)} engages ${player(step.seat)}`;
    case "commit":
      return `${names.card(step.cardId)} commits to the quest`;
    case "hideCommit":
      return `${names.card(step.cardId)} commits to the Hide test`;
    case "hideTest":
      return `Hide test ${step.success ? "passed" : "failed"}: willpower ${step.willpower} against threat ${step.threat}`;
    case "advance":
      return `The quest advances to ${names.card(step.cardId)}`;
    case "attack":
      return step.side === "enemy" ? `${names.card(step.enemyId)} attacks ${player(step.seat)}` : `${player(step.seat)} attacks ${names.card(step.enemyId)}`;
    case "cancel":
      return `${names.card(step.cardId)} is canceled`;
  }
}

/** The round's steps as log lines, oldest first. Frame pushes and pops are bookkeeping and are left out. */
export function logLines(steps: readonly EngineStep[], names: LogNames): LogLine[] {
  const lines: LogLine[] = [];
  steps.forEach((step, index) => {
    const text = words(step, names);
    if (!text) return;
    lines.push({ key: `${index}`, text, cause: "cause" in step ? causeText(step.cause, names) : null, mark: markOf(step) });
  });
  return lines;
}
