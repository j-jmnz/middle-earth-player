import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { scenarioDefinitionSchema } from "../src/catalog/boundary.ts";
import type { Card } from "../src/catalog/card-facts.ts";
import { buildCatalog, type BuildCatalogOptions } from "./build-catalog.ts";

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases) database.close();
  databases.length = 0;
});

function openDb(dbPath: string): DatabaseSync {
  const database = new DatabaseSync(dbPath, { readOnly: true });
  databases.push(database);
  return database;
}

type Workspace = { dataDir: string; dbPath: string; versionPath: string };

const PACKS = [
  { name: "Primary", code: "A", position: 4, cycle_position: 1, available: "2020-01-01" },
  { name: "Undated", code: "U", position: 1, cycle_position: 9, available: "" },
  { name: "Black Riders", code: "TBR", position: 1, cycle_position: 41, available: "2013-09-01" },
  { name: "Unused", code: "E", position: 1, cycle_position: 4, available: "2020-01-05" },
];

function workspace(): Workspace {
  const root = mkdtempSync(path.join(tmpdir(), "catalog-build-"));
  const dataDir = path.join(root, "data");
  mkdirSync(path.join(dataDir, "raw", "ringsdb"), { recursive: true });
  mkdirSync(path.join(dataDir, "scenarios"));
  mkdirSync(path.join(dataDir, "campaigns"));
  writeFileSync(path.join(dataDir, "campaigns", "fellowship-of-the-ring.json"), JSON.stringify({ id: "fellowship-of-the-ring", name: "Fellowship of the Ring", scenarios: [], prelude: [], authored: { resolution: {} } }));
  writeFileSync(path.join(dataDir, "raw", "ringsdb", "packs.json"), JSON.stringify(PACKS));
  writeFileSync(path.join(dataDir, "sources.json"), JSON.stringify({ sources: { ringsdb: { fetchedAt: "2026-10-24T10:00:00.000Z" } } }));
  return { dataDir, dbPath: path.join(root, "catalog.db"), versionPath: path.join(root, "version.ts") };
}

function card(overrides: Partial<Card> = {}): Card {
  return {
    code: "10001",
    name: "Synthetic Hero",
    type: "hero",
    typeName: "Hero",
    sphere: "leadership",
    traits: ["Warrior"],
    isUnique: true,
    cost: null,
    deckLimit: 1,
    threat: 8,
    willpower: 1,
    attack: 2,
    defense: 1,
    health: 4,
    questPoints: null,
    victory: null,
    engagementCost: null,
    quantity: 1,
    easyQuantity: null,
    encounterSet: null,
    stage: null,
    keywords: null,
    timings: [],
    text: null,
    shadowText: null,
    hasErrata: false,
    errata: null,
    imagesrc: "/primary.png",
    deckLegal: true,
    back: null,
    printings: [{ pack: "A", number: 12 }, { pack: "U", number: 3 }, { pack: "MEC", number: 9 }],
    ...overrides,
  };
}

const CARDS: Card[] = [
  card(),
  card({ code: "10002", name: "Synthetic Ally", type: "ally", typeName: "Ally", cost: "X", hasErrata: true, errata: "", printings: [{ pack: "U", number: 1 }] }),
  card({ code: "20001", name: "Synthetic Fellowship Hero", sphere: "fellowship", printings: [{ pack: "TBR", number: 1 }], keywords: { hide: 2 } }),
  card({ code: "20002", name: "Synthetic Campaign Card", type: "treasure", typeName: "Campaign", sphere: null, deckLegal: false, printings: [{ pack: "TBR", number: 2 }] }),
];

function options(dirs: Workspace, extra: Partial<BuildCatalogOptions> = {}): BuildCatalogOptions {
  return { ...dirs, cards: CARDS, effects: [], ...extra };
}

