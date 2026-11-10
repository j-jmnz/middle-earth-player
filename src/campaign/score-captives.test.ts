// Rules: rr.scoring (data/rules/entries.json); ledger line 143070:B:3. A Captive of The Uruk-hai is a surviving hero once the players win: the damage on it counts in the score.
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../rules/core/state.ts";
import { captivesOf } from "../rules/families/captives/values.ts";
import { probeTable } from "../../scripts/card-smoke/encounter.ts";
import { encounterWorld, type EncounterWorld } from "../../scripts/card-smoke/encounter-world.ts";
import { rescueCaptives } from "../rules/families/captives/index.ts";
import { scoreParts } from "./score.ts";

let world: EncounterWorld;
let table: ScenarioState;

beforeAll(async () => {
  world = await encounterWorld("the-uruk-hai");
  table = probeTable(world);
});

describe("the score of a game with a Captive", () => {
  it("counts the damage on the Captive as on a surviving hero", () => {
    const [captive] = captivesOf(table);
    const before = scoreParts(table, world.contexts.strong.cards).damage;
    const hurt = updateCard(table, captive?.id ?? "", { damage: 2 });
    expect(scoreParts(hurt, world.contexts.strong.cards).damage).toBe(before + 2);
  });

  it("counts the same damage once the Captive is rescued: it is among its owner's heroes then (143070:B:3)", () => {
    const [captive] = captivesOf(table);
    const hurt = updateCard(table, captive?.id ?? "", { damage: 2 });
    const rescued = rescueCaptives(hurt);
    expect(captivesOf(rescued)).toHaveLength(0);
    expect(scoreParts(rescued, world.contexts.strong.cards).damage).toBe(scoreParts(hurt, world.contexts.strong.cards).damage);
  });
});
