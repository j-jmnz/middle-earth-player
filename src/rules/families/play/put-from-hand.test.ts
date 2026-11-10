// Rules: rr.the-word-choose, rr.neutral-cards, rr.play-and-put-into-play, rr.unique-cards (data/rules/entries.json); ledger line 143072:B:1. PutIntoPlayFromHand's `required` flag and the pick
// filter `heroSphere`, on a table of Helm's Deep.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";
import { encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { allyCard } from "../../../../test/harness/scene-kit.ts";

let world: EncounterWorld;
let table: ScenarioState;
let ctx: EncounterWorld["contexts"]["strong"];

beforeAll(async () => {
  world = await encounterWorld("helms-deep");
  const cards = new Map(world.contexts.strong.cards);
  cards.set("t-tactics", definePrinted({ code: "t-tactics", name: "t-tactics", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set("t-tactics2", definePrinted({ code: "t-tactics2", name: "t-tactics2", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set("t-spirit", definePrinted({ code: "t-spirit", name: "t-spirit", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set("t-neutral", allyCard("t-neutral", 1));
  ctx = { ...world.contexts.strong, cards };
  table = probeTable(world);
});

const withHand = (...codes: string[]): ScenarioState => codes.reduce((state, code) => spawn(state, code, { zone: "hand", seat: 0 }).state, table);
const FILTER = { type: "ally", control: "you", heroSphere: true } as const;
// The instruction runs in a frame of its own, as a When Revealed does, so that the choice it asks is a window.
function put(state: ScenarioState, required: boolean): ScenarioState {
  const steps: EngineStep[] = [];
  const effect: Effect = { id: "t:whenRevealed:1", cardCode: "143072", lines: [], timing: "whenRevealed", instructions: [{ verb: "PutIntoPlayFromHand", pick: FILTER, ...(required ? { required: true as const } : {}) }] };
  const pushed = pushCardEffects(state, "whenRevealed", state.questStage ?? "", 0, false, [effect], ctx, steps);
  return settle({ ...pushed, window: null, mode: "stopped" }, ctx, steps);
}

describe("143072:B:1 a hero's sphere", () => {
  it("matches an ally of the sphere of a hero the player controls, and no neutral or other-sphere ally", () => {
    const state = withHand("t-tactics", "t-spirit", "t-neutral");
    const found = pickCandidates(state, { ...FILTER, from: "hand" }, 0, [], null, ctx).map((id) => state.cards[id]?.code);
    expect(found).toEqual(["t-tactics"]);
  });

  it("with no matching ally nothing is asked and nothing enters play", () => {
    const state = withHand("t-spirit", "t-neutral");
    expect(put(state, true).window?.kind).not.toBe("choose");
    expect(Object.values(put(state, true).cards).filter((card) => card.zone === "play" && card.controller === 0).map((card) => card.code)).toEqual([]);
  });
});

describe("143072:B:1 a mandatory choice", () => {
  it("offers 'none' only when the choice is optional", () => {
    const state = withHand("t-tactics", "t-tactics2");
    const optional = put(state, false);
    const required = put(state, true);
    const optionsOf = (found: ScenarioState): readonly string[] => (found.window?.kind === "choose" ? found.window.options : []);
    expect(optionsOf(required).length).toBeGreaterThan(0);
    expect(optionsOf(optional).length).toBe(optionsOf(required).length + 1);
    expect(optionsOf(required)).not.toContain("none");
    expect(optionsOf(optional)).toContain("none");
  });
});
