// Rules: rr.deckbuilding, rr.setup (data/rules/entries.json). The Burglar's Turn (22024:A:2) chooses "14 different Item or Artifact
// attachments from your collection": the app takes them from the deck's side deck (src/catalog/loot.ts), the briefing refuses a side
// deck without them, and the start deals them as the loot deck (src/rules/families/sidequests/loot.ts).
import Database from "better-sqlite3";
import { and, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { cards } from "../catalog/schema.ts";
import { EFFECTS } from "../effects/index.ts";
import { reduce, startScenario } from "../rules/engine/reduce.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";

import { loadoutOf } from "./briefing.ts";
import { contextOf } from "./session.ts";
import { standaloneBriefing, standaloneStart, type StandaloneLoadout } from "./standalone.ts";
import { loadWorld } from "./world.ts";

const FRODO = "141001";
const HEROES = ["141002", "141003", "141004"];
const CONTRACT = "22024";
const SCENARIO = "a-shadow-of-the-past";

const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
// 17 deck-legal non-unique events, three of each: a 51-card deck with no attachment (22024:A:1).
const events = catalog
  .select({ code: cards.code })
  .from(cards)
  .where(and(eq(cards.typeCode, "event"), eq(cards.deckLegal, true), eq(cards.isUnique, false)))
  .orderBy(cards.code)
  .all()
  .slice(0, 17)
  .map((row) => row.code);
const deck = [CONTRACT, ...events.flatMap((code) => [code, code, code])];
// Item or Artifact attachments with different titles.
const loot = [
  ...new Map(
    catalog
      .select({ code: cards.code, name: cards.name })
      .from(cards)
      .where(and(eq(cards.typeCode, "attachment"), eq(cards.deckLegal, true), or(like(cards.traits, "%Item.%"), like(cards.traits, "%Artifact.%"))))
      .orderBy(cards.code)
      .all()
      .map((row) => [row.name, row.code] as const),
  ).values(),
].slice(0, 15);
const world = loadWorld(catalog, loadCampaign(), loadScenario(SCENARIO), EFFECTS, [FRODO, ...HEROES, ...deck, ...loot]);

function loadout(side: readonly string[]): StandaloneLoadout {
  return { scenarioId: SCENARIO, difficulty: "Normal", seats: [{ deckId: "deck", heroes: HEROES, deck, side: [...side] }], ringBearer: FRODO };
}

describe("The Burglar's Turn's loot deck from the side deck (22024:A:2)", () => {
  it("refuses a side deck without 14 different Item or Artifact attachments", () => {
    const briefing = standaloneBriefing({ world, seatCount: 1, seats: loadout(loot.slice(0, 13)).seats, ringBearer: FRODO, difficulty: "Normal" });
    expect(briefing.dealable).toBe(false);
    expect(briefing.problems.map((problem) => problem.message).join(" ")).toContain("14 different Item or Artifact attachments for the loot deck (it has 13)");
  });

  it("takes one copy of each title and leaves the other side deck cards out", () => {
    const side = [...loot.slice(0, 14), loot[0]!, events[0]!];
    const [seat] = loadoutOf({ world, seatCount: 1, seats: loadout(side).seats, ringBearer: FRODO });
    expect(seat?.loot).toEqual(loot.slice(0, 14));
  });

  it("still deals a loadout stored before side decks, with no loot deck", () => {
    const { side: _, ...old } = loadout([]).seats[0]!;
    const start = standaloneStart(world, 1, { ...loadout([]), seats: [old] }, 1);
    expect(start.seats[0]?.loot).toBeUndefined();
  });

  it("deals the 14 as the loot deck and flips the contract", () => {
    const start = standaloneStart(world, 1, loadout(loot.slice(0, 14)), 1);
    const ctx = contextOf(world);
    const kept = reduce(startScenario(start, ctx), { type: "Keep" }, ctx);
    expect(kept.ok).toBe(true);
    const state = kept.ok ? kept.state : null;
    const ids = state?.lootDecks?.[0] ?? [];
    expect(ids.map((id) => state?.cards[id]?.code).sort()).toEqual(loot.slice(0, 14).sort());
    expect(Object.values(state?.cards ?? {}).find((card) => card.code === CONTRACT)?.face).toBe("B");
  });
});
