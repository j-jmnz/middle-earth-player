// Rules: dcce.sailing-tests (data/rules/entries.json). The Sailing test's look (docs/design-system-table.md, The Sailing test): the cards looked at stand face
// up in a strip laid over staging, at the table's card size. One band holds as many as its width allows a gap apart, then squeezed to 44 pt steps; past one
// band the strip uses the engagement band, then the play band; past three bands the cards overlap closer than 44 pt, and a tap in a look only previews. The strip is
// never folded (row-fold.ts). Pure.
import type { Rect } from "./layout.ts";

export type Band = { x: number; y: number; w: number };
export type Place = { x: number; y: number; w: number; h: number };

export type LookStrip = {
  // Each looked-at card's place, in the order the engine looked at them (top of the deck first), reading left to right, band by band.
  places: readonly Place[];
  // Which band holds each card (0 the staging band).
  band: readonly number[];
  // The least step between two neighbours in one band (Infinity when no band has two).
  step: number;
  // The cards overlap closer than a 44 pt target: past three bands. A tap then only previews (it always does in a look).
  crowded: boolean;
  // How many bands the strip uses, 0 to 3.
  bands: number;
};

/** The three bands the strip uses, top to bottom: staging, the engagement area, the play area, each as wide as its zone (the piles at the right stay clear). */
export function lookBands(layout: { zones: { staging: Rect; engaged: Rect; play: Rect } }): readonly Band[] {
  return [layout.zones.staging, layout.zones.engaged, layout.zones.play].map((zone) => ({ x: zone.x, y: zone.y, w: zone.w }));
}

/** How many it holds squeezed to steps of `target`: the first card whole, each next one a step on. */
export function squeezedCapacity(width: number, card: number, target: number): number {
  return Math.max(1, Math.floor((width - card) / target) + 1);
}

/**
 * The strip's places for `count` cards across `bands` (staging, engagement, play), each at `card` size. A band's cards stand a gap apart while they fit,
 * else at the even step that fits them; the cards are shared out evenly over as many bands as 44 pt steps need, and over all three, closer than 44 pt, when
 * even those do not hold them.
 */
export function lookStrip(count: number, bands: readonly Band[], card: { w: number; h: number }, gap: number, target: number): LookStrip {
  if (count <= 0 || bands.length === 0) return { places: [], band: [], step: Infinity, crowded: false, bands: 0 };
  const widest = Math.min(...bands.map((band) => band.w));
  const fit = squeezedCapacity(widest, card.w, target);
  const used = Math.min(bands.length, Math.max(1, Math.ceil(count / fit)));
  const crowded = count > fit * bands.length;
  const places: Place[] = [];
  const bandOf: number[] = [];
  let step = Infinity;
  let placed = 0;
  for (let index = 0; index < used; index += 1) {
    const band = bands[index] as Band;
    // The rest are shared evenly over the bands left, the earlier bands taking the extra one.
    const here = Math.ceil((count - placed) / (used - index));
    const natural = card.w + gap;
    const even = here > 1 ? (band.w - card.w) / (here - 1) : natural;
    const at = Math.min(natural, even);
    for (let slot = 0; slot < here; slot += 1) {
      places.push({ x: band.x + slot * at, y: band.y, w: card.w, h: card.h });
      bandOf.push(index);
    }
    if (here > 1) step = Math.min(step, at);
    placed += here;
  }
  return { places, band: bandOf, step, crowded, bands: used };
}

/** The medallion's size: a 22 pt night disc, straddling the card's foot, upright (docs/design-system-table.md). */
export const MEDALLION = 22;

/** Where the medallion stands on a placed card: centred on its foot edge. */
export function medallionAt(place: Place, scale: number): { cx: number; cy: number; r: number } {
  return { cx: place.x + place.w / 2, cy: place.y + place.h, r: (MEDALLION / 2) * scale };
}
