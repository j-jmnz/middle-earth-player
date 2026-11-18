import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { AUTHORED_EFFECTS as RIVENDELL } from "../../../effects/authored/dwarrowdelf/road-to-rivendell.ts";
import { AUTHORED_EFFECTS as NIGHTMARE } from "../../../effects/authored/nightmare/road-to-rivendell.ts";
import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, withThreat } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { enemy, hero, table, treachery } from "../defense/table.ts";
import { makeActiveIn } from "../south/locations.ts";

// Rules: dwd.ambush, rr.surge, rr.reveal (data/rules/entries.json); ledger lines 04043:A:1, 901408:A:1.
// Goblin Gate's marker gives the round's first enemy revealed from the encounter deck ambush, and its Forced line makes that enemy attack when it engages; Concealed Woods' marker gives surge to the round's first enemy with ambush. The round's first reveal counts
// whether or not the location was active then (Reading 11 of The Weather Hills); a card found by a search, returned from the discard pile or revealed by an effect that names it does not.

const SOURCE = treachery("source");
const GATE = definePrinted({ code: "04043", name: "Goblin Gate", type: "location", threat: 5, questPoints: 8 });
const WOODS = definePrinted({ code: "901408", name: "Concealed Woods", type: "location", threat: 4, questPoints: 4 });
const AMBUSHER = enemy("ambusher", { keywords: { ambush: true }, engagementCost: 25 });
const PLAIN = enemy("plain", { engagementCost: 25 });
const EXPENSIVE = enemy("far", { engagementCost: 45 });
const GATE_RECORDS = RIVENDELL.filter((effect) => effect.cardCode === "04043");
const WOODS_RECORDS = NIGHTMARE.filter((effect) => effect.cardCode === "901408");

type Build = { instructions: Instruction[]; deck: readonly string[]; discard?: readonly string[]; place?: "04043" | "901408"; active?: boolean; threat?: number };

function run(spec: Build) {
  const record: Effect = { id: "source:whenRevealed:1", cardCode: "source", lines: ["source:A:1"], timing: "whenRevealed", instructions: spec.instructions };
  const built = table({ cards: [hero("a"), SOURCE, GATE, WOODS, AMBUSHER, PLAIN, EXPENSIVE, treachery("mist")], effects: [record, ...GATE_RECORDS, ...WOODS_RECORDS], heroes: [{ code: "a" }], hand: [{ code: "source" }] });
  let state: ScenarioState = built.state;
  if (spec.place) {
    const placed = spawn(state, spec.place, { zone: spec.active === false ? "encounterDiscard" : "staging" });
    state = spec.active === false ? placed.state : makeActiveIn(placed.state, placed.id);
  }
  for (const code of spec.deck) state = spawn(state, code, { zone: "encounterDeck" }).state;
  for (const code of spec.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  state = withThreat(state, 0, spec.threat ?? 30);
  const source = Object.values(state.cards).find((card) => card.code === "source")!;
  const steps: EngineStep[] = [];
  const pushed = pushCardEffects({ ...state, phase: "Quest", window: null }, "whenRevealed", source.id, 0, false, [record], built.ctx, steps);
  return { state: settle(pushed, built.ctx, steps), steps };
}

const find = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code);
const REVEAL: Instruction[] = [{ verb: "RevealEncounter" }];

describe("Goblin Gate's first enemy (04043:A:1)", () => {
  it("04043:A:1 the first enemy revealed from the encounter deck gains ambush for the round while the Gate is active, and engages the first player", () => {
    const { state } = run({ instructions: REVEAL, deck: ["plain", "plain"], place: "04043" });
    const first = Object.values(state.cards).find((card) => card.code === "plain" && flagged(state, card.id, "gainsAmbush"));
    expect(first).toBeDefined();
    expect(first?.zone).toBe("engaged");
    expect(Object.values(state.cards).filter((card) => flagged(state, card.id, "gainsAmbush"))).toHaveLength(1);
  });

  it("04043:A:1 the enemy that engages makes an immediate attack", () => {
    const { state } = run({ instructions: REVEAL, deck: ["plain", "mist"], place: "04043" });
    const first = Object.values(state.cards).find((card) => flagged(state, card.id, "gainsAmbush"));
    expect(first).toBeDefined();
    expect(state.pendingAttack?.enemyId).toBe(first?.id);
  });

  it("04043:A:1 an enemy the first player cannot engage keeps the ambush and stays in the staging area, with no attack", () => {
    const { state } = run({ instructions: REVEAL, deck: ["far", "mist"], place: "04043", threat: 30 });
    expect(find(state, "far")?.zone).toBe("staging");
    expect(flagged(state, find(state, "far")!.id, "gainsAmbush")).toBe(true);
    expect(state.pendingAttack).toBeNull();
  });

  it("04043:A:1 nothing is given while the Gate is not the active location (it lies in the discard pile)", () => {
    const { state } = run({ instructions: REVEAL, deck: ["plain", "plain"], place: "04043", active: false });
    expect(Object.values(state.cards).some((card) => flagged(state, card.id, "gainsAmbush"))).toBe(false);
    expect(Object.values(state.cards).filter((card) => card.code === "plain" && card.zone === "staging").length).toBeGreaterThan(0);
  });

  it("04043:A:1 an enemy returned from the discard pile is not a reveal from the encounter deck", () => {
    const orc = enemy("orc", { engagementCost: 25, traits: ["Orc"] });
    const record: Effect = { id: "source:whenRevealed:1", cardCode: "source", lines: ["source:A:1"], timing: "whenRevealed", instructions: [{ verb: "ReturnFromDiscard", trait: "Orc" }] };
    const built = table({ cards: [hero("a"), SOURCE, GATE, orc], effects: [record, ...GATE_RECORDS], heroes: [{ code: "a" }], hand: [{ code: "source" }] });
    const placed = spawn(built.state, "04043", { zone: "staging" });
    let state = makeActiveIn(placed.state, placed.id);
    state = spawn(state, "orc", { zone: "encounterDiscard" }).state;
    const source = Object.values(state.cards).find((card) => card.code === "source")!;
    const steps: EngineStep[] = [];
    const done = settle(pushCardEffects({ ...state, phase: "Quest", window: null }, "whenRevealed", source.id, 0, false, [record], built.ctx, steps), built.ctx, steps);
    expect(find(done, "orc")?.zone).toBe("staging");
    expect(flagged(done, find(done, "orc")!.id, "gainsAmbush")).toBe(false);
  });
});

describe("Concealed Woods' surge (901408:A:1)", () => {
  const revealed = (state: ScenarioState) => Object.values(state.cards).filter((card) => card.zone !== "encounterDeck" && card.zone !== "hand" && card.zone !== "heroes" && card.zone !== "activeLocation").length;

  it("901408:A:1 the first enemy with ambush revealed while the Woods is active gains surge: one more card is revealed", () => {
    const deck = ["ambusher", "far", "far", "far", "far"];
    const withWoods = run({ instructions: REVEAL, deck, place: "901408", threat: 10 }).state;
    const without = run({ instructions: REVEAL, deck, threat: 10 }).state;
    expect(revealed(withWoods)).toBe(revealed(without) + 1);
  });

  it("901408:A:1 an enemy without ambush does not use it up and does not gain surge", () => {
    const deck = ["far", "far", "far", "far", "far"];
    const withWoods = run({ instructions: REVEAL, deck, place: "901408", threat: 10 }).state;
    const without = run({ instructions: REVEAL, deck, threat: 10 }).state;
    expect(revealed(withWoods)).toBe(revealed(without));
  });
});
