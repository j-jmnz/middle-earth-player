import { describe, expect, it } from "vitest";

import { loadCards } from "./load-cards.ts";
import { loadLedger, keyOf } from "./printed/ledger.ts";
import { PLAYER_CODES, playerPackCodes, playerScopeCodes } from "./printed/scope.ts";
import { indentOf, nightmareDeckCodes, pinnedScans, seedEntries, seedEntry, withSeeded } from "./ledger-seed.ts";

// `pnpm data ledger-seed`: the entries a scenario's cards are missing, from the source text, readBy empty.
const cards = loadCards();
const ledger = loadLedger();
const pins = pinnedScans();

describe("ledger seed", () => {
  it("seeds the sides no ledger holds, with the pinned scan and no reader", () => {
    const { entries, unpinned } = seedEntries(new Set(["02011", "02012"]), { campaign: "none", entries: [], byKey: new Map() }, cards, pins);
    expect(unpinned).toEqual([]);
    expect(entries.map((entry) => keyOf(entry.code, entry.side))).toEqual(["02011.A", "02011.B", "02012.A", "02012.B"]);
    const first = entries[0];
    expect(first?.lines).toEqual(["Setup: Reveal 1 card per player from the encounter deck, and add it to the staging area."]);
    expect(first?.readBy).toBe("");
    expect(first?.scan).toEqual(pins.get("02011.A"));
  });

  it("leaves a side another ledger holds alone", () => {
    const held = ledger.entries.find((entry) => entry.code === "01013");
    expect(held).toBeDefined();
    const { entries } = seedEntries(new Set(["01013"]), ledger, cards, pins);
    expect(entries).toEqual([]);
  });

  it("splits text into one line per ability with straight apostrophes", () => {
    const card = cards.find((one) => one.code === "02014");
    const target = { code: "02014", side: "A" as const, printing: "HfG", urls: [] };
    const entry = seedEntry({ ...(card as NonNullable<typeof card>), text: "Guarded.\nResponse: it’s “here”.", shadowText: "Shadow: x." }, target, { url: "https://x.test/a.jpg", sha256: "0".repeat(64) });
    expect(entry.lines).toEqual(["Guarded.", `Response: it's "here".`, "Shadow: x."]);
  });

  it("writes a player card's tags and icons as plain words", () => {
    const card = cards.find((one) => one.code === "05009");
    const target = { code: "05009", side: "A" as const, printing: "HoN", urls: [] };
    const entry = seedEntry(card as NonNullable<typeof card>, target, { url: "https://x.test/a.jpg", sha256: "0".repeat(64) });
    expect(entry.lines).toEqual(["Restricted.", "Attach to a Tactics character. Limit 1 per character.", "Response: After attached character is declared as a defender, deal 1 damage to the attacking enemy."]);
  });

  it("puts a printed Escape value on its own line", () => {
    const card = cards.find((one) => one.code === "02108");
    const target = { code: "02108", side: "A" as const, printing: "TDM", urls: [] };
    const entry = seedEntry(card as NonNullable<typeof card>, target, { url: "https://x.test/a.jpg", sha256: "0".repeat(64) });
    expect(entry.lines).toHaveLength(2);
    expect(entry.lines[1]).toBe("Escape: 4");
  });

  it("appends to a file without rewriting what it holds", () => {
    const { entries } = seedEntries(new Set(["02011"]), { campaign: "none", entries: [], byKey: new Map() }, cards, pins);
    const once = withSeeded(null, "x", entries);
    const edited = { ...once, entries: once.entries.map((entry) => ({ ...entry, readBy: "someone" })) };
    const again = withSeeded(edited, "x", entries);
    expect(again.entries).toEqual(edited.entries);
    expect(again.conventions.length).toBeGreaterThan(0);
  });

  it("seeds a scenario's Nightmare deck from its proxy picture pins", () => {
    const codes = nightmareDeckCodes("the-hunt-for-gollum", cards);
    expect([...codes].sort()[0]).toBe("900401");
    const { entries, unpinned } = seedEntries(new Set(["900401", "900402"]), { campaign: "none", entries: [], byKey: new Map() }, cards, pinnedScans(undefined, { nightmare: true }));
    expect(unpinned).toEqual([]);
    expect(entries.map((entry) => keyOf(entry.code, entry.side))).toEqual(["900401.A", "900401.B", "900402.A"]);
    expect(entries.every((entry) => entry.printing === "Nightmare" && entry.readBy === "")).toBe(true);
  });

  it("refuses a scenario with no Nightmare deck", () => {
    expect(() => nightmareDeckCodes("the-oath", cards)).toThrow(/no Nightmare deck/);
  });

  it("names a pack's deck-legal player cards", () => {
    const codes = playerPackCodes(["OHaUH", "HoN"], cards);
    expect(codes).toHaveLength(37);
    const types = new Set(codes.map((code) => cards.find((card) => card.code === code)?.type));
    expect([...types].every((type) => ["hero", "ally", "attachment", "event", "player-side-quest", "contract"].includes(type ?? ""))).toBe(true);
    expect(playerPackCodes(["no-such-pack"], cards)).toEqual([]);
  });

  it("names single player cards beside packs and refuses another card", () => {
    expect(playerScopeCodes([], ["06107", "02033"], cards)).toEqual(["02033", "06107"]);
    expect(playerScopeCodes(["HoN"], ["06107"], cards)).toContain("06107");
    expect(() => playerScopeCodes([], ["141025"], cards)).toThrow(/Not a deck-legal player card/);
    expect(PLAYER_CODES.every((code) => playerScopeCodes([], [code], cards).length === 1)).toBe(true);
  });

  it("seeds a player card from a pinned scan into a new file with the conventions", () => {
    const fake = new Map([["05001.A", { url: "https://x.test/a.jpg", sha256: "0".repeat(64) }]]);
    const { entries, unpinned } = seedEntries(new Set(["05001", "05002"]), { campaign: "none", entries: [], byKey: new Map() }, cards, fake);
    expect(entries.map((entry) => keyOf(entry.code, entry.side))).toEqual(["05001.A"]);
    expect(unpinned).toEqual(["05002.A"]);
    expect(entries[0]?.lines[0]).toBe("Sentinel.");
    expect(entries[0]?.readBy).toBe("");
    expect(withSeeded(null, "player-cards", entries).campaign).toBe("player-cards");
  });

  it("writes a file with the indent it already has", () => {
    expect(indentOf('{\n "campaign": "x"\n}\n')).toBe(1);
    expect(indentOf('{\n  "campaign": "x"\n}\n')).toBe(2);
    expect(indentOf(null)).toBe(2);
  });
});
