import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { scenarioDefinitionSchema } from "../src/catalog/boundary.ts";
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

function workspace(): { cacheDir: string; dbPath: string; versionPath: string; fixturesDir: string } {
  const root = mkdtempSync(path.join(tmpdir(), "catalog-build-"));
  const fixturesDir = path.join(root, "fixtures");
  mkdirSync(fixturesDir);
  return {
    cacheDir: path.join(root, "cache"),
    dbPath: path.join(root, "catalog.db"),
    versionPath: path.join(root, "version.ts"),
    fixturesDir,
  };
}

function heroCard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: "10001",
    name: "Synthetic Hero",
    pack_code: "A",
    type_code: "hero",
    type_name: "Hero",
    sphere_code: "leadership",
    sphere_name: "Leadership",
    position: 12,
    traits: "Warrior.",
    is_unique: true,
    threat: 8,
    willpower: 1,
    attack: 2,
    defense: 1,
    health: 4,
    deck_limit: 1,
    quantity: 1,
    has_errata: false,
    imagesrc: "/primary.png",
    ...overrides,
  };
}

function printing(
  pack: string,
  position: number,
  quantity: number,
  imagesrc: string,
  name = "Synthetic Hero",
): Record<string, unknown> {
  return heroCard({ name, pack_code: pack, position, quantity, imagesrc });
}

