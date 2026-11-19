// The play area's two stacked rows (docs/design-system-table.md, Spacing and the play area's rows; user request, 2026-11-19): the
// seat's heroes stand in the front row, so no ally in front covers a hero's attachments.
import { describe, expect, it } from "vitest";

import { tableLayout, type CardSlot } from "./layout.ts";
import { crowdedTable } from "./crowded-table.ts";
import type { ZoneEntry } from "../store/selectors.ts";

describe("the play area's stacked rows", () => {
  it("keeps the heroes in the front row, with their attachments peeking under it", () => {
    const { views, piles } = crowdedTable(8);
    const base = views.play.entries[0]?.card as ZoneEntry["card"];
    const at = (id: string, zone: ZoneEntry["card"]["zone"], extra: Partial<ZoneEntry["card"]> = {}) => ({ ...base, id, code: `c${id}`, zone, ...extra });
    // Three heroes, the first with an attachment, then nine allies, one exhausted: one row would squeeze under a 44 pt target.
    const play: ZoneEntry[] = Array.from({ length: 12 }, (_, n) => ({
      card: at(`p${n}`, n < 3 ? "heroes" : "play", { exhausted: n === 4 }),
      attached: n === 0 ? [at("ap0", "play", { host: "p0" })] : [],
      paired: [],
      fight: null,
    }));
    const layout = tableLayout(591, 375, { ...views, play: { zone: "play", seat: 0, entries: play } }, piles, {});
    const row = layout.slots.filter((slot) => slot.zone === "play" && slot.kind === "card");
    expect(new Set(row.map((slot) => slot.y)).size).toBe(2);
    const front = row.filter((slot) => slot.coveredFrom == null).sort((a, b) => a.x - b.x);
    expect(front.slice(0, 3).map((slot) => slot.id)).toEqual(["p0", "p1", "p2"]);
    // The hero's attachment peeks out under its host, below every card of the play area.
    const attachment = layout.slots.find((slot) => slot.id === "ap0") as CardSlot;
    expect(attachment.y + attachment.h).toBeGreaterThan(Math.max(...row.map((slot) => slot.y + slot.h)));
  });
});
