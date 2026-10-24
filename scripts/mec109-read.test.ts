import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { EFFECTS } from "../src/effects/index.ts";

// The 26 dealt cards for A Shadow of the Past, re-read 2026-10-24 from the Hall of Beorn pages for the MEC109
// (The Fellowship of the Ring, TFotR) printing. Numbers, keywords, traits, the unique flag, and the printed
// timings only; no card text. Confirm each row on the physical card. A mismatch here means the catalog data,
// the manifest, or the records moved away from that reading.
type Row = {
  code: string;
  name: string;
  collector: number;
  unique: boolean;
  traits?: string;
  threat?: number;
  quest?: number;
  victory?: number;
  engagement?: number;
  keywords: Record<string, unknown>;
  // Printed timings on the card (granted text on an attached card is listed with the card that grants it).
  timings: readonly string[];
};

const CARDS: readonly Row[] = [
  { code: "141017", name: "Mr. Underhill", collector: 44, unique: true, traits: "Title.", victory: 1, keywords: { permanent: true }, timings: ["setup", "action"] },
  { code: "141022", name: "Three is Company", collector: 28, unique: false, quest: 1, keywords: {}, timings: ["setup", "triggered", "constant"] },
  { code: "141023", name: "A Shortcut to Mushrooms", collector: 29, unique: false, quest: 14, keywords: {}, timings: ["whenRevealed", "triggered", "constant"] },
  { code: "141024", name: "Escape to Buckland", collector: 30, unique: false, keywords: {}, timings: ["whenRevealed", "whenRevealed", "triggered", "response"] },
  { code: "141031", name: "Bag End", collector: 31, unique: true, traits: "Shire.", threat: 0, quest: 3, victory: 1, keywords: {}, timings: ["response"] },
  { code: "141032", name: "Woody End", collector: 32, unique: true, traits: "Forest.", threat: 1, quest: 1, victory: 1, keywords: {}, timings: ["constant"] },
  { code: "141033", name: "Stock-brook", collector: 33, unique: true, traits: "Forest. Stream.", threat: 1, quest: 5, victory: 1, keywords: {}, timings: ["whenRevealed"] },
  { code: "141034", name: "Bamfurlong", collector: 34, unique: true, traits: "Shire.", threat: 2, quest: 2, victory: 1, keywords: {}, timings: ["response"] },
  { code: "141035", name: "Bucklebury Ferry", collector: 35, unique: true, traits: "River.", threat: 3, quest: 9, keywords: { immune: true }, timings: ["constant", "travel", "questResolution"] },
  { code: "141036", name: "Green Hill Country", collector: 36, unique: false, traits: "Forest.", threat: 2, quest: 3, keywords: {}, timings: ["constant", "shadow"] },
  { code: "141037", name: "Stock Road", collector: 37, unique: false, traits: "Road.", threat: 3, quest: 3, keywords: {}, timings: ["constant", "travel"] },
  { code: "141038", name: "The Marish", collector: 38, unique: false, traits: "Marshland.", threat: 3, quest: 4, keywords: {}, timings: ["forced", "shadow"] },
  { code: "141039", name: "Black Rider", collector: 39, unique: false, traits: "Nazgûl.", threat: 4, engagement: 35, keywords: { hide: 2 }, timings: ["forced", "constant"] },
  { code: "141040", name: "Evil Crow", collector: 40, unique: false, traits: "Creature.", threat: 2, engagement: 25, keywords: {}, timings: ["constant", "shadow"] },
  { code: "141041", name: "Crawling Towards Him", collector: 41, unique: false, keywords: { peril: true, hide: 2 }, timings: ["whenRevealed", "shadow"] },
  { code: "141042", name: "Hunting for the Ring", collector: 42, unique: false, keywords: { doomed: 2 }, timings: ["whenRevealed"] },
  { code: "141043", name: "Have You Seen Baggins?", collector: 43, unique: false, keywords: { peril: true, surge: true }, timings: ["whenRevealed", "forced"] },
  { code: "141072", name: "Pathless Country", collector: 171, unique: false, traits: "Forest.", threat: 2, quest: 3, keywords: {}, timings: ["constant", "shadow"] },
  { code: "141073", name: "Piercing Cry", collector: 172, unique: false, keywords: { peril: true }, timings: ["whenRevealed", "shadow"] },
  { code: "141074", name: "Black Steed", collector: 173, unique: false, traits: "Morgul.", keywords: { surge: true }, timings: ["whenRevealed", "forced", "constant"] },
  { code: "141075", name: "Rode Like a Gale", collector: 174, unique: false, keywords: {}, timings: ["whenRevealed", "shadow"] },
  { code: "141076", name: "Lure of the Ring", collector: 175, unique: false, keywords: { surge: true }, timings: ["whenRevealed", "shadow"] },
  { code: "141077", name: "Gildor Inglorion", collector: 45, unique: true, traits: "Noldor.", keywords: {}, timings: ["whenRevealed", "forced"] },
  { code: "141078", name: "Gandalf's Delay", collector: 46, unique: false, keywords: {}, timings: ["setup", "setup"] },
  { code: "141079", name: "The Ring Draws Them", collector: 47, unique: false, keywords: { surge: true }, timings: ["whenRevealed"] },
  { code: "141085", name: "The One Ring", collector: 166, unique: true, traits: "Artifact. Item. Ring.", keywords: { leavesPlayLoses: true }, timings: ["setup", "constant", "forced"] },
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(root, "fixtures", "abilities", "a-shadow-of-the-past.json"), "utf8")) as Record<string, string[]>;

