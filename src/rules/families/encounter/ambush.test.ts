import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { ScenarioState } from "../../core/state.ts";
import { withThreat } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { enemy, hero, table, treachery } from "../defense/table.ts";

// Rules: dwd.ambush, rr.engagement-check, rr.engaged, rr.reveal, rr.running-out-of-cards (data/rules/entries.json); ledger lines 04049:A:1, 04045:A:1, 901405:A:2, 901406:A:2, 901402:A:1, 04043:A:1, 901408:A:1.
// An enemy with the ambush keyword that enters play (a reveal, a return from the discard pile) makes each player in turn, the first player first, an engagement check against it alone; the first player to engage it ends the checks.

const SOURCE = treachery("source");
const AMBUSHER = enemy("ambusher", { keywords: { ambush: true }, engagementCost: 25 });
const PLAIN = enemy("plain", { engagementCost: 25 });

type Build = { instructions: Instruction[]; deck?: readonly string[]; discard?: readonly string[]; threats?: readonly number[]; seatCount?: 1 | 2; flags?: readonly { instanceId: string; stat: string; amount: number }[]; extra?: readonly Effect[]; firstPlayer?: number };

function run(spec: Build) {
  const record: Effect = { id: "source:whenRevealed:1", cardCode: "source", lines: ["source:A:1"], timing: "whenRevealed", instructions: spec.instructions };
  const seatCount = spec.seatCount ?? 1;
  const built = table({ cards: [hero("a"), hero("b"), SOURCE, AMBUSHER, PLAIN, treachery("mist")], effects: [record, ...(spec.extra ?? [])], seatCount, heroes: seatCount === 2 ? [{ code: "a", seat: 0 }, { code: "b", seat: 1 }] : [{ code: "a" }], hand: [{ code: "source" }] });
  let state: ScenarioState = built.state;
  for (const code of spec.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }).state;
  for (const code of spec.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  (spec.threats ?? []).forEach((threat, seat) => (state = withThreat(state, seat, threat)));
  for (const flag of spec.flags ?? []) state = { ...state, modifiers: [...state.modifiers, { instanceId: flag.instanceId, sourceId: "table", stat: flag.stat as never, amount: flag.amount, until: "endOfGame" }] };
  const source = Object.values(state.cards).find((card) => card.code === "source")!;
  const steps: EngineStep[] = [];
  const pushed = pushCardEffects({ ...state, firstPlayer: spec.firstPlayer ?? 0, phase: "Quest", window: null }, "whenRevealed", source.id, 0, false, [record], built.ctx, steps);
  const done = settle(pushed, built.ctx, steps);
  return { state: done, steps };
}

const where = (state: ScenarioState, code: string) => {
  const card = Object.values(state.cards).find((entry) => entry.code === code);
  return card ? (card.zone === "engaged" ? `engaged:${card.controller}` : card.zone) : "none";
};
const REVEAL: Instruction[] = [{ verb: "RevealEncounter" }];

