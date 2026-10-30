import { describe, expect, it } from "vitest";

import { deckLegal } from "./deck-legal.ts";

const PLAYER_TYPES = ["hero", "ally", "attachment", "event", "contract", "player-side-quest"] as const;
const NON_PLAYER_TYPES = [
  "campaign",
  "encounter",
  "quest",
  "nightmare",
  "enemy",
  "location",
  "treachery",
  "objective",
] as const;

describe("deckLegal", () => {
  it.each(PLAYER_TYPES)("%s is deck-legal", (typeCode) => {
    expect(deckLegal(typeCode, "Other")).toBe(true);
  });

  it("accepts a treasure whose type name is not Campaign", () => {
    expect(deckLegal("treasure", "Treasure")).toBe(true);
  });

  it("rejects a treasure whose type name is Campaign", () => {
    expect(deckLegal("treasure", "Campaign")).toBe(false);
  });

  it("rejects type name Campaign for any type code", () => {
    expect(deckLegal("hero", "Campaign")).toBe(false);
  });

  it.each(NON_PLAYER_TYPES)("%s is not deck-legal", (typeCode) => {
    expect(deckLegal(typeCode, "Other")).toBe(false);
  });

  it("throws on an unknown type code", () => {
    expect(() => deckLegal("boon", "Boon")).toThrow('Unknown type code "boon" (Boon)');
  });
});
