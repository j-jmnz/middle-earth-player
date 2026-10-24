import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/fixture.ts";
import type { EngineStep } from "../rules/intents.ts";
import { definePrinted } from "../rules/printed.ts";
import { reduce, startScenario } from "../rules/reduce.ts";
import { type Cause } from "../rules/cause.ts";
import { playOut } from "../../scripts/auto-player.ts";
import { causeProblems, NUMBER_STEPS, verified } from "../../scripts/cause-check.ts";
import { campaign, loadWorld, reveal, scenario, send, table } from "../../scripts/past-scene.ts";
import { playStarter, starterWorld, STARTER_SEEDS } from "../../scripts/starter-game.ts";

import { buildStart } from "./start.ts";

// Every step that changes a number says why. The goldens are played again here and each threat, damage, progress,
// resource, draw and reveal step is checked: its cause is a rule span in data/rules, or an effect record with one of
// its printed ledger lines. A step with no cause, or the fallback a path uses when it forgot to pass one, fails.
const RING_BEARER = "141001";

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

describe("engine step causes in the starter-deck goldens", () => {
  it("name a verified rule or a ledger line on every number-changing step of both starter decks", async () => {
    const all: EngineStep[] = [];
    for (const deck of campaign.starterDecks) {
      const { ctx } = await starterWorld(deck.id);
      for (const seed of STARTER_SEEDS) {
        const game = playStarter(deck.id, seed, ctx);
        all.push(...game.run.steps);
      }
    }
    expect(all.filter((step) => NUMBER_STEPS.has(step.kind)).length).toBeGreaterThan(100);
    expect(causeProblems(all)).toEqual([]);
  });
});

describe("engine step causes", () => {
  it("name a verified rule or a ledger line on every number-changing step of the goldens", () => {
    const numbered = steps.filter((step) => NUMBER_STEPS.has(step.kind));
    expect(numbered.length).toBeGreaterThan(100);
    expect(causeProblems(steps)).toEqual([]);
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
    expect(causeProblems(raised.steps)).toEqual([]);
  });
});
