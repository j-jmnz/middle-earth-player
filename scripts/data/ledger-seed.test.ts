import { describe, expect, it } from "vitest";

import { loadCards } from "./load-cards.ts";
import { loadLedger, keyOf } from "./printed/ledger.ts";
import { pinnedScans, seedEntries, seedEntry, withSeeded } from "./ledger-seed.ts";

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
});