function fixture(heroName = "Synthetic Hero"): { packs: unknown[]; cards: Record<string, unknown[]> } {
  return {
    packs: [
      { name: "High position", code: "B", position: 9, cycle_position: 1, available: "2020-01-02" },
      { name: "Primary", code: "A", position: 4, cycle_position: 1, available: "2020-01-01" },
      { name: "Later cycle", code: "C", position: 1, cycle_position: 3, available: "2020-01-03" },
      { name: "Code tie", code: "D", position: 4, cycle_position: 1, available: "2020-01-04" },
      { name: "Empty Shell", code: "E", position: 1, cycle_position: 4, available: "2020-01-05" },
      { name: "Undated", code: "U", position: 1, cycle_position: 9, available: "" },
      { name: "Black Riders", code: "TBR", position: 1, cycle_position: 41, available: "2013-09-01" },
      { name: "ALeP - Skip", code: "FAN", position: 1, cycle_position: 0, available: "2020-01-06" },
    ],
    cards: {
      A: [printing("A", 12, 1, "/primary.png", heroName)],
      D: [printing("D", 3, 2, "/d.png", heroName)],
      B: [
        printing("B", 4, 3, "/b.png", heroName),
        {
          code: "10002",
          name: "Synthetic Ally",
          pack_code: "B",
          type_code: "ally",
          type_name: "Ally",
          sphere_code: "neutral",
          sphere_name: "Neutral",
          position: 2,
          is_unique: false,
          cost: "X",
          willpower: 1,
          attack: 1,
          defense: 0,
          health: 2,
          deck_limit: 3,
          quantity: 3,
          has_errata: true,
          text: "",
          imagesrc: "/ally.png",
        },
      ],
      C: [printing("C", 1, 4, "/c.png", heroName)],
      E: [],
      U: [
        {
          code: "10003",
          name: "Synthetic Event",
          pack_code: "U",
          type_code: "event",
          type_name: "Event",
          position: 1,
          is_unique: false,
          cost: "0",
          deck_limit: 3,
          quantity: 3,
          has_errata: false,
        },
      ],
      TBR: [
        {
          code: "20001",
          name: "Synthetic Fellowship Hero",
          pack_code: "TBR",
          type_code: "hero",
          type_name: "Hero",
          sphere_code: "fellowship",
          sphere_name: "Fellowship",
          position: 1,
          is_unique: true,
          threat: 0,
          willpower: 1,
          attack: 1,
          defense: 1,
          health: 3,
          deck_limit: 1,
          quantity: 1,
          has_errata: false,
        },
        {
          code: "20002",
          name: "Synthetic Campaign Card",
          pack_code: "TBR",
          type_code: "treasure",
          type_name: "Campaign",
          position: 2,
          is_unique: true,
          deck_limit: 1,
          quantity: 1,
          has_errata: false,
        },
      ],
    },
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(source: { packs: unknown[]; cards: Record<string, unknown[]> }, calls: string[]): typeof fetch {
  return async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    if (url.endsWith("/api/public/packs/")) return jsonResponse(source.packs);
    const match = /\/cards\/([^/]+)\.json$/.exec(url);
    const code = match?.[1];
    if (!code || !(code in source.cards)) return new Response("missing", { status: 404 });
    return jsonResponse(source.cards[code]);
  };
}

function options(
  dirs: { cacheDir: string; dbPath: string; versionPath: string; fixturesDir: string },
  fetchImpl: typeof fetch,
): BuildCatalogOptions {
  return { fetch: fetchImpl, localCards: [], effects: [], ...dirs };
}

function codes(dbPath: string): string[] {
  const database = openDb(dbPath);
  const rows = database.prepare("select code from cards order by code").all();
  return rows.map((row) => String(row.code));
}

describe("buildCatalog", () => {
  it("selects the primary printing, caches payloads, and leaves the version unchanged", async () => {
    const dirs = workspace();
    const calls: string[] = [];
    const source = fixture();
    const first = await buildCatalog(options(dirs, stubFetch(source, calls)));

    expect(first.version).toBe(1);
    expect(calls.some((url) => url.endsWith("/api/public/packs/"))).toBe(true);
    expect(calls.some((url) => url.endsWith("/cards/E.json"))).toBe(true);
    expect(calls.some((url) => url.includes("/cards/FAN.json"))).toBe(false);
    expect(readFileSync(dirs.versionPath, "utf8")).toBe("export const CATALOG_VERSION = 1;\n");

    const database = openDb(dirs.dbPath);
    const hero = database.prepare("select * from cards where code = ?").get("10001");
    expect(hero?.pack_code).toBe("A");
    expect(JSON.parse(String(hero?.pack_codes))).toEqual(["A", "D", "B", "C"]);
    expect(hero?.position).toBe(12);
    expect(hero?.quantity).toBe(1);
    expect(hero?.imagesrc).toBe("/primary.png");
    expect(hero?.deck_legal).toBe(1);
    expect(hero?.campaign_id).toBeNull();
    expect(hero?.cost).toBeNull();
    expect(hero?.errata).toBeNull();

    const ally = database.prepare("select cost, has_errata, errata from cards where code = ?").get("10002");
    expect(ally?.cost).toBe("X");
    expect(ally?.has_errata).toBe(1);
    expect(ally?.errata).toBe("");

    const fellowship = database.prepare("select deck_legal, campaign_id from cards where code = ?").get("20001");
    const campaignCard = database.prepare("select type_name, deck_legal, campaign_id from cards where code = ?").get("20002");
    expect(fellowship?.deck_legal).toBe(1);
    expect(fellowship?.campaign_id).toBe("fellowship-of-the-ring");
    expect(campaignCard?.type_name).toBe("Campaign");
    expect(campaignCard?.deck_legal).toBe(0);
    expect(campaignCard?.campaign_id).toBe("fellowship-of-the-ring");

    const undated = database.prepare("select available from packs where code = ?").get("U");
    const dated = database.prepare("select available from packs where code = ?").get("A");
    expect(undated?.available).toBe(0);
    expect(dated?.available).toBe(1);

    const packCodes = database.prepare("select code from packs").all().map((row) => String(row.code));
    expect(packCodes).not.toContain("E");
    expect(packCodes).not.toContain("FAN");
    const packNames = database.prepare("select name from packs").all().map((row) => String(row.name));
    expect(packNames.some((name) => name.startsWith("ALeP -"))).toBe(false);
    expect(database.prepare("select count(*) as n from effects").get()?.n).toBe(0);
    expect(database.prepare("select count(*) as n from scenarios").get()?.n).toBe(0);
    expect(database.prepare("select count(*) as n from meta").get()?.n).toBe(packCodes.length);

    const firstCodes = codes(dirs.dbPath);
    calls.length = 0;
    const second = await buildCatalog(options(dirs, stubFetch(source, calls)));
    expect(calls).toEqual([]);
    expect(second.version).toBe(1);
    expect(codes(dirs.dbPath)).toEqual(firstCodes);

    const manifestPath = path.join(dirs.cacheDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, string>;
    manifest["cards/A.json"] = "1999-01-01";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const third = await buildCatalog(options(dirs, stubFetch(source, calls)));
    expect(calls).toEqual([]);
    expect(third.version).toBe(1);
    const fetched = openDb(dirs.dbPath).prepare("select fetched_at from meta where pack_code = ?").get("A");
    expect(fetched?.fetched_at).toBe("1999-01-01");
  });

  it("increments the catalog version when canonical rows change", async () => {
    const dirs = workspace();
    const calls: string[] = [];
    const first = await buildCatalog(options(dirs, stubFetch(fixture(), calls)));
    expect(first.version).toBe(1);

    const nextCache = path.join(path.dirname(dirs.cacheDir), "cache-next");
    const second = await buildCatalog({
      ...options(dirs, stubFetch(fixture("Renamed Synthetic Hero"), calls)),
      cacheDir: nextCache,
    });
    expect(second.version).toBe(2);
    expect(readFileSync(dirs.versionPath, "utf8")).toBe("export const CATALOG_VERSION = 2;\n");
  });

  it("writes effect rows, moves the version when a record changes, and refuses a repeated id", async () => {
    const dirs = workspace();
    const record = { id: "x:constant:1", cardCode: "x", timing: "constant" as const, instructions: [{ verb: "Restrict" as const, what: "travel" as const }] };
    const first = await buildCatalog({ ...options(dirs, stubFetch(fixture(), [])), effects: [record] });
    expect(first.version).toBe(1);
    const rows = openDb(dirs.dbPath).prepare("select id, record from effects").all();
    expect(rows.map((row) => row.id)).toEqual(["x:constant:1"]);
    expect(JSON.parse(String(rows[0]?.record))).toEqual(record);

    const same = await buildCatalog({ ...options(dirs, stubFetch(fixture(), [])), effects: [record] });
    expect(same.version).toBe(1);
    const edited = { ...record, instructions: [{ verb: "Restrict" as const, what: "advance" as const }] };
    const changed = await buildCatalog({ ...options(dirs, stubFetch(fixture(), [])), effects: [edited] });
    expect(changed.version).toBe(2);

    await expect(buildCatalog({ ...options(dirs, stubFetch(fixture(), [])), effects: [edited, edited] })).rejects.toThrow("x:constant:1 is used twice");
  });

  it("keeps the exports beside CATALOG_VERSION when the number changes", async () => {
    const dirs = workspace();
    const tail =
      "\nexport function shouldReplaceCatalog(bundled: number, applied: number | null): boolean {\n  return applied === null || bundled > applied;\n}\n";
    mkdirSync(path.dirname(dirs.versionPath), { recursive: true });
    writeFileSync(dirs.versionPath, `export const CATALOG_VERSION = 1;${tail}`);

    await buildCatalog(options(dirs, stubFetch(fixture(), [])));
    expect(readFileSync(dirs.versionPath, "utf8")).toBe(`export const CATALOG_VERSION = 1;${tail}`);

    const nextCache = path.join(path.dirname(dirs.cacheDir), "cache-next");
    await buildCatalog({
      ...options(dirs, stubFetch(fixture("Renamed Synthetic Hero"), [])),
      cacheDir: nextCache,
    });
    expect(readFileSync(dirs.versionPath, "utf8")).toBe(`export const CATALOG_VERSION = 2;${tail}`);
  });

  it("throws when reprint files disagree on type_name and writes no database", async () => {
    const dirs = workspace();
    const card = heroCard({ code: "60001" });
    const source = {
      packs: [
        { name: "First", code: "A", position: 1, cycle_position: 1, available: "2020-01-01" },
        { name: "Second", code: "B", position: 2, cycle_position: 1, available: "2020-01-02" },
      ],
      cards: {
        A: [{ ...card, pack_code: "A", type_name: "Hero" }],
        B: [{ ...card, pack_code: "B", type_name: "Campaign" }],
      },
    };
    const building = path.join(path.dirname(dirs.dbPath), `.${path.basename(dirs.dbPath)}.building`);

    const caught = await buildCatalog(options(dirs, stubFetch(source, []))).then(
      () => null,
      (error: unknown) => error,
    );
    expect(caught).toBeInstanceOf(Error);
    if (!(caught instanceof Error)) return;
    expect(caught.message).toContain("Card 60001");
    expect(caught.message).toContain("type_name");
    expect(caught.message).not.toContain("Hero");
    expect(caught.message).not.toContain("Campaign");
    expect(existsSync(dirs.dbPath)).toBe(false);
    expect(existsSync(building)).toBe(false);
    expect(existsSync(dirs.versionPath)).toBe(false);
  });

  it("replaces a leftover building file", async () => {
    const dirs = workspace();
    const building = path.join(path.dirname(dirs.dbPath), `.${path.basename(dirs.dbPath)}.building`);
    mkdirSync(path.dirname(dirs.dbPath), { recursive: true });
    const leftover = new DatabaseSync(building);
    leftover.exec("create table packs (code text)");
    leftover.close();

    const result = await buildCatalog(options(dirs, stubFetch(fixture(), [])));
    expect(result.version).toBe(1);
    expect(existsSync(dirs.dbPath)).toBe(true);
    expect(existsSync(building)).toBe(false);
  });

  it("names a corrupt cache file without quoting its body", async () => {
    const dirs = workspace();
    await buildCatalog(options(dirs, stubFetch(fixture(), [])));
    writeFileSync(path.join(dirs.cacheDir, "cards", "TBR.json"), '{"truncated": "SENTINEL_BODY"');
    const calls: string[] = [];

    const caught = await buildCatalog(options(dirs, stubFetch(fixture(), calls))).then(
      () => null,
      (error: unknown) => error,
    );
    expect(calls).toEqual([]);
    expect(caught).toBeInstanceOf(Error);
    if (!(caught instanceof Error)) return;
    expect(caught.message).toContain("cards/TBR.json");
    expect(caught.message).not.toContain("SENTINEL_BODY");
  });

  it("throws when reprint files disagree on a rules field and writes no database", async () => {
    const dirs = workspace();
    const source = fixture();
    source.cards.A = [{ ...printing("A", 12, 1, "/primary.png"), text: "beta" }];
    source.cards.B = [{ ...printing("B", 4, 3, "/b.png"), text: "alpha" }];
    source.cards.C = [{ ...printing("C", 1, 4, "/c.png"), text: "alpha" }];
    source.cards.D = [{ ...printing("D", 3, 2, "/d.png"), text: "alpha" }];

    const caught = await buildCatalog(options(dirs, stubFetch(source, []))).then(
      () => null,
      (error: unknown) => error,
    );
    expect(caught).toBeInstanceOf(Error);
    if (!(caught instanceof Error)) return;
    expect(caught.message).toContain("Card 10001");
    expect(caught.message).toContain("text");
    expect(caught.message).not.toContain("alpha");
    expect(caught.message).not.toContain("beta");
    expect(existsSync(dirs.dbPath)).toBe(false);
    expect(existsSync(dirs.versionPath)).toBe(false);
  });

  it("names the card when the type code is unknown", async () => {
    const dirs = workspace();
    const source = fixture();
    source.cards = {
      A: [
        heroCard({
          code: "50001",
          type_code: "boon",
          type_name: "Boon",
        }),
      ],
    };
    source.packs = [{ name: "Only", code: "A", position: 1, cycle_position: 1, available: "2020-01-01" }];

    await expect(buildCatalog(options(dirs, stubFetch(source, [])))).rejects.toThrow(/Card 50001: Unknown type code "boon" \(Boon\)/);
  });

  it("names the card and issue path when a payload fails validation", async () => {
    const dirs = workspace();
    const source = fixture();
    const card = heroCard({ code: "40001", text: "SENTINEL_TEXT" });
    delete card.type_code;
    source.cards = { A: [card] };
    source.packs = [{ name: "Only", code: "A", position: 1, cycle_position: 1, available: "2020-01-01" }];

    const caught = await buildCatalog(options(dirs, stubFetch(source, []))).then(
      () => null,
      (error: unknown) => error,
    );
    expect(caught).toBeInstanceOf(Error);
    if (!(caught instanceof Error)) return;
    expect(caught.message).toContain("Card 40001");
    expect(caught.message).toContain("type_code");
    expect(caught.message).not.toContain("SENTINEL_TEXT");
  });

  it("keeps a committed catalog version on a clean build", async () => {
    const dirs = workspace();
    mkdirSync(path.dirname(dirs.versionPath), { recursive: true });
    writeFileSync(dirs.versionPath, "export const CATALOG_VERSION = 2;\n");

    const result = await buildCatalog(options(dirs, stubFetch(fixture(), [])));

    expect(result.version).toBe(2);
    expect(readFileSync(dirs.versionPath, "utf8")).toBe("export const CATALOG_VERSION = 2;\n");
    expect(existsSync(dirs.dbPath)).toBe(true);
  });

  it("throws when a fixture code has no card and no local record, and writes no database", async () => {
    const dirs = workspace();
    writeFileSync(
      path.join(dirs.fixturesDir, "gap.json"),
      JSON.stringify({
        id: "gap-scenario",
        stages: ["999001"],
        sets: [],
        cards: [{ code: "999001", easy: 1, normal: 1, pile: "quest" }],
      }),
    );

    const caught = await buildCatalog(options(dirs, stubFetch(fixture(), []))).then(
      () => null,
      (error: unknown) => error,
    );
    expect(caught).toBeInstanceOf(Error);
    if (!(caught instanceof Error)) return;
    expect(caught.message).toContain("gap-scenario");
    expect(caught.message).toContain("999001");
    expect(existsSync(dirs.dbPath)).toBe(false);
  });

  it("throws when a joined fixture card is a nightmare card", async () => {
    const dirs = workspace();
    const source = fixture();
    source.cards.A = [
      ...source.cards.A,
      {
        code: "999008",
        name: "Synthetic Nightmare",
        pack_code: "A",
        type_code: "nightmare",
        type_name: "Nightmare",
        position: 8,
        is_unique: false,
        quantity: 1,
        has_errata: false,
        text: "NIGHTMARE_TEXT",
      },
    ];
    writeFileSync(
      path.join(dirs.fixturesDir, "night.json"),
      JSON.stringify({
        id: "night-scenario",
        stages: ["20001"],
        sets: [{ name: "Hunted", cards: [{ code: "999008", easy: 1, normal: 1, pile: "encounter" }] }],
        cards: [{ code: "20001", easy: 1, normal: 1, pile: "quest" }],
      }),
    );

    const caught = await buildCatalog(options(dirs, stubFetch(source, []))).then(
      () => null,
      (error: unknown) => error,
    );
    expect(caught).toBeInstanceOf(Error);
    if (!(caught instanceof Error)) return;
    expect(caught.message).toContain("night-scenario");
    expect(caught.message).toContain("999008");
    expect(caught.message).not.toContain("NIGHTMARE_TEXT");
    expect(existsSync(dirs.dbPath)).toBe(false);
  });

  it("inserts a local record for a missing fixture code", async () => {
    const dirs = workspace();
    const localCard = {
      code: "999003",
      name: "Local Ford",
      pack_code: "TBR",
      type_code: "location",
      type_name: "Location",
      position: 90,
      traits: "River.",
      is_unique: true,
      quantity: 2,
      threat: 1,
      quest: 4,
      has_errata: false,
    };
    const unnamed = {
      code: "999085",
      name: "The One Ring",
      pack_code: "TBR",
      type_code: "objective",
      type_name: "Objective",
      position: 85,
      traits: "Artifact. Item. Ring.",
      is_unique: true,
      quantity: 1,
      has_errata: false,
    };
    writeFileSync(
      path.join(dirs.fixturesDir, "local.json"),
      JSON.stringify({
        id: "local-scenario",
        stages: ["20001"],
        sets: [{ name: "Hunted", cards: [{ code: "999003", easy: 1, normal: 2, pile: "encounter" }] }],
        cards: [{ code: "20001", easy: 1, normal: 1, pile: "quest" }],
      }),
    );

    await buildCatalog({ ...options(dirs, stubFetch(fixture(), [])), localCards: [localCard, unnamed] });
    const database = openDb(dirs.dbPath);
    const card = database.prepare("select name, quantity, deck_legal, campaign_id from cards where code = ?").get("999003");
    expect(card?.name).toBe("Local Ford");
    expect(card?.quantity).toBe(2);
    expect(card?.deck_legal).toBe(0);
    expect(card?.campaign_id).toBe("fellowship-of-the-ring");

    const ring = database
      .prepare("select name, type_code, traits, deck_legal, campaign_id from cards where code = ?")
      .get("999085");
    expect(ring?.name).toBe("The One Ring");
    expect(ring?.type_code).toBe("objective");
    expect(ring?.traits).toBe("Artifact. Item. Ring.");
    expect(ring?.deck_legal).toBe(0);
    expect(ring?.campaign_id).toBe("fellowship-of-the-ring");

    const scenario = database.prepare("select definition from scenarios where id = ?").get("local-scenario");
    const definition = scenarioDefinitionSchema.parse(JSON.parse(String(scenario?.definition)));
    expect(definition.encounterSets).toEqual([{ code: "Hunted", count: 2 }]);
    expect(definition.stages).toEqual([{ code: "20001" }]);
    expect(definition.setup).toEqual([]);
    expect(definition.widgets.hide).toBe(true);
    expect(database.prepare("select count(*) as n from effects").get()?.n).toBe(0);
  });
});
