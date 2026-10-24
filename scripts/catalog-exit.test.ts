import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { scenarioDefinitionSchema } from "../src/catalog/boundary.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { normalCopiesByCode, scenarioCards } from "../src/catalog/scenario-data.ts";
import { buildCatalog } from "./build-catalog.ts";
import { loadScenario } from "./data/load-scenarios.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(root, "assets", "catalog.db");

describe("built catalog", () => {
  it("reads the Fellowship hero and campaign rows from the built database", async () => {
    if (!existsSync(dbPath)) buildCatalog();

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

      expect(database.prepare("select count(*) as n from effects").get()?.n).toBe(EFFECTS.length);
      expect(database.prepare("select count(*) as n from scenarios").get()?.n).toBe(1);
      const scenario = database.prepare("select id, definition from scenarios").get();
      expect(scenario?.id).toBe("a-shadow-of-the-past");
      const definition = scenarioDefinitionSchema.parse(JSON.parse(String(scenario?.definition)));
      expect(definition.id).toBe("a-shadow-of-the-past");
      expect(definition.setup).toHaveLength(5);
      // The build turned the fixture's reward names into the codes of the dealt cards.
      const named = definition.resolution.map((group) =>
        group.choices.map((choice) => String(database.prepare("select name from cards where code = ?").get(choice.code)?.name)),
      );
      expect(named).toEqual([
        ["Gandalf's Delay", "The Ring Draws Them"],
        ["Gildor Inglorion", "Mr. Underhill"],
      ]);

      const dealt = loadScenario("a-shadow-of-the-past");
      const copies = normalCopiesByCode(dealt);
      for (const code of new Set(scenarioCards(dealt).map((card) => card.code))) {
        const row = database.prepare("select quantity from cards where code = ?").get(code);
        expect(row?.quantity).toBe(copies.get(code));
      }

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
