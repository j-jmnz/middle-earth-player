// Rules: rr.limits, rr.damage (data/rules/entries.json); ledger lines 142041:B:2, 142041:B:3, 142043:A:1. What the table says for Journey in the Dark: the resource
// tokens on stage 2, which the players need to advance, and the damage tokens on Doom, Doom, Doom. The engine decides both; nothing here changes a card.
import { beforeAll, describe, expect, it } from "vitest";

import type { ScenarioState } from "../rules/core/state.ts";
import { tableLayout } from "./layout.ts";
import { PILES, TABLE_ZONES, pileSelector, zoneSelector, type PileId, type PileView, type ZoneId, type ZoneView } from "./selectors.ts";
import { DOOM, loadMoriaWorld, makeTable, type MoriaWorld } from "../../test/scenarios/journey-in-the-dark/scene.ts";
import { first } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";

import { campaignTokens } from "./widgets.ts";

let world: MoriaWorld;

beforeAll(async () => {
  world = await loadMoriaWorld();
}, 60_000);

const nameOf = (code: string) => world.cards.get(code)?.name ?? code;

describe("the resource tokens on stage 2 (142041:B:3)", () => {
  it("shows the number the engine wrote, named for the stage, while stage 2 is current", () => {
    const made = makeTable(world, { stage: "142041", tokens: 2 });
    expect(campaignTokens(made.state, made.ctx.effects, nameOf)).toEqual({ name: "Drums in the Deep", tokens: 2 });
    const more = makeTable(world, { stage: "142041", tokens: 5 });
    expect(campaignTokens(more.state, more.ctx.effects, nameOf)).toEqual({ name: "Drums in the Deep", tokens: 5 });
  });

  it("shows nothing on the stages that place none", () => {
    for (const stage of ["142040", "142042"] as const) {
      const made = makeTable(world, { stage });
      expect(campaignTokens(made.state, made.ctx.effects, nameOf), stage).toBeNull();
    }
  });
});

describe("the damage tokens on Doom, Doom, Doom (142043:A:1) and the resource tokens on the stage", () => {
  const views = (state: ScenarioState): Record<ZoneId, ZoneView> => Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0)(state)])) as Record<ZoneId, ZoneView>;
  const piles = (state: ScenarioState): Record<PileId, PileView> => Object.fromEntries(PILES.map((pile) => [pile, pileSelector(pile, 0)(state)])) as Record<PileId, PileView>;

  it("are drawn as tokens on their cards, as the engine holds them", () => {
    const made = makeTable(world, { stage: "142041", doom: 7, tokens: 2 });
    const layout = tableLayout(640, 340, views(made.state), piles(made.state));
    const doom = layout.slots.find((slot) => slot.id === first(made.state, DOOM));
    expect(doom?.damage).toBe(7);
    const stage = layout.slots.find((slot) => slot.id === made.state.questStage);
    expect(stage?.resources).toBe(2);
  });
});
