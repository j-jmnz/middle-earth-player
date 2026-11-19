// `pnpm game` (scripts/game): a fixture replayed to a moment and printed with its cards named, a condition that stops the replay, an intent the
// reducer refuses, and where two games part. It reads the `duo` fixture, eight intents of A Shadow of the Past, so it plays no whole game.
import { describe, expect, it } from "vitest";

import { firstDifferent, stateDiff } from "./diff.ts";
import { intentText } from "./names.ts";
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
    await expect(loadSource("nope")).rejects.toThrow("neither a fixture");
    await expect(loadSource("no-such-scenario/1")).rejects.toThrow("no goldens");
  });

  it("finds where two games part and the fields where two states differ", () => {
    expect(firstDifferent([{ type: "Pass" }, { type: "Keep" }], [{ type: "Pass" }, { type: "Mulligan" }])).toBe(1);
    expect(firstDifferent([1, 2], [1, 2, 3])).toBe(2);
    expect(firstDifferent([1, 2], [1, 2])).toBeNull();
    expect(stateDiff({ round: 2, cards: { i1: { damage: 1 } } }, { round: 2, cards: { i1: { damage: 3 } } })).toEqual(["cards.i1.damage: 1 → 3"]);
    expect(stateDiff({ a: 1, b: 2, c: 3 }, { a: 2, b: 3, c: 4 }, 2)).toHaveLength(2);
  });
});
