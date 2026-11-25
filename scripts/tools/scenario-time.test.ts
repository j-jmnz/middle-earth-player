import { describe, expect, it } from "vitest";

import { parseTimes, recordEvent, summaryLine, timeCommand, type Stamp, type TimeIo } from "./scenario-time.ts";

// pnpm scenario time records the times of a scenario's tasks and prints the Measure line (docs/agents/agent-brief.md, Measure). The clock is injected, so the times are fixed.

const at = (minute: number): Date => new Date(Date.UTC(2026, 10, 25, 8, 0, 0) + minute * 60000);
const run = (steps: readonly [string, string, number][]): Stamp[] => steps.reduce<Stamp[]>((events, [task, event, minute]) => recordEvent(events, task as Stamp["task"], event as Stamp["event"], at(minute)), []);

describe("scenario time: the order of events", () => {
  it("refuses a wait before a start, a resume with no wait, an end while waiting and a second end", () => {
    expect(() => run([["read", "wait", 1]])).toThrow(/Cannot wait read/);
    expect(() => run([["read", "start", 0], ["read", "resume", 1]])).toThrow(/Cannot resume read/);
    expect(() => run([["read", "start", 0], ["read", "wait", 1], ["read", "end", 2]])).toThrow(/Cannot end read/);
    expect(() => run([["read", "start", 0], ["read", "end", 1], ["read", "end", 2]])).toThrow(/Cannot end read/);
    expect(() => run([["read", "start", 0], ["read", "start", 1]])).toThrow(/already running/);
  });

  it("lets a task start again after its end, and keeps each task's order apart", () => {
    const events = run([["fix", "start", 0], ["fix", "end", 5], ["fix", "start", 6], ["build", "start", 6], ["fix", "end", 9]]);
    expect(events).toHaveLength(5);
    expect(summaryLine(events)).toBe("Build: open. Fix: 0 wait minutes, 8 writing minutes.");
  });
});

describe("scenario time: the line", () => {
  it("sums wait spans and writing minutes (start to end less the waits), in pipeline order", () => {
    const events = run([
      ["build", "start", 0],
      ["read", "start", 0],
      ["read", "wait", 10],
      ["read", "resume", 11],
      ["read", "end", 46],
      ["build", "wait", 20],
      ["build", "resume", 31],
      ["build", "end", 201],
    ]);
    expect(summaryLine(events)).toBe("Read: 1 wait minutes, 45 writing minutes. Build: 11 wait minutes, 190 writing minutes.");
  });

  it("adds the runs of a task that ran several times, and prints a task with no end as open", () => {
    const events = run([["fix", "start", 0], ["fix", "wait", 4], ["fix", "resume", 6], ["fix", "end", 10], ["fix", "start", 20], ["fix", "end", 25], ["review", "start", 26]]);
    expect(summaryLine(events)).toBe("Review: open. Fix: 2 wait minutes, 13 writing minutes.");
    expect(summaryLine(run([["fix", "start", 0], ["fix", "end", 3], ["fix", "start", 5]]))).toBe("Fix: open.");
  });

  it("is empty for no events", () => {
    expect(summaryLine([])).toBe("");
  });
});

describe("scenario time: the command", () => {
  const store = new Map<string, Stamp[]>();
  let minute = 0;
  const io: TimeIo = { now: () => at(minute), read: (id) => store.get(id) ?? [], append: (id, stamp) => void store.set(id, [...(store.get(id) ?? []), stamp]), known: (id) => id !== "no-such" };

  it("appends events, takes any letter case, and prints the line for an id alone", () => {
    expect(timeCommand(["the-oath", "Build", "START"], io)).toContain("the-oath build start at 2026-11-25T08:00:00.000Z");
    minute = 30;
    timeCommand(["the-oath", "build", "end"], io);
    expect(store.get("the-oath")).toEqual([
      { task: "build", event: "start", at: "2026-11-25T08:00:00.000Z" },
      { task: "build", event: "end", at: "2026-11-25T08:30:00.000Z" },
    ]);
    expect(timeCommand(["the-oath"], io)).toBe("Build: 0 wait minutes, 30 writing minutes.");
    expect(timeCommand(["other"], io)).toBe("other: no times recorded");
  });

  it("records the writing minutes of a read-only agent's task after the fact, and adds them to a run", () => {
    expect(timeCommand(["added", "research", "add", "6"], io)).toContain("added research add 6 minutes");
    expect(timeCommand(["added"], io)).toBe("Research: 0 wait minutes, 6 writing minutes.");
    timeCommand(["added", "research", "add", "4"], io);
    timeCommand(["added", "read", "start"], io);
    timeCommand(["added", "read", "add", "2"], io);
    timeCommand(["added", "read", "end"], io);
    expect(timeCommand(["added"], io)).toBe("Read: 0 wait minutes, 2 writing minutes. Research: 0 wait minutes, 10 writing minutes.");
    expect(() => timeCommand(["added", "research", "add"], io)).toThrow(/positive number/);
    expect(() => timeCommand(["added", "research", "add", "0"], io)).toThrow(/positive number/);
    expect(() => timeCommand(["added", "research", "add", "x"], io)).toThrow(/positive number/);
    expect(() => timeCommand(["added", "research", "start", "3"], io)).toThrow(/usage/);
  });

  it("refuses an unknown task or event, a task without an event, a bad id and a scenario with no data file", () => {
    expect(() => timeCommand(["the-oath", "paint", "start"], io)).toThrow(/not a task/);
    expect(() => timeCommand(["the-oath", "build", "pause"], io)).toThrow(/not an event/);
    expect(() => timeCommand(["the-oath", "build"], io)).toThrow(/usage/);
    expect(() => timeCommand([], io)).toThrow(/usage/);
    expect(() => timeCommand(["../x", "build", "start"], io)).toThrow(/not a scenario id/);
    expect(() => timeCommand(["no-such", "build", "start"], io)).toThrow(/data\/scenarios/);
  });
});

describe("scenario time: the file", () => {
  it("reads JSON lines, skipping blank lines", () => {
    expect(parseTimes('{"task":"fix","event":"start","at":"2026-11-25T08:00:00.000Z"}\n\n{"task":"fix","event":"add","at":"2026-11-25T08:01:00.000Z","minutes":3}\n', "x.times.jsonl")).toHaveLength(2);
  });

  it("names the file and the line when a line is not an event", () => {
    expect(() => parseTimes("{not json", "a.times.jsonl")).toThrow(/a\.times\.jsonl, line 1: not JSON/);
    expect(() => parseTimes('{"events":[]}', "a.times.jsonl")).toThrow(/a\.times\.jsonl, line 1: not a task event/);
    expect(() => parseTimes('[1]\n', "a.times.jsonl")).toThrow(/line 1/);
    expect(() => parseTimes('{"task":"fix","event":"add","at":"2026-11-25T08:00:00.000Z"}', "a.times.jsonl")).toThrow(/add without positive minutes/);
  });
});
