// Rules: mec108.captured-cards (data/rules/entries.json). The cards captured under the quest stage and an active location in Escape from Mount Gram are one counted peek where the table stacks what lies under a card.
import { describe, expect, it } from "vitest";

import type { CardInstance } from "../../rules/core/state.ts";

import { tableLayout, type LayoutViews, type PileViews } from "./layout.ts";
import { PILES, TABLE_ZONES, type PileView, type ZoneEntry, type ZoneView } from "../store/selectors.ts";

const card = (id: string, zone: CardInstance["zone"], extra: Partial<CardInstance> = {}): CardInstance => ({
  id, code: `c${id}`, zone, exhausted: false, damage: 0, progress: 0, resources: 0, host: null, attachments: [], committed: false, shadowId: null, face: "up", controller: 0, enteredPlay: 0, ...extra,
});
const entry = (c: CardInstance, extra: Partial<ZoneEntry> = {}): ZoneEntry => ({ card: c, attached: [], paired: [], fight: null, ...extra });

function table(): { views: LayoutViews; piles: PileViews } {
  const zones: Record<string, readonly ZoneEntry[]> = {
    questStage: [entry(card("stage", "questStage"))],
    staging: [entry(card("s0", "staging"))],
    activeLocation: [entry(card("loc", "activeLocation"))],
    secondActiveLocation: [],
    engaged: [],
    play: [entry(card("p0", "play"))],
    hand: [entry(card("h0", "hand"))],
  };
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, { zone, seat: 0, entries: zones[zone] ?? [] } satisfies ZoneView])) as unknown as LayoutViews;
  const piles = Object.fromEntries(PILES.map((pile) => [pile, { pile, seat: 0, ids: ["x"], top: null } satisfies PileView])) as unknown as PileViews;
  return { views, piles };
}

describe("captured cards under the quest stage and an active location", () => {
  it("shows the captured cards under an active location or the quest stage as one counted peek, short of the deck and discard piles (Escape from Mount Gram)", () => {
    const { views: v, piles } = table();
    const held = (host: string) => ["c1", "c2", "c3"].map((id) => card(`${host}${id}`, "captured", { host, face: "down", controller: null }));
    const withHeld = { ...v, activeLocation: { zone: "activeLocation", seat: 0, entries: [entry(card("loc", "activeLocation"), { attached: held("loc") })] }, questStage: { zone: "questStage", seat: 0, entries: [entry(card("stage", "questStage"), { attached: held("stage") })] } } as unknown as typeof v;
    const stacked = tableLayout(591, 338, withHeld, piles, { stacks: true });
    for (const host of ["loc", "stage"]) {
      const under = stacked.slots.filter((slot) => slot.kind === "attachment" && slot.id.startsWith(host));
      expect(under, host).toHaveLength(1);
      expect(under[0]?.stack, host).toBe(3);
    }
    // The location's one peek stays above the deck and discard piles that stand level with the play area.
    const peek = stacked.slots.find((slot) => slot.kind === "attachment" && slot.id.startsWith("loc"));
    expect((peek?.y ?? 0) + (peek?.h ?? 0)).toBeLessThanOrEqual(stacked.piles.deck.y + 0.5 + stacked.card.h);
    expect((peek?.y ?? 0) + (peek?.h ?? 0)).toBeLessThanOrEqual(stacked.zones.play.y);
    // Without stacking each card peeks, as before.
    const plain = tableLayout(591, 338, withHeld, piles, {});
    expect(plain.slots.filter((slot) => slot.kind === "attachment" && slot.id.startsWith("loc"))).toHaveLength(3);
  });

});
