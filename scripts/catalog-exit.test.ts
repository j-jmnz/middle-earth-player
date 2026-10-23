import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { buildCatalog } from "./build-catalog.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(root, "assets", "catalog.db");

describe("built catalog", () => {
  it("reads the Fellowship hero and campaign rows from the built database", async () => {
    if (!existsSync(dbPath)) await buildCatalog();

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

      expect(database.prepare("select count(*) as n from effects").get()?.n).toBe(0);
      expect(database.prepare("select count(*) as n from scenarios").get()?.n).toBe(0);
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
