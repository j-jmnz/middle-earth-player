import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs } from "../cli-args.ts";
import { ROOT } from "../data/paths.ts";
import { runScript, type Log } from "../log.ts";

// Puts the `Pipeline measure:` lines of several scenarios side by side (docs/agents/agent-brief.md, Measure; docs/agents/cycle-procedure.md, Close the cycle):
//
//   pnpm scenario measures <scenario-id...> [--ref <ref>]
//
// For each id it finds the commit of `--ref` (default origin/main, else HEAD) that added the id to src/campaign/playable.ts and has a `Pipeline measure:` line in its body, reads each task's
// wait and writing minutes from that line, and prints a markdown table (a row for each task, a column for each scenario, `wait/writing`), a Total row of writing minutes, and each scenario's
// `Review findings:` sentence. A number the line does not give is `?`, and its scenario is listed after the table.

export const SCENARIO_MEASURES_USAGE = "usage: pnpm scenario measures <scenario-id...> [--ref <ref>]";

export const MEASURE_TASKS = ["Read", "Research", "Build", "Judge", "Tests", "Words", "Games", "Review", "Fix"] as const;
export type MeasureTask = (typeof MEASURE_TASKS)[number];
export type Minutes = { wait?: number; writing?: number };
export type Measure = { tasks: Record<MeasureTask, Minutes>; findings?: string };

/** The text of the measure in a commit body: from `Pipeline measure:` to the next blank line or heading, its wrapped lines joined with a space. Undefined when the body has none. */
export function measureText(body: string): string | undefined {
  const lines = body.split("\n");
  const from = lines.findIndex((line) => line.startsWith("Pipeline measure:"));
  if (from < 0) return undefined;
  const text: string[] = [];
  for (const line of lines.slice(from)) {
    if (line.trim() === "" || (text.length > 0 && line.startsWith("#"))) break;
    text.push(line.trim());
  }
  return text.join(" ").slice("Pipeline measure:".length).trim();
}

// The labels a measure line names; "Review findings" is the Review task's sentence, "Second fix" belongs to Fix and "Focused review" to Review.
const LABEL = /(?<![\w-])(Read|Research|Build|Judge|Tests|Words|Games|Review findings|Focused review|Review|Second fix|Third fix|Fix):/g;
const OWNER: Record<string, MeasureTask> = { "Review findings": "Review", "Focused review": "Review", Review: "Review", "Second fix": "Fix", "Third fix": "Fix", Fix: "Fix" };

const sum = (text: string, pattern: RegExp): number | undefined => {
  const found = [...text.matchAll(pattern)].map((match) => Number(match[1]));
  return found.length === 0 ? undefined : found.reduce((a, b) => a + b, 0);
};

/** The wait and writing minutes of each task in a measure's text, and its `Review findings:` sentence. A task with no such numbers has none (a "Judge: 2 minutes" is not a wait or writing time); the runs of Fix, and of Review after the findings, add up. */
export function parseMeasure(text: string): Measure {
  const tasks = Object.fromEntries(MEASURE_TASKS.map((task) => [task, {} as Minutes])) as Record<MeasureTask, Minutes>;
  const marks = [...text.matchAll(LABEL)];
  let findings: string | undefined;
  marks.forEach((mark, at) => {
    const label = mark[1] ?? "";
    const end = marks[at + 1]?.index ?? text.length;
    const part = text.slice(mark.index + mark[0].length, end);
    const task = (MEASURE_TASKS as readonly string[]).includes(label) ? (label as MeasureTask) : OWNER[label];
    if (!task) return;
    if (label === "Review findings") findings = text.slice(mark.index, end).trim();
    const wait = sum(part, /(?:about )?(\d+)\s+wait minutes/g);
    const writing = sum(part, /(?:about )?(\d+)\s+writing minutes/g);
    const into = tasks[task];
    if (wait !== undefined) into.wait = (into.wait ?? 0) + wait;
    if (writing !== undefined) into.writing = (into.writing ?? 0) + writing;
  });
  return findings === undefined ? { tasks } : { tasks, findings };
}

const cell = (minutes: Minutes): string => (minutes.wait === undefined && minutes.writing === undefined ? "?" : `${minutes.wait ?? "?"}/${minutes.writing ?? "?"}`);

/** The markdown table of the measures, a column for each scenario (null: no measure found), then the Review findings sentences and the scenarios with a `?`. */
export function measureTable(columns: readonly { id: string; measure: Measure | null }[]): string {
  const head = `| Task | ${columns.map((column) => column.id).join(" | ")} |`;
  const rule = `| --- | ${columns.map(() => "---").join(" | ")} |`;
  const rows = MEASURE_TASKS.map((task) => `| ${task} | ${columns.map((column) => (column.measure ? cell(column.measure.tasks[task]) : "?")).join(" | ")} |`);
  const total = columns.map((column) => (column.measure ? String(MEASURE_TASKS.reduce((all, task) => all + (column.measure?.tasks[task].writing ?? 0), 0)) : "?"));
  const out = [head, rule, ...rows, `| Total writing | ${total.join(" | ")} |`, ""];
  for (const column of columns) out.push(`${column.id}: ${column.measure?.findings ?? "no Review findings sentence"}`);
  const missing = columns.map((column) => ({ id: column.id, tasks: column.measure ? MEASURE_TASKS.filter((task) => cell(column.measure?.tasks[task] ?? {}) === "?") : [...MEASURE_TASKS] })).filter((one) => one.tasks.length > 0);
  if (missing.length > 0) out.push("", "not parsed:", ...missing.map((one) => `- ${one.id}: ${one.tasks.join(", ")}`));
  return out.join("\n");
}

function git(args: readonly string[]): string | null {
  const run = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return run.status === 0 ? run.stdout : null;
}

/** The measure text of the oldest commit of `ref` that added `id` to PLAYABLE_SCENARIOS (src/campaign/playable.ts) and has a `Pipeline measure:` line, or undefined. */
export function measureOf(id: string, ref: string): string | undefined {
  const hashes = (git(["log", ref, "--reverse", "--format=%H", `-S"${id}"`, "--", "src/campaign/playable.ts"]) ?? "").split("\n").filter(Boolean);
  for (const hash of hashes) {
    const text = measureText(git(["show", "-s", "--format=%B", hash]) ?? "");
    if (text !== undefined) return text;
  }
  return undefined;
}

function main(log: Log): void {
  const parsed = parseArgs(process.argv.slice(2), SCENARIO_MEASURES_USAGE, { spaced: ["ref"] });
  if (parsed.help) return log.info(SCENARIO_MEASURES_USAGE);
  if (parsed.positional.length === 0) throw new Error(SCENARIO_MEASURES_USAGE);
  const ref = parsed.flags.get("ref") ?? (git(["rev-parse", "--verify", "--quiet", "origin/main"]) !== null ? "origin/main" : "HEAD");
  const columns = parsed.positional.map((id) => {
    const text = measureOf(id, ref);
    if (text === undefined) log.warn(`${id}: no commit of ${ref} adds it to PLAYABLE_SCENARIOS with a "Pipeline measure:" line`);
    return { id, measure: text === undefined ? null : parseMeasure(text) };
  });
  log.info(measureTable(columns));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("scenario:measures", main, { done: false });