// Local records carry the MEC109 collector number as their position. The RingsDB rows keep RingsDB's.
const LOCAL = new Set(CARDS.filter((card) => !["141017", "141077", "141078", "141079"].includes(card.code)).map((card) => card.code));

describe("MEC109/TFotR reading of the dealt cards", () => {
  it("covers the 26 dealt cards and the manifest lists the same codes", () => {
    expect(CARDS).toHaveLength(26);
    expect(Object.keys(manifest).sort()).toEqual(CARDS.map((card) => card.code).sort());
  });

  it("matches the catalog rows: name, unique, traits, numbers, engagement, keywords", () => {
    const database = new DatabaseSync(path.join(root, "assets", "catalog.db"), { readOnly: true });
    try {
      const statement = database.prepare(
        "select name, is_unique, traits, threat, quest, victory, engagement_cost, keywords, position from cards where code = ?",
      );
      for (const card of CARDS) {
        const row = statement.get(card.code);
        expect(row, card.code).toBeDefined();
        expect(row?.name, card.code).toBe(card.name);
        expect(row?.is_unique === 1, `${card.code} unique`).toBe(card.unique);
        expect(row?.traits ?? undefined, `${card.code} traits`).toBe(card.traits);
        expect(row?.threat ?? undefined, `${card.code} threat`).toBe(card.threat);
        expect(row?.quest ?? undefined, `${card.code} quest`).toBe(card.quest);
        expect(row?.victory ?? undefined, `${card.code} victory`).toBe(card.victory);
        expect(row?.engagement_cost ?? undefined, `${card.code} engagement`).toBe(card.engagement);
        expect(JSON.parse(String(row?.keywords ?? "null")), `${card.code} keywords`).toEqual(card.keywords);
        if (LOCAL.has(card.code)) expect(row?.position, `${card.code} collector`).toBe(card.collector);
      }
    } finally {
      database.close();
    }
  });

  it("matches the manifest's printed timings", () => {
    for (const card of CARDS) {
      expect([...(manifest[card.code] ?? [])].sort(), card.code).toEqual([...card.timings].sort());
    }
  });

  it("has at least one authored record for every printed timing, repeated where the card prints it twice", () => {
    for (const card of CARDS) {
      const wanted = new Map<string, number>();
      for (const timing of card.timings) wanted.set(timing, (wanted.get(timing) ?? 0) + 1);
      for (const [timing, count] of wanted) {
        const have = EFFECTS.filter((effect) => effect.cardCode === card.code && effect.timing === timing).length;
        expect(have, `${card.code} ${card.name} ${timing}`).toBeGreaterThanOrEqual(count);
      }
    }
  });
});
