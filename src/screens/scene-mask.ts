// How a page's scene fades out at its edges (GroundedScene): ramps of the picture's own alpha, so it ends in the fog behind it
// whatever the fog draws, with no colour laid over it to blend away (user report, 2026-10-30: on a tablet the black fades drew as
// black, a line under the picture and a band down the pane's edge). Pure, so a test reads it; the browser draws the ramps as a CSS
// mask, a phone as Skia gradients drawn `dstIn` over the picture.

/** One alpha ramp along an axis, `from` to `to` in the box's points; each stop is [offset 0..1 along the ramp, alpha]. Clamped past its ends. */
export type MaskRamp = { axis: "x" | "y"; from: number; to: number; stops: readonly (readonly [number, number])[] };

/**
 * The ramps for a scene drawn `band` points tall at the top of a `width` × `height` box: faded out from `fade` of the band to its
 * foot; with `edge`, faded out over the box's last `edgeWidth` points at the right; `soft`, feathered at every edge of the box.
 */
export function sceneMask({ width, height, band, fade, edge, edgeWidth, soft }: { width: number; height: number; band: number; fade: number; edge: boolean; edgeWidth: number; soft: boolean }): MaskRamp[] {
  // The foot: clear to `fade`, then falling to nothing at the band's foot, most of the way by halfway (nightFade's stops, inverted).
  const ramps: MaskRamp[] = [{ axis: "y", from: 0, to: band, stops: [[fade, 1], [(fade + 1) / 2, 0.28], [1, 0]] }];
  if (edge && width > 0) ramps.push({ axis: "x", from: Math.max(0, width - edgeWidth), to: width, stops: [[0, 1], [1, 0]] });
  if (soft) {
    ramps.push({ axis: "y", from: 0, to: height, stops: [[0, 0], [0.16, 1], [0.52, 1], [1, 0]] });
    ramps.push({ axis: "x", from: 0, to: width, stops: [[0, 0], [0.09, 1], [0.91, 1], [1, 0]] });
  }
  return ramps;
}

/** A ramp's stops as positions in the box's points, for a gradient drawn from the box's edge. */
export function rampPoints(ramp: MaskRamp): { at: number; alpha: number }[] {
  return ramp.stops.map(([offset, alpha]) => ({ at: ramp.from + offset * (ramp.to - ramp.from), alpha }));
}

/** The ramps as a CSS mask: one gradient a ramp, intersected. */
export function cssMask(ramps: readonly MaskRamp[]): string {
  return ramps.map((ramp) => `linear-gradient(${ramp.axis === "y" ? 180 : 90}deg, ${rampPoints(ramp).map(({ at, alpha }) => `rgba(0,0,0,${alpha}) ${Math.round(at * 10) / 10}px`).join(", ")})`).join(", ");
}

/**
 * CSS's `saturate(s) contrast(c) brightness(b)`, in that order, as one 4×5 colour matrix (feColorMatrix's layout and Skia's, offsets
 * in 0..1), so a phone's canvas dims a scene as ART_FILTER does in the browser.
 */
export function filterMatrix(saturate: number, contrast: number, brightness: number): number[] {
  const s = saturate;
  const rows = [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ];
  const gain = contrast * brightness;
  const offset = (0.5 - 0.5 * contrast) * brightness;
  return [...rows.flatMap((row) => [...row.map((value) => value * gain), 0, offset]), 0, 0, 0, 1, 0];
}
