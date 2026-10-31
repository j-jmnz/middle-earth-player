// Test helper for the sea family's table (phase 39b): a game with ships, the Heading card on the Dream-chaser, ship-enemies and Corsair cards, built with
// the rules' own spawn and the sea family's table (rules/families/sea-table.ts), as seat-fixture.ts builds the two-handed one. No number in it is the table's.
import type { Effect } from "../catalog/boundary.ts";
import { definePrinted, type PrintedCard } from "../rules/printed.ts";
import { enemy, hero, navigation, seaTable, send, ship, shipEnemy } from "../rules/families/sea-table.ts";
import type { Heading } from "../rules/families/sea-types.ts";
import type { ReduceContext } from "../rules/reduce.ts";
import { updateCard, type ScenarioState } from "../rules/state.ts";
import { attachTo, spawn } from "../rules/zones.ts";

import type { LayoutViews, PileViews } from "./layout.ts";
import { PILES, pileSelector, secondPilesOf, TABLE_ZONES, zoneSelector, type ZoneFacts } from "./selectors.ts";
import { zoneFactsOf } from "./zone-facts.ts";

/** A card with a Sailing success symbol on its text box (dcce.sailing-tests). */
function wave(code: string, symbols: number): PrintedCard {
  return definePrinted({ code, name: code, type: "treachery", keywords: { sailingSuccess: symbols } });
}

export type SeaSpec = {
  seatCount?: 1 | 2;
  // The ships each seat controls, by code: "dream-chaser" first, "dawn-star" or "silver-wing" after it. A lone player takes two.
  ships?: readonly { code: "dream-chaser" | "dawn-star" | "silver-wing"; seat: number }[];
  heading?: Heading;
  // Enemies in staging (a ship-enemy when `ship`), and engaged with seat 0.
  staging?: number;
  engaged?: number;
  // The Corsair deck and its discard pile, as counts of Corsair enemies.
  corsairDeck?: number;
  corsairDiscard?: number;
  // The encounter deck, top first, as success symbols per card: [1, 0, 2] looks at three cards.
  encounter?: readonly number[];
  allies?: number;
  damage?: number;
};

export type SeaFixture = { state: ScenarioState; ctx: ReduceContext; ids: Record<string, string>; facts: ZoneFacts; cards: ReadonlyMap<string, PrintedCard> };

/** A sea table: Aragorn and Gimli, the chosen ships with the Heading card on the Dream-chaser, and the enemies and decks asked for. */
export function seaFixture(spec: SeaSpec = {}): SeaFixture {
  const seatCount = spec.seatCount ?? 1;
  const symbols = spec.encounter ?? [];
  const printed: PrintedCard[] = [
    hero("aragorn"),
    hero("gimli"),
    ship("dream-chaser", "Dream-chaser", { willpower: 5, attack: 4, defense: 4, health: 18 }),
    ship("dawn-star", "Dawn Star"),
    ship("silver-wing", "Silver Wing"),
    navigation("heading"),
    shipEnemy("galley", { engagementCost: 25 }),
    enemy("corsair", { engagementCost: 30 }),
    definePrinted({ code: "tower", name: "Tower", type: "location", questPoints: 3, threat: 2 }),
    definePrinted({ code: "friend", name: "Friend", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 3 }),
    ...Array.from(new Set(symbols)).map((count) => wave(`wave${count}`, count)),
  ];
  const ships = spec.ships ?? [{ code: "dream-chaser", seat: 0 }];
  const built = seaTable({
    seatCount,
    cards: printed,
    effects: [],
    heroes: [{ code: "aragorn", seat: 0 }, ...(seatCount > 1 ? [{ code: "gimli", seat: 1 }] : [])],
    allies: [...ships.map((row, at) => ({ code: row.code, seat: row.seat, key: `ship${at}` })), ...Array.from({ length: spec.allies ?? 0 }, (_, at) => ({ code: "friend", key: `friend${at}` }))],
    enemies: Array.from({ length: spec.engaged ?? 0 }, (_, at) => ({ code: at % 2 === 0 ? "galley" : "corsair", key: `engaged${at}` })),
    staging: Array.from({ length: spec.staging ?? 0 }, (_, at) => ({ code: at % 3 === 0 ? "galley" : at % 3 === 1 ? "corsair" : "tower", key: `staged${at}` })),
  });
  let state = built.state;
  const ids = { ...built.ids };
  // The Heading card on the Dream-chaser, once a seat has it.
  const chaser = ids["ship0"] && ships[0]?.code === "dream-chaser" ? ids["ship0"] : undefined;
  let headingCard: string | null = null;
  if (chaser && spec.heading) {
    const made = spawn(state, "heading", { zone: "play", seat: ships[0]?.seat ?? 0 });
    state = attachTo(made.state, made.id, chaser);
    headingCard = made.id;
    ids.heading = made.id;
  }
  if (state.sea) state = { ...state, sea: { ...state.sea, heading: spec.heading ?? null, headingCard } };
  if (spec.damage && chaser) state = updateCard(state, chaser, { damage: spec.damage });
  // Encounter deck: each card's success symbols decide which card it is.
  symbols.forEach((count, at) => {
    const made = spawn(state, `wave${count}`, { zone: "encounterDeck" });
    state = made.state;
    ids[`wave${at}`] = made.id;
  });
  if (spec.corsairDeck != null) {
    let deck: string[] = [];
    let discard: string[] = [];
    for (let at = 0; at < spec.corsairDeck; at += 1) {
      const made = spawn(state, "corsair", { zone: "corsairDeck" });
      state = made.state;
      deck = [...deck, made.id];
      ids[`corsairDeck${at}`] = made.id;
    }
    for (let at = 0; at < (spec.corsairDiscard ?? 0); at += 1) {
      const made = spawn(state, "corsair", { zone: "corsairDiscard" });
      state = made.state;
      discard = [...discard, made.id];
      ids[`corsairDiscard${at}`] = made.id;
    }
    state = { ...state, corsairDeck: deck, corsairDiscard: discard };
  }
  return { state, ctx: built.ctx, ids, facts: zoneFactsOf(built.ctx.cards), cards: built.ctx.cards };
}