describe("buildCatalog", () => {
  it("writes the rows from data/cards and leaves the version unchanged on a repeat", () => {
    const dirs = workspace();
    const first = buildCatalog(options(dirs));
    expect(first).toEqual({ version: 1, packCount: 3, cardCount: 4 });
    expect(readFileSync(dirs.versionPath, "utf8")).toBe("export const CATALOG_VERSION = 1;\n");

    const database = openDb(dirs.dbPath);
    const hero = database.prepare("select * from cards where code = ?").get("10001");
    expect(hero?.pack_code).toBe("A");
    // The MEC box is not a catalog pack, so it is left out of pack_codes.
    expect(JSON.parse(String(hero?.pack_codes))).toEqual(["A", "U"]);
    expect(hero?.position).toBe(12);
    expect(hero?.traits).toBe("Warrior.");
    expect(hero?.sphere_name).toBe("Leadership");
    expect(hero?.deck_legal).toBe(1);
    expect(hero?.campaign_id).toBeNull();
    expect(hero?.keywords).toBeNull();

    const ally = database.prepare("select cost, has_errata, errata from cards where code = ?").get("10002");
    expect(ally?.cost).toBe("X");
    expect(ally?.has_errata).toBe(1);
    expect(ally?.errata).toBe("");

    const fellowship = database.prepare("select deck_legal, campaign_id, keywords from cards where code = ?").get("20001");
    const campaignCard = database.prepare("select type_name, deck_legal, campaign_id from cards where code = ?").get("20002");
    expect(fellowship?.campaign_id).toBe("fellowship-of-the-ring");
    expect(JSON.parse(String(fellowship?.keywords))).toEqual({ hide: 2 });
    expect(campaignCard?.type_name).toBe("Campaign");
    expect(campaignCard?.deck_legal).toBe(0);
    expect(campaignCard?.campaign_id).toBe("fellowship-of-the-ring");

    expect(database.prepare("select available from packs where code = ?").get("U")?.available).toBe(0);
    expect(database.prepare("select available from packs where code = ?").get("A")?.available).toBe(1);
    expect(database.prepare("select code from packs where code = ?").get("E")).toBeUndefined();
    expect(database.prepare("select fetched_at from meta where pack_code = ?").get("A")?.fetched_at).toBe("2026-10-24");

    expect(buildCatalog(options(dirs)).version).toBe(1);
  });

  it("increments the catalog version when canonical rows change", () => {
    const dirs = workspace();
    expect(buildCatalog(options(dirs)).version).toBe(1);
    const renamed = [card({ name: "Renamed Synthetic Hero" }), ...CARDS.slice(1)];
    expect(buildCatalog(options(dirs, { cards: renamed })).version).toBe(2);
    expect(readFileSync(dirs.versionPath, "utf8")).toBe("export const CATALOG_VERSION = 2;\n");
  });

  it("writes effect rows, moves the version when a record changes, and refuses a repeated id", () => {
    const dirs = workspace();
    const record = { id: "x:constant:1", cardCode: "x", timing: "constant" as const, instructions: [{ verb: "Restrict" as const, what: "travel" as const }] };
    expect(buildCatalog(options(dirs, { effects: [record] })).version).toBe(1);
    const rows = openDb(dirs.dbPath).prepare("select id, record from effects").all();
    expect(rows.map((row) => row.id)).toEqual(["x:constant:1"]);
    expect(JSON.parse(String(rows[0]?.record))).toEqual(record);

    expect(buildCatalog(options(dirs, { effects: [record] })).version).toBe(1);
    const edited = { ...record, instructions: [{ verb: "Restrict" as const, what: "advance" as const }] };
    expect(buildCatalog(options(dirs, { effects: [edited] })).version).toBe(2);
    expect(() => buildCatalog(options(dirs, { effects: [edited, edited] }))).toThrow("x:constant:1 is used twice");
  });

  it("keeps the exports beside CATALOG_VERSION when the number changes", () => {
    const dirs = workspace();
    const tail = "\nexport function shouldReplaceCatalog(bundled: number, applied: number | null): boolean {\n  return applied === null || bundled > applied;\n}\n";
    writeFileSync(dirs.versionPath, `export const CATALOG_VERSION = 1;${tail}`);
    buildCatalog(options(dirs));
    expect(readFileSync(dirs.versionPath, "utf8")).toBe(`export const CATALOG_VERSION = 1;${tail}`);
    buildCatalog(options(dirs, { cards: [card({ name: "Renamed" }), ...CARDS.slice(1)] }));
    expect(readFileSync(dirs.versionPath, "utf8")).toBe(`export const CATALOG_VERSION = 2;${tail}`);
  });

  it("keeps a committed catalog version on a clean build", () => {
    const dirs = workspace();
    writeFileSync(dirs.versionPath, "export const CATALOG_VERSION = 2;\n");
    expect(buildCatalog(options(dirs)).version).toBe(2);
    expect(readFileSync(dirs.versionPath, "utf8")).toBe("export const CATALOG_VERSION = 2;\n");
    expect(existsSync(dirs.dbPath)).toBe(true);
  });

  function addScenario(dirs: Workspace, scenario: Record<string, unknown>): void {
    const file = path.join(dirs.dataDir, "campaigns", "fellowship-of-the-ring.json");
    const campaign = JSON.parse(readFileSync(file, "utf8")) as { scenarios: string[] };
    campaign.scenarios.push(String(scenario.id));
    writeFileSync(file, JSON.stringify({ ...campaign, name: "Fellowship of the Ring", prelude: [], authored: { resolution: {} } }));
    writeFileSync(path.join(dirs.dataDir, "scenarios", `${String(scenario.id)}.json`), JSON.stringify(scenario));
  }

  const scenarioBase = { name: "Scenario", number: 1, source: { dragnNormal: "Q0C.99", dragnEasy: null, hobSlug: "x" } };

  it("throws when a scenario card has no card in data/cards, and writes no database", () => {
    const dirs = workspace();
    addScenario(dirs, { ...scenarioBase, id: "gap-scenario", stages: ["999001"], encounterSets: [], cards: [{ code: "999001", easy: 1, normal: 1, pile: "quest" }] });
    expect(() => buildCatalog(options(dirs))).toThrow(/gap-scenario.*999001/);
    expect(existsSync(dirs.dbPath)).toBe(false);
  });

  it("throws when a scenario card is a nightmare card, without quoting its text", () => {
    const dirs = workspace();
    const nightmare = card({ code: "999008", name: "Synthetic Nightmare", type: "nightmare", typeName: "Nightmare", deckLegal: false, text: "NIGHTMARE_TEXT", printings: [{ pack: "A", number: 8 }] });
    addScenario(dirs, {
      ...scenarioBase,
      id: "night-scenario",
      stages: ["20001"],
      encounterSets: [],
      cards: [
        { code: "20001", easy: 1, normal: 1, pile: "quest" },
        { code: "999008", easy: 1, normal: 1, pile: "encounter" },
      ],
    });
    let message = "";
    try {
      buildCatalog(options(dirs, { cards: [...CARDS, nightmare] }));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("night-scenario");
    expect(message).toContain("999008");
    expect(message).not.toContain("NIGHTMARE_TEXT");
    expect(existsSync(dirs.dbPath)).toBe(false);
  });

  it("builds a scenario definition from the scenario data", () => {
    const dirs = workspace();
    const ford = card({ code: "999003", name: "Local Ford", type: "location", typeName: "Location", sphere: null, deckLegal: false, quantity: 2, printings: [{ pack: "TBR", number: 90 }] });
    addScenario(dirs, {
      ...scenarioBase,
      id: "local-scenario",
      stages: ["20001"],
      encounterSets: [{ name: "Hunted", count: 2 }],
      cards: [
        { code: "20001", easy: 1, normal: 1, pile: "quest" },
        { code: "999003", easy: 1, normal: 2, pile: "encounter" },
      ],
    });
    buildCatalog(options(dirs, { cards: [...CARDS, ford] }));
    const scenario = openDb(dirs.dbPath).prepare("select definition from scenarios where id = ?").get("local-scenario");
    const definition = scenarioDefinitionSchema.parse(JSON.parse(String(scenario?.definition)));
    expect(definition.encounterSets).toEqual([{ code: "Hunted", count: 2 }]);
    expect(definition.stages).toEqual([{ code: "20001" }]);
  });
});
