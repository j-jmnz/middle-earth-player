// A crowded Fellowship or Mirkwood table for the layout tests (layout.test.ts): staging with a guarded pair and a card carrying two attachments, an engagement
// area of six enemies with shadow cards and fighters, a play area that wraps, a long hand. Built from plain card instances, so the same file runs against an older layout.
import type { CardInstance } from "../../rules/core/state.ts";

import type { LayoutViews, PileViews } from "./layout.ts";
import { PILES, TABLE_ZONES, type PileView, type ZoneEntry, type ZoneId, type ZoneView } from "../store/selectors.ts";

const card = (id: string, zone: CardInstance["zone"], extra: Partial<CardInstance> = {}): CardInstance => ({
  id,
  code: `c${id}`,
  zone,
  exhausted: false,
  damage: 0,
  progress: 0,
  resources: 0,
  host: null,
  attachments: [],
  committed: false,
  shadowId: null,
  face: "up",
  controller: 0,
  enteredPlay: 0,
  ...extra,
});
const entry = (c: CardInstance, extra: Partial<ZoneEntry> = {}): ZoneEntry => ({ card: c, attached: [], paired: [], fight: null, ...extra });
const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, at) => `${prefix}${at}`);

/** The crowded table: six groups in staging (one card with two attachments, one guarded pair), five enemies engaged, nine cards in play, `hand` cards in hand. */
export function crowdedTable(hand = 7): { views: LayoutViews; piles: PileViews } {
  const staging: ZoneEntry[] = [
    entry(card("s0", "staging"), { attached: [card("sa0", "staging", { host: "s0" }), card("sa1", "staging", { host: "s0" })] }),
    ...ids("s", 9).slice(1, 3).map((id) => entry(card(id, "staging"))),
    entry(card("o", "staging")),
    entry(card("g", "staging", { guard: true, host: "o" })),
    ...ids("t", 2).map((id) => entry(card(id, "staging"))),
  ];
  const zones: Record<ZoneId, readonly ZoneEntry[]> = {
    questStage: [entry(card("q", "questStage"))],
    staging,
    activeLocation: [entry(card("l", "activeLocation"))],
    secondActiveLocation: [],
    engaged: [
      entry(card("e0", "engaged"), { attached: [card("sh0", "shadow", { face: "down" }), card("sh1", "shadow", { face: "down" })], paired: [card("p0", "play"), card("p1", "play")], fight: "defense" }),
      entry(card("e1", "engaged"), { attached: [card("sh2", "shadow", { face: "up" })] }),
      ...ids("e", 5).slice(2).map((id) => entry(card(id, "engaged"))),
    ],
    play: ids("p", 9).map((id, at) => entry(card(id, "play", { exhausted: at === 1, committed: at === 2 }), at === 3 ? { attached: [card(`a${id}`, "play")] } : {})),
    hand: ids("h", hand).map((id) => entry(card(id, "hand"))),
  };
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, { zone, seat: 0, entries: zones[zone] } satisfies ZoneView])) as unknown as LayoutViews;
  const piles = Object.fromEntries(PILES.map((pile) => [pile, { pile, seat: 0, ids: ["x"], top: null } satisfies PileView])) as unknown as PileViews;
  return { views, piles };
}

// The canvases of a phone (844 x 390) and two tablets, where every row keeps 44 pt steps; a row that cannot folds, by design (docs/design-system-table.md, Spacing and the play area's rows).
export const CROWDED_CANVASES = [
  { width: 591, height: 338 },
  { width: 760, height: 700 },
  { width: 980, height: 920 },
] as const;
export const CROWDED_SCALES = [0.875, 1, 1.15] as const;

/** A layout's slots as the baseline file holds them: the position and size of each, rounded to a hundredth. */
export function slotRows(slots: readonly { id: string; zone: string; kind: string; x: number; y: number; w: number; h: number }[]): string[] {
  return slots.map((slot) => [slot.id, slot.zone, slot.kind, ...[slot.x, slot.y, slot.w, slot.h].map((value) => Math.round(value * 100) / 100)].join(" "));
}
