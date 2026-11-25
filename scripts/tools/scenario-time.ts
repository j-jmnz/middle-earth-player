import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs } from "../cli-args.ts";
import { ROOT } from "../data/paths.ts";
import { runScript, type Log } from "../log.ts";

// Records when a scenario task starts, waits, resumes and ends, so the `Pipeline measure:` line holds times that were measured (docs/agents/agent-brief.md, Measure):
//
//   pnpm scenario time <scenario-id> <task> start|wait|resume|end
//   pnpm scenario time <scenario-id>
//
// An event is appended to `.agent/handoff/<scenario-id>.times.json` (not committed) as `{task, event, at}`. A task runs start, then any number of wait and resume pairs, then end, and may
// run again with a new start (fix rounds); its minutes add up. A wait is the time the agent spent blocked on a long run, writing is the rest between start and end. With no task the command
// prints the line for the Measure section; `pnpm scenario measures` reads that line back from the history.

export const SCENARIO_TIME_USAGE = "usage: pnpm scenario time <scenario-id> [<task> start|wait|resume|end]";

export const TASKS = ["read", "research", "build", "judge", "tests", "words", "games", "review", "fix"] as const;
export const EVENTS = ["start", "wait", "resume", "end"] as const;
export type Task = (typeof TASKS)[number];
export type TimeEvent = (typeof EVENTS)[number];
export type Stamp = { task: Task; event: TimeEvent; at: string };

/** Where each event may follow: the state of a task after its last event (none before the first). */
const AFTER: Record<TimeEvent, { from: readonly (TimeEvent | "none")[]; hint: string }> = {
  start: { from: ["none", "end"], hint: "the task is already running: end it before a new start" },
  wait: { from: ["start", "resume"], hint: "a wait needs a running task: start it, or resume it first" },
  resume: { from: ["wait"], hint: "a resume needs a wait before it" },
  end: { from: ["start", "resume"], hint: "an end needs a running task (start it first; after a wait, resume first; a task that ended starts again with a new start)" },
};

/** The events with one more for `task`, or a thrown refusal when that event cannot follow the task's last one. */
export function recordEvent(events: readonly Stamp[], task: Task, event: TimeEvent, at: Date): Stamp[] {
  const last = [...events].reverse().find((stamp) => stamp.task === task)?.event ?? "none";
  const rule = AFTER[event];
  if (!rule.from.includes(last)) throw new Error(`Cannot ${event} ${task}: its last event is ${last === "none" ? "nothing" : last}, and ${rule.hint}.`);
  return [...events, { task, event, at: at.toISOString() }];
}

type Total = { wait: number; writing: number; open: boolean };

/** The wait and writing milliseconds of each task, and whether a run of it has no end. */
function totals(events: readonly Stamp[]): Map<Task, Total> {
  const out = new Map<Task, Total>();
  const began = new Map<Task, { start: number; waits: number; since: number | null }>();
  for (const { task, event, at } of events) {
    const time = Date.parse(at);
    const total = out.get(task) ?? { wait: 0, writing: 0, open: false };
    out.set(task, total);
    const run = began.get(task);
    if (event === "start") {
      began.set(task, { start: time, waits: 0, since: null });
      total.open = true;
    } else if (run && event === "wait") run.since = time;
    else if (run && event === "resume" && run.since !== null) {
      run.waits += time - run.since;
      run.since = null;
    } else if (run && event === "end") {
      total.wait += run.waits;
      total.writing += time - run.start - run.waits;
      total.open = false;
      began.delete(task);
    }
  }
  return out;
}

const minutes = (ms: number): number => Math.round(ms / 60000);
const title = (task: Task): string => task.charAt(0).toUpperCase() + task.slice(1);

/** The line of the Measure section: `Read: 1 wait minutes, 45 writing minutes. Build: open.`, tasks in pipeline order, none for a task with no event. */
export function summaryLine(events: readonly Stamp[]): string {
  const all = totals(events);
  return TASKS.filter((task) => all.has(task))
    .map((task) => {
      const total = all.get(task);
      return !total || total.open ? `${title(task)}: open.` : `${title(task)}: ${minutes(total.wait)} wait minutes, ${minutes(total.writing)} writing minutes.`;
    })
    .join(" ");
}

export type TimeIo = { now: () => Date; read: (id: string) => Stamp[]; write: (id: string, events: readonly Stamp[]) => void };

/** Runs the command on `io` and returns what to print: the summary line for an id alone, the recorded event for an id with a task. */
export function timeCommand(positional: readonly string[], io: TimeIo): string {
  const [id, taskArg, eventArg, ...extra] = positional;
  if (id === undefined || extra.length > 0 || (taskArg === undefined) !== (eventArg === undefined)) throw new Error(SCENARIO_TIME_USAGE);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`"${id}" is not a scenario id.\n${SCENARIO_TIME_USAGE}`);
  if (taskArg === undefined) return summaryLine(io.read(id)) || `${id}: no times recorded`;
  const task = TASKS.find((name) => name === taskArg.toLowerCase());
  if (!task) throw new Error(`"${taskArg}" is not a task (${TASKS.join(", ")}).`);
  const event = EVENTS.find((name) => name === eventArg?.toLowerCase());
  if (!event) throw new Error(`"${eventArg}" is not an event (${EVENTS.join(", ")}).`);
  const events = recordEvent(io.read(id), task, event, io.now());
  io.write(id, events);
  return `${id} ${task} ${event} at ${events[events.length - 1]?.at}`;
}

const fileOf = (id: string): string => path.join(ROOT, ".agent", "handoff", `${id}.times.json`);

const fileIo: TimeIo = {
  now: () => new Date(),
  read: (id) => (existsSync(fileOf(id)) ? (JSON.parse(readFileSync(fileOf(id), "utf8")) as Stamp[]) : []),
  write: (id, events) => {
    mkdirSync(path.dirname(fileOf(id)), { recursive: true });
    writeFileSync(fileOf(id), `${JSON.stringify(events, null, 2)}\n`);
  },
};

function main(log: Log): void {
  const parsed = parseArgs(process.argv.slice(2), SCENARIO_TIME_USAGE);
  if (parsed.help) return log.info(SCENARIO_TIME_USAGE);
  log.info(timeCommand(parsed.positional, fileIo));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("scenario:time", main, { done: false });
