import { describe, expect, it } from "vitest";

import type { RunRecord } from "../campaign/runs";
import { durationSpoken, durationWords, playtimeSpoken, playtimeWords, runDetail, runLabel } from "./history-words";

const MIN = 60000;
const HOUR = 60 * MIN;

function run(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "x",
    kind: "campaign",
    refId: "save-a",
    campaignId: "fellowship-of-the-ring",
    box: "fellowship-of-the-ring",
    scenarioId: "a-shadow-of-the-past",
    result: "won",
    lossCause: null,
    seatCount: 1,
    heroes: [["1"]],
    rounds: 4,
    threats: [30],
    victoryPoints: 0,
    score: 44,
    reward: null,
    startedAt: 0,
    endedAt: 0,
    activeMs: null,
    engineVersion: 6,
    backfilled: false,
    ...overrides,
  };
}

describe("durationWords", () => {
  it("writes minutes, hours and days", () => {
    expect(durationWords(0)).toBe("<1 min");
    expect(durationWords(59999)).toBe("<1 min");
    expect(durationWords(42 * MIN)).toBe("42 min");
    expect(durationWords(HOUR)).toBe("1 h 00 min");
    expect(durationWords(HOUR + 5 * MIN)).toBe("1 h 05 min");
    expect(durationWords(23 * HOUR + 59 * MIN)).toBe("23 h 59 min");
    expect(durationWords(26 * HOUR + 30 * MIN)).toBe("1 d 2 h");
    expect(durationWords(74 * HOUR)).toBe("3 d 2 h");
  });
});

describe("playtimeWords", () => {
  it("gives played and away when the table counted its time", () => {
    expect(playtimeWords(run({ startedAt: 0, endedAt: 107 * MIN, activeMs: 42 * MIN }))).toBe("played 42 min · away 1 h 05 min");
  });

  it("leaves away out under a minute, or with an end before the active time", () => {
    expect(playtimeWords(run({ startedAt: 0, endedAt: 42 * MIN + 30000, activeMs: 42 * MIN }))).toBe("played 42 min");
    expect(playtimeWords(run({ startedAt: 0, endedAt: 10 * MIN, activeMs: 42 * MIN }))).toBe("played 42 min");
  });

  it("gives only the active time when a time is unknown", () => {
    expect(playtimeWords(run({ startedAt: null, endedAt: 5, activeMs: 3 * MIN }))).toBe("played 3 min");
  });

  it("gives the whole span without active time, and null without both times", () => {
    expect(playtimeWords(run({ startedAt: 0, endedAt: 107 * MIN }))).toBe("1 h 47 min in all");
    expect(playtimeWords(run({ startedAt: null, endedAt: 5 }))).toBeNull();
    expect(playtimeWords(run({ startedAt: 5, endedAt: null }))).toBeNull();
  });

  it("is part of the detail line and the spoken label", () => {
    const r = run({ startedAt: 0, endedAt: 107 * MIN, activeMs: 42 * MIN });
    expect(runDetail(r, (code) => code)).toBe("4 rounds · threat 30 · Score 44 · 0 victory points · played 42 min · away 1 h 05 min");
    const label = runLabel(r, "A Shadow of the Past", (code) => code);
    expect(label).toContain("played 42 minutes, away 1 hour 5 minutes");
    expect(label).not.toMatch(/\d+ (min|h)\b/);
  });

  it("says lengths in words for a screen reader", () => {
    expect(durationSpoken(0)).toBe("less than a minute");
    expect(durationSpoken(MIN)).toBe("1 minute");
    expect(durationSpoken(42 * MIN)).toBe("42 minutes");
    expect(durationSpoken(HOUR)).toBe("1 hour");
    expect(durationSpoken(HOUR + 5 * MIN)).toBe("1 hour 5 minutes");
    expect(durationSpoken(74 * HOUR)).toBe("3 days 2 hours");
    expect(durationSpoken(48 * HOUR)).toBe("2 days");
    expect(playtimeSpoken(run({ startedAt: 0, endedAt: 107 * MIN }))).toBe("1 hour 47 minutes in all");
  });
});
