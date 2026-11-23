// `pnpm game` (scripts/game): a fixture replayed to a moment and printed with its cards named, a condition that stops the replay, an intent the
// reducer refuses, and where two games part. It reads the `duo` fixture, eight intents of A Shadow of the Past, so it plays no whole game.
import { describe, expect, it } from "vitest";

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { firstDifferent, stateDiff } from "./diff.ts";
import { compareGoldens, type StoredGolden } from "./compare.ts";
import { baseRef, changedScenarios, goldenAt, renderMoved } from "./moved.ts";
import { intentText } from "./names.ts";
import { layoutOf, sceneSource } from "./scene-source.ts";
import { loadSource } from "./source.ts";
import { stateText } from "./state-text.ts";
import { parseUntil, walk } from "./walk.ts";

describe("pnpm game", () => {
  it("replays a fixture to a moment and prints the table with its cards named and the legal intents", async () => {
    const source = await loadSource("duo");
    expect(source.intents[0]).toEqual({ type: "Keep" });
    const walked = walk(source, { at: source.intents.length });
    expect(walked.refused).toBeNull();
    expect(walked.at).toBe(source.intents.length);
    const text = stateText(walked.state, source.ctx, { legal: true });
    expect(text).toContain("a-shadow-of-the-past, round 1, Planning");
    expect(text).toContain("Frodo Baggins (141001)");
    expect(text).toMatch(/legal intents \(\d+\):\n {2}Pass/);
    expect(intentText(walked.moves[0]!.intent, walked.moves[0]!.before, source.ctx)).toBe("Keep");
  });

  it("stops at the first state a condition holds for, and reports an intent the reducer refuses", async () => {
    const source = await loadSource("duo");
    expect(walk(source, { until: parseUntil("phase=Planning") }).state.phase).toBe("Planning");
    expect(() => parseUntil("bogus")).toThrow("--until takes");
    const refused = walk({ ...source, intents: [{ type: "DeclineAttack" }] });
    expect(refused.at).toBe(0);
    expect(refused.refused?.reason).toBeTruthy();
  });

  it("refuses a name that is neither a fixture nor a scenario's golden", async () => {
    await expect(loadSource("nope")).rejects.toThrow("is not a fixture");
    await expect(loadSource("no-such-scenario/1")).rejects.toThrow("no goldens");
  });

  it("finds where two games part and the fields where two states differ", () => {
    expect(firstDifferent([{ type: "Pass" }, { type: "Keep" }], [{ type: "Pass" }, { type: "Mulligan" }])).toBe(1);
    expect(firstDifferent([1, 2], [1, 2, 3])).toBe(2);
    expect(firstDifferent([1, 2], [1, 2])).toBeNull();
    expect(stateDiff({ round: 2, cards: { i1: { damage: 1 } } }, { round: 2, cards: { i1: { damage: 3 } } })).toEqual(["cards.i1.damage: 1 → 3"]);
    expect(stateDiff({ a: 1, b: 2, c: 3 }, { a: 2, b: 3, c: 4 }, 2)).toHaveLength(2);
  });

  it("builds a table from a test layout, with a player card the scenario does not deal, and plays it", () => {
    const source = sceneSource("passage-through-mirkwood", { phase: "Combat", engaged: ["01096"], hand: ["01034"], heroResources: 3 });
    const text = stateText(source.opening, source.ctx, { legal: true });
    expect(text).toContain("Forest Spider (01096)");
    expect(text).toContain("PlayCard Feint (01034)");
  });

  it("reads a layout inline or from a file, and says when it is not JSON", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "game-layout-"));
    writeFileSync(path.join(dir, "layout.json"), '{"phase":"Quest"}');
    expect(layoutOf('{"seats":2}', dir)).toEqual({ seats: 2 });
    expect(layoutOf("@layout.json", dir)).toEqual({ phase: "Quest" });
    expect(layoutOf(undefined, dir)).toEqual({});
    expect(() => layoutOf("{nope", dir)).toThrow("not JSON");
  });

  it("reports a throw from the reducer as a refusal, with the table before it", async () => {
    const source = await loadSource("duo");
    const broken = { ...source.ctx, get effects(): never { throw new Error("boom"); } };
    const walked = walk({ ...source, ctx: broken });
    expect(walked.at).toBe(0);
    expect(walked.refused?.reason).toContain("the reducer threw: boom");
  });

  it("refuses a smoke source with a seed that is not a number", async () => {
    await expect(loadSource("encounter:the-oath:x")).rejects.toThrow("whole number");
  });

  it("compares two golden.json files: result, intents or stored state, the first intent whose table differs", () => {
    const golden = (over: Partial<StoredGolden> = {}): StoredGolden => ({ name: "solo", outcome: "won", intents: [{ type: "Pass" }, { type: "Keep" }, { type: "Pass" }], checks: [1, 2, 3], state: { round: 3, lost: false, stageCleared: true }, ...over });
    expect(compareGoldens([golden()], [golden()])).toEqual([]);
    const [onlyState] = compareGoldens([golden()], [golden({ checks: [1, 9, 3], state: { round: 4, lost: false, stageCleared: true } })]);
    expect(onlyState).toMatchObject({ number: 1, kind: "moved", before: "won, last round 3", after: "won, last round 4", intents: "same", first: 1, fields: ["round: 3 → 4"] });
    const [changed] = compareGoldens([golden()], [golden({ outcome: "lost", intents: [{ type: "Pass" }, { type: "Keep" }, { type: "Mulligan" }], state: { round: 3, lost: true, lossReason: "threat" } })], ["other", "solo"]);
    expect(changed).toMatchObject({ number: 2, intents: "changed", first: 2, was: '{"type":"Pass"}', now: '{"type":"Mulligan"}', after: "lost (threat), last round 3" });
    expect(compareGoldens(null, [golden()])[0]).toMatchObject({ kind: "new", before: "none" });
    expect(compareGoldens([golden(), golden({ name: "gone" })], [golden()])).toEqual([expect.objectContaining({ kind: "removed", name: "gone", number: null })]);
    const block = renderMoved("a-scenario", onlyState!, { intent: "Pass", effects: ["01012:action:1 (Beravor)"], rules: [], cards: ["Beravor (01012)"], steps: ["draw"], more: 2 });
    expect(block).toContain('a-scenario golden 1 "solo"');
    expect(block).toContain("first differing step: intent #3 (golden.json's numbering, the Keep is #1): Pass");
    expect(block).toContain("records that resolved there: 01012:action:1 (Beravor)");
    expect(block).toContain("... 2 more");
  });

  it("says when a golden got shorter that the game now ends there, and keys a row without a name by its seed and place", () => {
    const golden = (over: Partial<StoredGolden> = {}): StoredGolden => ({ name: "solo", outcome: "won", intents: [{ type: "Pass" }, { type: "Keep" }, { type: "Pass" }], checks: [1, 2, 3], state: { round: 3 }, ...over });
    const [shorter] = compareGoldens([golden()], [golden({ intents: [{ type: "Pass" }, { type: "Keep" }], checks: [1, 2] })]);
    expect(shorter).toMatchObject({ first: 2, endsNow: true, was: '{"type":"Pass"}', now: "(ended)" });
    const block = renderMoved("a-scenario", shorter!, { intent: "Commit", effects: [], rules: [], cards: [], steps: [], more: 0 });
    expect(block).toContain("the game now ends after intent #3");
    expect(block).toContain("last intent: Commit");
    expect(block).not.toContain("intent now");
    const longer = compareGoldens([golden({ intents: [{ type: "Pass" }], checks: [1] })], [golden()])[0];
    expect(longer).toMatchObject({ first: 1, endsNow: false });
    const row = (seed: number, round: number): StoredGolden => ({ seed, intents: [{ type: "Pass" }], checks: [1], state: { round } });
    const moves = compareGoldens([row(1, 2), row(1, 3)], [row(1, 2), row(1, 4)]);
    expect(moves).toEqual([expect.objectContaining({ name: "seed 1, row 2", number: 2, kind: "moved", fields: ["round: 3 → 4"] })]);
  });

  it("returns no golden.json only for a file the ref does not hold, and refuses a flag as a ref", () => {
    expect(goldenAt("HEAD", "no-such-scenario")).toBeNull();
    expect(() => baseRef("--verbose")).toThrow("not a ref");
  });

  it("names the base ref and the scenarios whose golden.json differs from it", () => {
    expect(baseRef("HEAD")).toMatch(/^[0-9a-f]{40}$/);
    expect(changedScenarios("HEAD")).toEqual(expect.any(Array));
  });
});
