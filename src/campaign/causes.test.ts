import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/fixture.ts";
import type { EngineStep } from "../rules/intents.ts";
import { definePrinted } from "../rules/printed.ts";
import { reduce, startScenario } from "../rules/reduce.ts";
import { UNATTRIBUTED, type Cause } from "../rules/cause.ts";
import { playOut } from "../../scripts/auto-player.ts";
import { keyOf, loadLedger } from "../../scripts/data/printed/ledger.ts";
import { campaign, loadWorld, reveal, scenario, send, table } from "../../scripts/past-scene.ts";

import { buildStart } from "./start.ts";

// Every step that changes a number says why. The goldens are played again here and each threat, damage, progress,
// resource, draw and reveal step is checked: its cause is a rule span in data/rules, or an effect record with one of
// its printed ledger lines. A step with no cause, or the fallback a path uses when it forgot to pass one, fails.
const RING_BEARER = "141001";
const NUMBER_STEPS = new Set(["threat", "damage", "progress", "gainResource", "draw", "reveal"]);
const ruleIds = new Set((JSON.parse(readFileSync(new URL("../../data/rules/entries.json", import.meta.url), "utf8")) as { id: string }[]).map((entry) => entry.id));
const ledger = loadLedger();

function verified(cause: Cause | undefined): string | null {
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

let steps: EngineStep[] = [];

beforeAll(async () => {
  const world = await loadWorld();
  const cards = new Map(world.cards);
  for (const code of ["scout", "q1", "q2"]) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: code === "scout" ? 12 : 8, attack: 1, defense: 2, health: 100 }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  const ctx = { effects: EFFECTS, cards };
  const loadout = { heroes: [RING_BEARER, "scout", "q1", "q2"], deck: Array.from({ length: 30 }, () => "filler") };
  steps = [];
  for (const seed of [1, 2, 9]) {
    const start = buildStart({ campaign, scenario, seatCount: 1, seed, threatModifier: 0, seats: [loadout], effects: EFFECTS });
    const kept = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx));
    steps.push(...kept.steps, ...playOut(kept.state, ctx, { scout: "scout", prefer: "141035", protect: RING_BEARER }).steps);
  }
});

describe("engine step causes", () => {
  it("name a verified rule or a ledger line on every number-changing step of the goldens", () => {
    const numbered = steps.filter((step) => NUMBER_STEPS.has(step.kind));
    expect(numbered.length).toBeGreaterThan(100);
    const problems = numbered.flatMap((step) => {
      const why = verified((step as { cause?: Cause }).cause);
      return why ? [`${step.kind} ${why}`] : [];
    });
    expect([...new Set(problems)]).toEqual([]);
  });

  it("cover each kind of number, from rules and from effect records", () => {
    const kinds = new Set(steps.filter((step) => NUMBER_STEPS.has(step.kind)).map((step) => step.kind));
    expect([...kinds].sort()).toEqual(["damage", "draw", "gainResource", "progress", "reveal", "threat"]);
    const causes = steps.filter((step) => NUMBER_STEPS.has(step.kind)).map((step) => (step as { cause: Cause }).cause);
    expect(causes.some((cause) => "rule" in cause)).toBe(true);
  });

  it("name the effect record and its printed line when a card effect moves a number", async () => {
    // 141076 Lure of the Ring: "When Revealed: The first player must either exhaust The One Ring or raise his threat by 3."
    const world = await loadWorld();
    const { state, ctx } = table(world, { deck: ["141076", "f0"] });
    const opened = reveal(state, ctx);
    const raised = send(opened, { type: "Choose", optionId: "threat" }, ctx);
    const threat = raised.steps.find((step) => step.kind === "threat" && step.amount === 3);
    expect(threat).toMatchObject({ kind: "threat", cause: { effect: "141076:whenRevealed:1", line: "141076:A:2" } });
    expect(verified((threat as { cause?: Cause }).cause)).toBeNull();
    // 141023 raises Hide willpower, not a number step; a Response that places progress names its record too.
    expect(raised.steps.filter((step) => NUMBER_STEPS.has(step.kind)).flatMap((step) => verified((step as { cause?: Cause }).cause) ?? [])).toEqual([]);
  });
});
