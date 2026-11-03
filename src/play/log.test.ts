import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../scripts/starter-game.ts";
import { ledgerLine, ruleTitle } from "./ledger.ts";

import { causeText, logLines, type LogNames } from "./log.ts";
import { nextRoundSteps } from "./store.ts";

// The log sheet names each step of the round and its cause: a rule title from data/rules, or the card and its printed line
// from data/printed (phase 8d stamps a cause on every step that moves a number).
let ctx: ReduceContext;
let names: LogNames;

beforeAll(async () => {
  ctx = (await starterWorld("stealth-and-steadfastness")).ctx;
  names = {
    card: (id) => id,
    code: (code) => ctx.cards.get(code)?.name ?? code,
    effectCard: (id) => ctx.effects.find((effect) => effect.id === id)?.cardCode ?? null,
    rule: ruleTitle,
    line: ledgerLine,
  };
});

describe("log lines", () => {
  it("every numeric step of a whole game names a rule title or a card and its printed line", () => {
    let state: ScenarioState = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 2), ctx), { type: "Keep" }, ctx)).state;
    let round: ReturnType<typeof nextRoundSteps> = [];
    let cardCauses = 0;
    for (let turn = 0; turn < 600 && !state.lost; turn += 1) {
      const result = expectOk(reduce(state, nextIntent(state, ctx, { scout: "141004", prefer: "141035", protect: RING_BEARER, play: true, act: true }), ctx));
      round = nextRoundSteps(round, state, result.state, result.steps);
      for (const step of result.steps) {
        if (!("cause" in step)) continue;
        const text = causeText(step.cause, names);
        if ("rule" in step.cause) expect(text, step.cause.rule).toBe(`Rule: ${ruleTitle(step.cause.rule)}`);
        else {
          expect(ledgerLine(step.cause.line), step.cause.line).not.toBeNull();
          expect(text).toContain(": ");
          cardCauses += 1;
        }
      }
      state = result.state;
    }
    expect(cardCauses).toBeGreaterThan(0);
    const lines = logLines(round, names);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((line) => line.text.length > 0)).toBe(true);
  });

  it("leaves frame bookkeeping out and words a threat step with its sign", () => {
    const lines = logLines(
      [
        { kind: "push", frame: "reveal", cardId: null, peril: false },
        { kind: "threat", seat: 0, amount: 2, cause: { rule: "rr.step-3-4" } },
      ],
      names,
    );
    expect(lines).toEqual([{ key: "1", text: "Player 1 threat +2", cause: `Rule: ${ruleTitle("rr.step-3-4")}`, mark: "threat" }]);
  });

  it("words removed progress as a removal, not a negative number (141026:B:2)", () => {
    const cause = { effect: "141026:forced:1", line: "141026:B:2" };
    const lines = logLines(
      [
        { kind: "progress", targetId: "stage", amount: -2, cause },
        { kind: "progress", targetId: "stage", amount: 3, cause: { rule: "rr.step-3-4" } },
      ],
      { ...names, card: () => "Into the Wild" },
    );
    expect(lines.map((line) => line.text)).toEqual(["2 progress removed from Into the Wild", "3 progress on Into the Wild"]);
    expect(lines[0]?.mark).toBe("progress");
    expect(lines[0]?.cause).toBe(causeText(cause, names));
    expect(lines.some((line) => line.text.includes("-"))).toBe(false);
  });
});
