import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { normalCopiesByCode, scenarioCards } from "../src/catalog/scenario-data.ts";
import { CATALOG_VERSION } from "../src/catalog/version.ts";
import { cardImageUrl } from "../src/screens/images/policy.ts";
import { loadScenario } from "./data/load-scenarios.ts";
import { buildCatalog } from "./build-catalog.ts";
import { temporaryCatalog } from "./temp-catalog.ts";


describe("built catalog", () => {
  it("is the catalog src/catalog/version.ts says it is", () => {
    const scratch = mkdtempSync(path.join(tmpdir(), "catalog-version-"));
    const built = buildCatalog({ dbPath: path.join(scratch, "catalog.db"), versionPath: path.join(scratch, "version.ts") });
    expect(built.version, "Run pnpm catalog:build and commit src/catalog/version.ts").toBe(CATALOG_VERSION);
  });

  it("reads the Fellowship hero and campaign rows from the built database", async () => {
    const dbPath = temporaryCatalog();

    const database = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const hero = database
        .prepare(
          `select type_code, deck_legal, sphere_code, campaign_id, has_errata,
                  errata is null as errata_is_null
           from cards where code = ?`,
        )
        .get("141001");
      expect(hero?.type_code).toBe("hero");
      expect(hero?.deck_legal).toBe(1);
      expect(hero?.sphere_code).toBe("fellowship");
      expect(hero?.campaign_id).toBe("fellowship-of-the-ring");
      expect(hero?.has_errata).toBe(0);
      expect(hero?.errata_is_null).toBe(1);

      const campaignCards = database
        .prepare(
          `select count(*) as n from cards
           where type_name = 'Campaign'
             and deck_legal = 0
             and campaign_id = 'fellowship-of-the-ring'
             and exists (
               select 1 from json_each(cards.pack_codes) where json_each.value = 'TBR'
             )`,
        )
        .get();
      expect(Number(campaignCards?.n)).toBeGreaterThan(0);

      const delay = database
        .prepare("select has_errata, errata is not null as errata_present from cards where code = ?")
        .get("141078");
      expect(delay?.has_errata).toBe(1);
      expect(delay?.errata_present).toBe(1);

      const dealt = loadScenario("a-shadow-of-the-past");
      const copies = normalCopiesByCode(dealt);
      for (const code of new Set(scenarioCards(dealt).map((card) => card.code))) {
        const row = database.prepare("select quantity from cards where code = ?").get(code);
        expect(row?.quantity).toBe(copies.get(code));
      }

      // Quest and encounter cards have no RingsDB picture; the catalog points them at their scan so the phone downloads one.
      const scenarios = ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south", "journey-in-the-dark", "breaking-of-the-fellowship"];
      const pictureless: string[] = [];
      for (const id of scenarios) {
        for (const code of new Set(scenarioCards(loadScenario(id)).map((card) => card.code))) {
          const row = database.prepare("select imagesrc from cards where code = ?").get(code);
          if (typeof row?.imagesrc !== "string" || cardImageUrl(row.imagesrc) === null) pictureless.push(`${id} ${code}`);
        }
      }
      expect(pictureless).toEqual([]);

      // Mirkwood Paths and The Dark of Mirkwood: every card their scenarios deal has a picture the phone can download, and the
      // campaigns are listed (locked until a scenario is playable).
      const mirkwood = ["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur", "the-oath", "the-caves-of-nibin-dum"];
      const missing: string[] = [];
      for (const id of mirkwood) {
        const scenario = loadScenario(id);
        for (const code of new Set([...scenarioCards(scenario).map((card) => card.code), scenario.campaignCard, ...scenario.campaignPlaced])) {
          const row = database.prepare("select imagesrc from cards where code = ?").get(code);
          if (typeof row?.imagesrc !== "string" || cardImageUrl(row.imagesrc) === null) missing.push(`${id} ${code}`);
        }
      }
      expect(missing).toEqual([]);
      expect(database.prepare("select name, scenario_count, playable from campaigns where id = ?").get("mirkwood-paths")).toMatchObject({ name: "Mirkwood Paths", scenario_count: 5, playable: 0 });
      expect(database.prepare("select name, scenario_count, playable from campaigns where id = ?").get("the-dark-of-mirkwood")).toMatchObject({ name: "The Dark of Mirkwood", scenario_count: 2, playable: 0 });
      expect(database.prepare("select imagesrc from cards where code = ?").get("141031")?.imagesrc).toBe(
        "https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/The-Fellowship-of-the-Ring/Bag-End.jpg",
      );

      const sagaRing = database
        .prepare(
          `select name, type_code, type_name, traits, deck_legal, campaign_id
           from cards where code = ?`,
        )
        .get("141085");
      expect(sagaRing?.name).toBe("The One Ring");
      expect(sagaRing?.type_code).toBe("objective");
      expect(sagaRing?.type_name).toBe("Objective");
      expect(sagaRing?.traits).toBe("Artifact. Item. Ring.");
      expect(sagaRing?.deck_legal).toBe(0);
      expect(sagaRing?.campaign_id).toBe("fellowship-of-the-ring");

      const eastRing = database.prepare("select name, type_code, deck_legal, campaign_id from cards where code = ?").get("21001");
      expect(eastRing?.name).toBe("The One Ring");
      expect(eastRing?.type_code).toBe("attachment");
      expect(eastRing?.deck_legal).toBe(1);
      expect(eastRing?.campaign_id).toBeNull();
      expect(database.prepare("select name from cards where code = ?").get("141017")?.name).toBe("Mr. Underhill");
      expect(database.prepare("select name from cards where code = ?").get("141077")?.name).toBe("Gildor Inglorion");
      expect(database.prepare("select name from cards where code = ?").get("141078")?.name).toBe("Gandalf's Delay");
      expect(database.prepare("select name from cards where code = ?").get("141079")?.name).toBe("The Ring Draws Them");
      expect(database.prepare("select name from campaigns where id = ?").get("fellowship-of-the-ring")?.name).toBe(
        "Fellowship of the Ring",
      );

      const fetched = database.prepare("select fetched_at from meta where pack_code = ?").get("TBR");
      expect(fetched?.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(database.prepare("select count(*) as n from packs where name like 'ALeP -%'").get()?.n).toBe(0);
      expect(Number(database.prepare("select count(*) as n from cards").get()?.n)).toBeGreaterThan(0);
    } finally {
      database.close();
    }
  }, 180_000);
});
