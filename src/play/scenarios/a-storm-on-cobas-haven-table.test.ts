// Rules: rr.guarded, dcce.ship-objectives, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 12134:A:2, 12129:A:2, 12125:A:3. What the table says about A Storm on Cobas Haven's own cards: a tower the
// players control, an objective guarded by a Ship enemy, the Ship enemy Belfalas Islet holds out of play, and the Skirmisher as a Ship objective. The engine decided each; nothing here changes one.
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { moveCard, spawn } from "../../rules/core/zones.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";
import { CODES, havenTable, loadHavenWorld, type HavenWorld } from "../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";
import { first } from "../../../test/harness/scene-kit.ts";

import { dungeonDetail, standInText } from "../cards/dungeon-preview.ts";

let world: HavenWorld;

beforeAll(async () => {
  world = await loadHavenWorld();
});

describe("the table's words for A Storm on Cobas Haven", () => {
  it("says a tower is guarded by its Ship enemy, and that a freed tower is controlled by the players", () => {
    const made = havenTable(world, { staging: [CODES.seaWardTower, CODES.towerOfTheGull, CODES.siegeShip] });
    const name = (id: string) => made.ctx.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id;
    const tower = first(made.state, CODES.seaWardTower);
    const gull = first(made.state, CODES.towerOfTheGull);
    // The Siege Ship guards the Sea-ward Tower; the Tower of the Gull is free of encounters and claimed by the players.
    const ship = first(made.state, CODES.siegeShip);
    let state: ScenarioState = updateCard(made.state, ship, { guard: true, host: tower });
    state = updateCard(state, tower, { attachments: [ship] });
    state = updateCard(state, gull, { claimed: true });
    expect(dungeonDetail(state, made.ctx, tower, name)).toBe("Guarded by Siege Ship");
    expect(dungeonDetail(state, made.ctx, gull, name)).toBe("Free of encounters: the players control it");
    expect(dungeonDetail(made.state, made.ctx, gull, name)).toBeNull();
  });

  it("names the Ship enemy Belfalas Islet holds out of play on the Islet's card, and says nothing of a location that holds none", () => {
    const made = havenTable(world, { staging: [CODES.corsairWarship] });
    const name = (id: string) => made.ctx.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id;
    const spawned = spawn(made.state, CODES.belfalasIslet, { zone: "activeLocation" });
    const islet = spawned.id;
    expect(dungeonDetail(spawned.state, made.ctx, islet, name)).toBeNull();
    const enemy = first(spawned.state, CODES.corsairWarship);
    const held = moveCard(spawned.state, enemy, { zone: "under", locationId: islet });
    const state = { ...held, sea: { heading: "Sun" as const, headingCard: null, routes: {}, held: { [enemy]: { zone: "staging" as const, seat: null } } } };
    expect(dungeonDetail(state, made.ctx, islet, name)).toBe("Corsair Warship is held underneath, out of play, while this is the active location");
  });

  it("gives the Skirmisher taken as a Ship objective a preview text of its own", () => {
    const text = standInText(world.cards, "12125~ship");
    expect(text).toMatch(/^Ship objective now, taken from the Corsair fleet\. Willpower 3, Attack 4, Defense 4, 6 hit points\.$/);
    expect(standInText(world.cards, CODES.corsairSkirmisher)).toBeNull();
  });
});
