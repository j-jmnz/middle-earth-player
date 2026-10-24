import type { CatalogCardRow } from "../catalog/card-row.ts";

import { definePrinted, type CardType, type PrintedCard, type Sphere } from "./printed.ts";

const TYPES: Readonly<Record<string, CardType>> = {
  hero: "hero",
  ally: "ally",
  attachment: "attachment",
  event: "event",
  enemy: "enemy",
  location: "location",
  treachery: "treachery",
  quest: "quest",
  objective: "objective",
  treasure: "treasure",
};

const SPHERES: Readonly<Record<string, Sphere>> = {
  leadership: "leadership",
  tactics: "tactics",
  spirit: "spirit",
  lore: "lore",
  neutral: "neutral",
  fellowship: "fellowship",
  baggins: "baggins",
};

// Maps a catalog row to the card the rules read. A type or sphere the engine does not know fails loudly.
export function printedFromRow(row: CatalogCardRow): PrintedCard {
  const type = TYPES[row.typeCode];
  if (!type) throw new Error(`Card ${row.code} ${row.name} has unsupported type ${row.typeCode}`);
  let sphere: Sphere | null = null;
  if (row.sphereCode != null) {
    sphere = SPHERES[row.sphereCode] ?? null;
    if (!sphere) throw new Error(`Card ${row.code} ${row.name} has unsupported sphere ${row.sphereCode}`);
  }
  const keywords = row.keywords ?? {};
  return definePrinted({
    code: row.code,
    name: row.name,
    type,
    traits: splitTraits(row.traits),
    sphere,
    cost: resourceCost(row.cost),
    threat: row.threat,
    willpower: row.willpower,
    attack: row.attack,
    defense: row.defense,
    health: row.health,
    questPoints: row.quest,
    victory: row.victory,
    isUnique: row.isUnique,
    engagementCost: row.engagementCost,
    leavesPlayLoses: keywords.leavesPlayLoses === true,
    keywords: {
      surge: keywords.surge === true,
      hide: keywords.hide ?? null,
      doomed: keywords.doomed ?? null,
      peril: keywords.peril === true,
      archery: keywords.archery ?? null,
      immuneToPlayerCardEffects: keywords.immune === true,
      indestructible: keywords.indestructible === true,
      toughness: keywords.toughness ?? null,
      permanent: keywords.permanent === true,
      sentinel: keywords.sentinel === true,
      ranged: keywords.ranged === true,
    },
  });
}

function splitTraits(traits: string | null): string[] {
  if (!traits) return [];
  return traits
    .split(".")
    .map((trait) => trait.trim())
    .filter((trait) => trait !== "");
}

// RingsDB prints a variable cost as "X" and a missing one as null. Neither is a number.
function resourceCost(cost: string | null): number | null {
  if (cost == null || !/^\d+$/.test(cost)) return null;
  return Number(cost);
}