/** The views the canvas draws for one seat of a fixture: every zone, the four piles and the Corsair pair when the game has one. */
export function seaViews(fixture: Pick<SeaFixture, "state" | "facts">, seat = 0): { views: LayoutViews; piles: PileViews } {
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, seat, fixture.facts)(fixture.state)])) as unknown as LayoutViews;
  const piles = Object.fromEntries([...PILES, ...secondPilesOf(fixture.state)].map((pile) => [pile, pileSelector(pile, seat)(fixture.state)])) as unknown as PileViews;
  return { views, piles };
}

const constant = (id: string, stat: "sailsAnyTest" | "sailingExtra", amount: number): Effect => ({ id: `dc:constant:${id}`, cardCode: "dc", lines: [`dc:A:${id}`], timing: "constant", instructions: [{ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay" }] });

/**
 * A game on a Sailing quest, parked where the first player is asked what to commit (dcce.sailing-tests): Aragorn, a Dream-chaser that can be committed and counts as 2, the heading on
 * Sun, and an encounter deck of known cards (1, 0, 2 and 0 success symbols). Built with the engine's own passes; `ids.aragorn` and `ids.dc` name the characters.
 */
export function sailingTable({ heading = "Sun", seats = 1 }: { heading?: Heading; seats?: 1 | 2 } = {}): { state: ScenarioState; ctx: ReduceContext; ids: Record<string, string> } {
  const wave = (code: string, symbols: number) => definePrinted({ code, name: code, type: "treachery", keywords: symbols > 0 ? { sailingSuccess: symbols } : {} });
  const built = seaTable({
    seatCount: seats,
    cards: [hero("aragorn"), hero("boromir"), ship("dc", "Dream-chaser"), definePrinted({ code: "qsail", name: "qsail", type: "quest", keywords: { sailing: true } }), wave("s0", 0), wave("s1", 1), wave("s2", 2)],
    effects: [constant("1", "sailsAnyTest", 1), constant("2", "sailingExtra", 1)],
    heroes: seats === 2 ? [{ code: "aragorn" }, { code: "boromir", seat: 1 }] : [{ code: "aragorn" }],
    allies: [{ code: "dc", seat: seats === 2 ? 1 : 0 }],
    encounter: ["s1", "s0", "s2", "s0"],
  });
  let state = spawn(built.state, "qsail", { zone: "questStage" }, "B").state;
  state = { ...state, sea: { heading, headingCard: null, routes: state.sea?.routes ?? {} }, phase: "Planning", mode: "planning", boundaryPhase: "Planning", window: { kind: "pass" }, planningSeat: 0, passed: [], round: 1 };
  while (state.mode === "planning") state = send(state, { type: "Pass" }, built.ctx);
  return { state, ctx: built.ctx, ids: built.ids };
}
