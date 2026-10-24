import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

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

  writeFileSync(path.join(dataDir, "raw", "ringsdb", "packs.json"), JSON.stringify(PACKS));
  mkdirSync(path.join(dataDir, "campaigns"), { recursive: true });
  writeFileSync(path.join(dataDir, "campaigns", "index.json"), JSON.stringify([{ id: "fellowship-of-the-ring", name: "Fellowship of the Ring", scenarioCount: 6, playable: true }]));
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
    campaignKind: null,
    burdenSet: null,
    backType: "player",
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
  return { ...dirs, cards: CARDS, ...extra };
}

describe("buildCatalog", () => {
  it("writes the rows from data/cards and leaves the version unchanged on a repeat", () => {
    const dirs = workspace();
    const first = buildCatalog(options(dirs));
    expect(first).toMatchObject({ packCount: 3, cardCount: 4 });
    expect(Number.isInteger(first.version)).toBe(true);
    expect(readFileSync(dirs.versionPath, "utf8")).toBe(`export const CATALOG_VERSION = ${first.version};\n`);

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

    expect(buildCatalog(options(dirs)).version).toBe(first.version);
  });

  it("gives the same version for the same data and a different one when a row changes", () => {
    const dirs = workspace();
    const first = buildCatalog(options(dirs)).version;
    const other = workspace();
    expect(buildCatalog(options(other)).version).toBe(first);
    const renamed = [card({ name: "Renamed Synthetic Hero" }), ...CARDS.slice(1)];
    const changed = buildCatalog(options(dirs, { cards: renamed })).version;
    expect(changed).not.toBe(first);
    expect(readFileSync(dirs.versionPath, "utf8")).toBe(`export const CATALOG_VERSION = ${changed};\n`);
  });

  it("keeps the exports beside CATALOG_VERSION when the number changes", () => {
    const dirs = workspace();
    const tail = "\nexport function shouldReplaceCatalog(bundled: number, applied: number | null): boolean {\n  return applied === null || bundled !== applied;\n}\n";
    writeFileSync(dirs.versionPath, `export const CATALOG_VERSION = 1;${tail}`);
    const { version } = buildCatalog(options(dirs));
    expect(readFileSync(dirs.versionPath, "utf8")).toBe(`export const CATALOG_VERSION = ${version};${tail}`);
  });

  it("holds only cards, packs, campaigns and meta", () => {
    const dirs = workspace();
    buildCatalog(options(dirs));
    const tables = openDb(dirs.dbPath).prepare("select name from sqlite_master where type = 'table' order by name").all().map((row) => String(row.name));
    expect(tables).toEqual(["campaigns", "cards", "meta", "packs"]);
    expect(existsSync(dirs.dbPath)).toBe(true);
  });
});
