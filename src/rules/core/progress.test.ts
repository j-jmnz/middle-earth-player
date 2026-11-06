// Rules: rr.effects (data/rules/entries.json).
// Progress taken off a card: never more than it holds, a negative step in the log, nothing for a missing card or an amount that is not positive.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "./intents.ts";
import { takeProgressOff } from "./progress.ts";
import { idleScenario } from "./test-fixture.ts";
import { updateCard } from "./state.ts";
import { spawn } from "./zones.ts";

const table = (progress: number) => {
  const made = spawn(idleScenario(1), "stage", { zone: "staging" });
  return { id: made.id, state: updateCard(made.state, made.id, { progress }) };
};

describe("takeProgressOff", () => {
  it("takes the amount, or all the card holds when it holds fewer, and logs what came off as a negative progress step", () => {
    const { id, state } = table(3);
    const steps: EngineStep[] = [];
    expect(takeProgressOff(state, id, 2, steps).cards[id]?.progress).toBe(1);
    expect(steps).toMatchObject([{ kind: "progress", targetId: id, amount: -2 }]);
    const more: EngineStep[] = [];
    expect(takeProgressOff(state, id, 9, more).cards[id]?.progress).toBe(0);
    expect(more).toMatchObject([{ kind: "progress", targetId: id, amount: -3 }]);
  });

  it("changes nothing and logs nothing for a card with none, a missing card, or an amount of 0 or less", () => {
    const { id, state } = table(0);
    const steps: EngineStep[] = [];
    expect(takeProgressOff(state, id, 2, steps)).toBe(state);
    const held = table(2);
    expect(takeProgressOff(held.state, null, 1, steps)).toBe(held.state);
    expect(takeProgressOff(held.state, "missing", 1, steps)).toBe(held.state);
    expect(takeProgressOff(held.state, held.id, 0, steps)).toBe(held.state);
    expect(takeProgressOff(held.state, held.id, -1, steps)).toBe(held.state);
    expect(steps).toEqual([]);
  });
});
