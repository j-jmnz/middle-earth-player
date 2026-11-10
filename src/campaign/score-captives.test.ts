// Rules: rr.scoring (data/rules/entries.json); ledger line 143070:B:3. A Captive of The Uruk-hai is a surviving hero once the players win: the damage on it counts in the score.
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard, withSeat, type ScenarioState } from "../rules/core/state.ts";
import { captivesOf } from "../rules/families/captives/values.ts";
import { probeTable } from "../../scripts/card-smoke/encounter.ts";
import { encounterWorld, type EncounterWorld } from "../../scripts/card-smoke/encounter-world.ts";
import { rescueCaptives } from "../rules/families/captives/index.ts";
import { settle } from "../rules/engine/machine.ts";
import { scoreParts } from "./score.ts";

let world: EncounterWorld;
let table: ScenarioState;

beforeAll(async () => {
  world = await encounterWorld("the-uruk-hai");
  table = probeTable(world);
});

const won = (state: ScenarioState): ScenarioState => ({ ...state, stageCleared: true });

describe("the score of a game with a Captive", () => {
  it("counts the same damage once the Captive is rescued: it is among its owner's heroes then (143070:B:3)", () => {
    const [captive] = captivesOf(table);
    const hurt = updateCard(table, captive?.id ?? "", { damage: 2 });
    const rescued = rescueCaptives(hurt);
    expect(captivesOf(rescued)).toHaveLength(0);
    expect(scoreParts(rescued, world.contexts.strong.cards).damage).toBe(scoreParts(hurt, world.contexts.strong.cards).damage + 2);
  });

  it("is the same win in a standalone game as in a campaign game: the settled win has rescued every Captive before the score reads it", () => {
    const [captive] = captivesOf(table);
    const hurt = updateCard(table, captive?.id ?? "", { damage: 2 });
    const ctx = world.contexts.strong;
    const standalone = settle(won({ ...hurt, resolution: [] }), ctx, []);
    const campaign = settle(won(hurt), ctx, []);
    for (const game of [standalone, campaign]) {
      expect(captivesOf(game)).toHaveLength(0);
      expect(game.cards[captive?.id ?? ""]).toMatchObject({ zone: "heroes", damage: 2 });
    }
    expect(scoreParts(standalone, ctx.cards)).toEqual(scoreParts(campaign, ctx.cards));
    expect(scoreParts(standalone, ctx.cards).damage).toBe(scoreParts(hurt, ctx.cards).damage + 2);
  });

  it("keeps the Captive while the game is not won, and after a loss", () => {
    const ctx = world.contexts.strong;
    expect(captivesOf(settle(table, ctx, []))).toHaveLength(captivesOf(table).length);
    expect(captivesOf(settle({ ...won(table), lost: true }, ctx, []))).toHaveLength(captivesOf(table).length);
  });

  it("scores a rescued Captive of an eliminated seat as one of its destroyed heroes, in a standalone game and a campaign game alike", () => {
    const ctx = world.contexts.strong;
    const [captive] = captivesOf(table);
    const owner = captive?.owner ?? 0;
    const out = withSeat(table, owner, { ...table.seats[owner]!, eliminated: true });
    const standalone = settle(won({ ...out, resolution: [] }), ctx, []);
    const campaign = settle(won(out), ctx, []);
    expect(scoreParts(standalone, ctx.cards)).toEqual(scoreParts(campaign, ctx.cards));
    expect(scoreParts(standalone, ctx.cards).destroyed).toBeGreaterThan(scoreParts(out, ctx.cards).destroyed);
  });
});
