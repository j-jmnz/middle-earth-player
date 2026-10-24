import { printedKeywordsSchema, type PrintedKeywords } from "./boundary.ts";

// One cards row as the rules read it. The catalog stores snake_case columns. Callers map them.
export type CatalogCardRow = {
  code: string;
  name: string;
  typeCode: string;
  sphereCode: string | null;
  traits: string | null;
  isUnique: boolean;
  cost: string | null;
  threat: number | null;
  willpower: number | null;
  attack: number | null;
  defense: number | null;
  health: number | null;
  quest: number | null;
  victory: number | null;
  engagementCost: number | null;
  // Null when the card's keywords have not been read.
  keywords: PrintedKeywords | null;
};

export function parseKeywords(raw: unknown): PrintedKeywords | null {
  if (raw == null) return null;
  const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  return printedKeywordsSchema.parse(value);
}