describe("Ambush (04049:A:1, dwd.ambush)", () => {
  it("04049:A:1 an enemy revealed with the keyword engages the first player when his threat reaches its engagement cost", () => {
    expect(where(run({ instructions: REVEAL, deck: ["ambusher"], threats: [30] }).state, "ambusher")).toBe("engaged:0");
  });

  it("04049:A:1 an enemy nobody can engage stays in the staging area", () => {
    expect(where(run({ instructions: REVEAL, deck: ["ambusher"], threats: [24, 24], seatCount: 2 }).state, "ambusher")).toBe("staging");
  });

  it("04049:A:1 an enemy without the keyword makes no check", () => {
    expect(where(run({ instructions: REVEAL, deck: ["plain"], threats: [40] }).state, "plain")).toBe("staging");
  });

  it("04049:A:1 the first player is checked first, then the next player in turn, and the first to engage it ends the checks", () => {
    expect(where(run({ instructions: REVEAL, deck: ["ambusher"], threats: [30, 30], seatCount: 2 }).state, "ambusher")).toBe("engaged:0");
    expect(where(run({ instructions: REVEAL, deck: ["ambusher"], threats: [20, 30], seatCount: 2 }).state, "ambusher")).toBe("engaged:1");
    expect(where(run({ instructions: REVEAL, deck: ["ambusher"], threats: [30, 30], seatCount: 2, firstPlayer: 1 }).state, "ambusher")).toBe("engaged:1");
  });

  it("04049:A:1 an enemy returned from the encounter discard pile makes its checks", () => {
    const orc = enemy("orc", { keywords: { ambush: true }, engagementCost: 25, traits: ["Orc"] });
    const record: Effect = { id: "source:whenRevealed:1", cardCode: "source", lines: ["source:A:1"], timing: "whenRevealed", instructions: [{ verb: "ReturnFromDiscard", trait: "Orc" }] };
    const built = table({ cards: [hero("a"), SOURCE, orc], effects: [record], heroes: [{ code: "a" }], hand: [{ code: "source" }] });
    let state: ScenarioState = spawn(built.state, "orc", { zone: "encounterDiscard" }).state;
    state = withThreat(state, 0, 30);
    const source = Object.values(state.cards).find((card) => card.code === "source")!;
    const steps: EngineStep[] = [];
    const done = settle(pushCardEffects({ ...state, phase: "Quest", window: null }, "whenRevealed", source.id, 0, false, [record], built.ctx, steps), built.ctx, steps);
    expect(where(done, "orc")).toBe("engaged:0");
    expect(steps.some((step) => step.kind === "engage")).toBe(true);
  });

  it("04045:A:1 ignore ambush: no check is made while the table holds ignoreAmbush", () => {
    expect(where(run({ instructions: REVEAL, deck: ["ambusher"], threats: [30], flags: [{ instanceId: "table", stat: "ignoreAmbush", amount: 1 }] }).state, "ambusher")).toBe("staging");
  });

  it("901406:A:2 a seat holding engagementThreat counts it in the ambush check", () => {
    const flags = [{ instanceId: "seat:0", stat: "engagementThreat", amount: 20 }];
    expect(where(run({ instructions: REVEAL, deck: ["ambusher"], threats: [10], flags }).state, "ambusher")).toBe("engaged:0");
    expect(where(run({ instructions: REVEAL, deck: ["ambusher"], threats: [4], flags }).state, "ambusher")).toBe("staging");
  });
});

describe("DiscardTopEncounter (901405:A:2)", () => {
  const DISCARD: Instruction[] = [{ verb: "DiscardTopEncounter", ambushCheck: true }];

  it("901405:A:2 the actor discards the top card and an ambush enemy engages him from the discard pile when his threat reaches its cost", () => {
    const { state } = run({ instructions: DISCARD, deck: ["ambusher", "mist"], threats: [30] });
    expect(where(state, "ambusher")).toBe("engaged:0");
  });

  it("901405:A:2 an ambush enemy he cannot engage stays in the discard pile, and an enemy without ambush too", () => {
    expect(where(run({ instructions: DISCARD, deck: ["ambusher"], threats: [10] }).state, "ambusher")).toBe("encounterDiscard");
    expect(where(run({ instructions: DISCARD, deck: ["plain"], threats: [40] }).state, "plain")).toBe("encounterDiscard");
  });

  it("901405:A:2 an empty deck is refilled from the discard pile first", () => {
    const { state } = run({ instructions: DISCARD, discard: ["mist"], threats: [30] });
    expect(where(state, "mist")).toBe("encounterDiscard");
    expect(state.encounterDeck).toHaveLength(0);
  });

  it("901405:A:2 each player's own check: only the player whose card it is engages", () => {
    const each: Instruction[] = [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardTopEncounter", ambushCheck: true }] }];
    const { state } = run({ instructions: each, deck: ["plain", "ambusher"], threats: [30, 30], seatCount: 2 });
    expect(where(state, "plain")).toBe("encounterDiscard");
    expect(where(state, "ambusher")).toBe("engaged:1");
  });
});

describe("RevealEnemies (901402:A:1)", () => {
  it("901402:A:1 each enemy discarded is revealed in the order discarded, into the staging area, and ambush makes its checks", () => {
    const { state } = run({ instructions: [{ verb: "DiscardUntilEnemies", perPlayer: 2, to: "reveal" }], deck: ["plain", "mist", "ambusher", "mist", "mist"], threats: [30] });
    expect(where(state, "plain")).toBe("staging");
    expect(where(state, "ambusher")).toBe("engaged:0");
    expect(where(state, "mist")).toBe("encounterDiscard");
  });
});
