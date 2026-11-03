import { describe, expect, it } from "vitest";

import { definePrinted } from "../../printed.ts";
import type { ScenarioState } from "../../state.ts";
import { moveCard, spawn } from "../../zones.ts";
import { lastPlayer } from "./players.ts";
import { routeDestination, stampRoutes } from "./routes.ts";
import { enemy, hero, seaTable, send, shipEnemy, type Table } from "./table.ts";

// Rules: dcce.stormcaller-elite, dcce.last-player (data/rules/entries.json). The Stormcaller Elite's two cards have no encounter card back, so they
// never enter the encounter deck or its discard pile: leaving play as an enemy puts the card in the victory display, as an objective ally removes it
// from the game. The last player sits directly to the right of the first player, and is the first player alone in a one-player game.

const ELITE = "The Stormcaller Elite";
const elite = (code: string) => enemy(code, { encounterSet: ELITE, health: 4, defense: 0 });
const eliteAlly = (code: string) => definePrinted({ code, name: code, type: "objective", encounterSet: ELITE, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Corsair"] });

function table(seatCount: 1 | 2 = 1): Table {
  const built = seaTable({
    seatCount,
    cards: [hero("aragorn"), hero("boromir"), elite("sahir"), eliteAlly("sahir-ally"), shipEnemy("corsair"), enemy("raider")],
    effects: [],
    heroes: seatCount === 2 ? [{ code: "aragorn" }, { code: "boromir", seat: 1 }] : [{ code: "aragorn" }],
    enemies: [{ code: "sahir" }, { code: "raider" }],
    allies: [{ code: "sahir-ally" }],
  });
  return { ...built, state: { ...built.state, mode: "combatActions", phase: "Combat", boundaryPhase: "Combat", window: { kind: "pass" }, passed: [] } };
}

// A card with this much damage on it, then any intent so the engine settles.
const wounded = (state: ScenarioState, id: string): ScenarioState => ({ ...state, cards: { ...state.cards, [id]: { ...state.cards[id]!, damage: 99 } } });

describe("the Stormcaller Elite (dcce.stormcaller-elite)", () => {
  it("adds a card that leaves play as an enemy to the victory display, not to the encounter discard pile", () => {
    const { state, ids, ctx } = table();
    const next = send(wounded(state, ids.sahir!), { type: "Pass" }, ctx);
    expect(next.cards[ids.sahir!]?.zone).toBe("victory");
    expect(next.victory).toContain(ids.sahir);
    expect(next.encounterDiscard).toEqual([]);
  });

  it("removes a card that leaves play as an objective ally from the game", () => {
    const { state, ids, ctx } = table();
    const next = send(wounded(state, ids["sahir-ally"]!), { type: "Pass" }, ctx);
    expect(next.cards[ids["sahir-ally"]!]?.zone).toBe("removed");
    expect(next.removed).toContain(ids["sahir-ally"]);
    expect(next.victory).toEqual([]);
    expect(next.encounterDiscard).toEqual([]);
  });

  it("sends an Elite card in play that would go to the encounter deck or discard pile to its own place, and keeps one out of play where it is", () => {
    const { state, ids } = table();
    for (const zone of ["encounterDiscard", "encounterDeck"] as const) {
      const moved = moveCard(state, ids.sahir!, { zone });
      expect(moved.cards[ids.sahir!]?.zone).toBe("victory");
    }
    // A card that is not in play is not "leaving play", and no card of the set can be added to the encounter deck or discard pile: the move does not happen.
    for (const code of ["sahir", "sahir-ally"]) {
      const aside = spawn(state, code, { zone: "setAside" });
      for (const zone of ["encounterDeck", "encounterDiscard"] as const) {
        expect(routeDestination(aside.state, aside.state.cards[aside.id]!, { zone })).toBeNull();
        const moved = moveCard(aside.state, aside.id, { zone });
        expect(moved.cards[aside.id]?.zone).toBe("setAside");
        expect(moved.encounterDeck).toEqual(aside.state.encounterDeck);
      }
    }
  });

  it("leaves every other enemy to the encounter discard pile, and a game with no ship or Elite card to its own state", () => {
    const { state, ids, ctx } = table();
    const moved = moveCard(state, ids.raider!, { zone: "encounterDiscard" });
    expect(moved.cards[ids.raider!]?.zone).toBe("encounterDiscard");
    const plain = stampRoutes({ ...state, sea: undefined }, new Map([["raider", enemy("raider")], ["aragorn", hero("aragorn")]]));
    expect(plain.sea).toBeUndefined();
    expect(Object.keys(stampRoutes({ ...state, sea: undefined }, ctx.cards).sea?.routes ?? {}).sort()).toEqual(["raider", "sahir", "sahir-ally"]);
  });
});

describe("the last player (dcce.last-player)", () => {
  it("is the player to the right of the first player: the other seat of two", () => {
    const { state } = table(2);
    expect(lastPlayer(state)).toBe(1);
    expect(lastPlayer({ ...state, firstPlayer: 1 })).toBe(0);
  });

  it("is the first player alone in a game with one player", () => {
    const { state } = table(1);
    expect(lastPlayer(state)).toBe(0);
    expect(state.firstPlayer).toBe(0);
  });
});
