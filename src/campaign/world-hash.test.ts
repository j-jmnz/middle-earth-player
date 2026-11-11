import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";

import { stampedWorld, staleReason, beginActive } from "./replay.ts";
import { loadWorld, worldHash, type World } from "./world.ts";

// What a game replays is the printed rows of its codes, its scenario and campaign data and the records of those codes
// (src/campaign/world.ts, worldHash): nothing that is not in the world moves it.
const SCENARIO = "a-shadow-of-the-past";
const HEROES = ["141001", "141002", "141003", "141004"];

const scratch = mkdtempSync(path.join(tmpdir(), "world-hash-"));
const copy = path.join(scratch, "catalog.db");
copyFileSync(temporaryCatalog(), copy);
const sqlite = new Database(copy);
const catalog = drizzle(sqlite);
const campaign = loadCampaign();
const scenario = loadScenario(SCENARIO);
const world = () => loadWorld(catalog, campaign, scenario, EFFECTS, HEROES);

describe("worldHash", () => {
  const base = world();

  it("is the same for the same world, however its maps were filled", () => {
    expect(worldHash(world())).toBe(worldHash(base));
    const reversed: World = { ...base, cards: new Map([...base.cards].reverse()), sets: new Map([...base.sets].reverse()) };
    expect(worldHash(reversed)).toBe(worldHash(base));
  });

  it("does not move for a card, a scenario or a record the game does not read", () => {
    sqlite.exec("CREATE TEMP TABLE spare AS SELECT * FROM cards WHERE code = '141001'; UPDATE spare SET code = '999991'; INSERT INTO cards SELECT * FROM spare; DROP TABLE spare;");
    expect(worldHash(world())).toBe(worldHash(base));
    const stray = { ...EFFECTS[0]!, cardCode: "999991x" };
    expect(worldHash(loadWorld(catalog, campaign, scenario, [...EFFECTS, stray], HEROES))).toBe(worldHash(base));
  });

  it("moves when one of its cards, its scenario data or one of its records changes", () => {
    const hash = worldHash(base);
    const frodo = base.cards.get("141001")!;
    expect(worldHash({ ...base, cards: new Map(base.cards).set("141001", { ...frodo, willpower: (frodo.willpower ?? 0) + 1 }) })).not.toBe(hash);
    expect(worldHash({ ...base, scenario: { ...scenario, campaignPlaced: [...scenario.campaignPlaced, "141001"] } })).not.toBe(hash);
    expect(worldHash({ ...base, campaign: { ...campaign, id: `${campaign.id}-x` } })).not.toBe(hash);
    const own = base.effects.findIndex((effect) => base.cards.has(effect.cardCode));
    expect(own).toBeGreaterThanOrEqual(0);
    const edited = base.effects.map((effect, index) => (index === own ? { ...effect, lines: [...(effect.lines ?? []), "changed"] } : effect));
    expect(worldHash({ ...base, effects: edited })).not.toBe(hash);
  });

  it("moves when a row the game loads changes in the catalog", () => {
    const hash = worldHash(base);
    sqlite.exec("UPDATE cards SET willpower = willpower + 1 WHERE code = '141001'");
    expect(worldHash(world())).not.toBe(hash);
  });
});

describe("a stamped game", () => {
  const hash = 12345;
  const start = { seed: 1 } as Parameters<typeof beginActive>[0];

  it("begins with the world it was dealt on", () => {
    expect(beginActive(start, hash)).toMatchObject({ world: hash });
    expect(staleReason(beginActive(start, hash), hash)).toBeNull();
    expect(staleReason(beginActive(start, hash), hash + 1)).toBe("dataHash");
    expect(staleReason(beginActive(start, hash), null)).toBeNull();
  });

  it("a game from before the stamp is current on its catalog version and stamped, and stale on another", () => {
    const legacy = { ...beginActive(start, hash), world: null };
    expect(staleReason(legacy, hash + 1)).toBeNull();
    expect(stampedWorld(legacy, hash)).toMatchObject({ world: hash });
    expect(staleReason({ ...legacy, dataHash: legacy.dataHash + 1 }, hash)).toBe("dataHash");
  });
});
