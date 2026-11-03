// Rules: ltp.victory-display, rr.discard-pile-and-victory-display, ltp.scoring (data/rules/entries.json). The victory display the command column draws:
// its cards newest first with the Victory they score on the side they lie, the total, and a selector that only changes when the display does.
import { beforeAll, describe, expect, it } from "vitest";

import { definePrinted, printedOf, type PrintedCard } from "../rules/printed.ts";
import { updateCard, withThreat, type ScenarioState } from "../rules/state.ts";
import { moveCard, spawn } from "../rules/zones.ts";
import { loadWorld, table, type World } from "../../scripts/past-scene.ts";

import { victoryDisplayOf, victorySelector } from "./victory-display.ts";

let world: World;
let cards: ReadonlyMap<string, PrintedCard>;

beforeAll(async () => {
  world = await loadWorld();
  cards = world.cards;
});

const nameOf = (key: string) => `name:${key}`;
const base = (): ScenarioState => withThreat(table(world, {}).state, 0, 30);

describe("victoryDisplayOf", () => {
  it("is empty with no card in the display", () => {
    expect(victoryDisplayOf(base(), cards, nameOf)).toEqual({ total: 0, rows: [] });
  });

  it("lists the cards newest first with their points, and totals their points", () => {
    const code = [...cards.values()].find((card) => (card.victory ?? 0) > 0 && card.type !== "quest")?.code ?? "";
    const points = printedOf(cards, code).victory ?? 0;
    const one = spawn(base(), code, { zone: "victory" });
    const two = spawn(one.state, code, { zone: "victory" });
    const display = victoryDisplayOf(two.state, cards, nameOf);
    expect(display.rows.map((row) => row.id)).toEqual([two.id, one.id]);
    expect(display.rows[0]).toEqual({ id: two.id, name: `name:${code}`, points });
    expect(display.total).toBe(2 * points);
  });

  it("scores the Victory printed on the side the card lies: the Stormcaller's Campaign Mode only side prints 15 where side A prints 10 (dcce.campaign-mode)", () => {
    const caller = definePrinted({ code: "stormcaller", name: "Stormcaller", type: "enemy", victory: 10, upgraded: { willpower: 0, attack: 7, defense: 6, health: 20, victory: 15 } });
    const held = new Map(cards).set(caller.code, caller);
    const made = spawn(base(), caller.code, { zone: "play", seat: 0 });
    const flipped = moveCard(updateCard(made.state, made.id, { face: "B" }), made.id, { zone: "victory" });
    const display = victoryDisplayOf(flipped, held, nameOf);
    expect(display.total).toBe(15);
    expect(display.rows[0]?.name).toBe("name:stormcaller.B");
  });
});

describe("victorySelector", () => {
  it("returns the same display while the state's victory, cards and modifiers are the same objects, and across a state that left it alone", () => {
    const code = [...cards.values()].find((card) => (card.victory ?? 0) > 0 && card.type !== "quest")?.code ?? "";
    const select = victorySelector(cards, nameOf);
    const empty = base();
    expect(select(empty)).toBe(select(empty));
    // A threat change builds a new state but leaves the display as it was.
    expect(select(withThreat(empty, 0, 31))).toBe(select(empty));
    const won = spawn(empty, code, { zone: "victory" }).state;
    const shown = select(won);
    expect(shown.rows).toHaveLength(1);
    expect(select({ ...won, round: won.round + 1 })).toBe(shown);
  });
});
