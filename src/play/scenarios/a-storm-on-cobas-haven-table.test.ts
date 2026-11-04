// Rules: rr.guarded, dcce.ship-objectives, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 12134:A:2, 12129:A:2, 12125:A:3. What the table says about A Storm on Cobas Haven's own cards: a tower the
// players control, an objective guarded by a Ship enemy, the Ship enemy Belfalas Islet holds out of play, and the Skirmisher as a Ship objective. The engine decided each; nothing here changes one.
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { moveCard, spawn } from "../../rules/core/zones.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";
import { CODES, havenTable, loadHavenWorld, type HavenWorld } from "../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";
import { first } from "../../../test/harness/scene-kit.ts";

import { slotNumbers } from "../cards/card-effects.ts";
import { controlSpeech, dungeonDetail, standInText } from "../cards/dungeon-preview.ts";

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

  it("says a tower the players control that a Ship enemy guards again is still theirs, and a screen reader hears who controls a tower (12134:A:2: control is taken once)", () => {
    const made = havenTable(world, { staging: [CODES.towerOfTheGull, CODES.siegeShip] });
    const name = (id: string) => made.ctx.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id;
    const gull = first(made.state, CODES.towerOfTheGull);
    const ship = first(made.state, CODES.siegeShip);
    let state: ScenarioState = updateCard(made.state, gull, { claimed: true });
    expect(controlSpeech(state, gull)).toBe("controlled by the players");
    expect(controlSpeech(made.state, gull)).toBeNull();
    state = updateCard(updateCard(state, ship, { guard: true, host: gull }), gull, { attachments: [ship] });
    expect(dungeonDetail(state, made.ctx, gull, name)).toBe("Guarded by Siege Ship. The players still control it.");
    expect(controlSpeech(state, gull)).toBe("controlled by the players");
    // A guarded tower the players do not control says only who guards it.
    const guarded = updateCard(state, gull, { claimed: undefined });
    expect(dungeonDetail(guarded, made.ctx, gull, name)).toBe("Guarded by Siege Ship");
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
    // The active Islet wears the night pill of the cards under The Havens Burn (UnderMarkView): "1 held", and the reader hears the enemy (12129:A:2).
    expect(slotNumbers(state, made.ctx, islet).under).toEqual({ text: "1 held", loses: false, speech: "Corsair Warship held underneath" });
    expect(slotNumbers(spawned.state, made.ctx, islet).under).toBeNull();
  });

  it("gives the Skirmisher taken as a Ship objective a preview text of its own", () => {
    const text = standInText(world.cards, "12125~ship");
    expect(text).toBe("Ship objective. Willpower 3 (its Threat), Attack 4, Defense 4, 6 hit points.");
    // Its printed lines follow, so "Immune to player card effects" still shows: the caller gives the enemy's text by code (the catalog has no row for the derived card).
    const printed = "Immune to player card effects.\nResponse: After Corsair Skirmisher is destroyed...";
    expect(standInText(world.cards, "12125~ship", (code) => (code === CODES.corsairSkirmisher ? printed : null))).toBe(`Ship objective. Willpower 3 (its Threat), Attack 4, Defense 4, 6 hit points.\n${printed}`);
    expect(standInText(world.cards, CODES.corsairSkirmisher)).toBeNull();
  });
});
