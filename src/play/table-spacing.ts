// How the table shares out the room it has left (docs/design-system.md, Table — landscape, Spacing; user request, 2026-10-29).
// layout.ts lays the rows out at their minimum gaps first; what is left between the play area and the hand is shared here between
// the gaps down the canvas, and what is left across a table of capped cards between its edges and the gap beside the left
// column. Each gap takes a share of the room and stops at a cap (a share of the card), so a tall tablet does not float its rows
// apart; what no gap can take stays where it was (under the play area, or in the rows' width). Pure numbers.

/** A gap's claim on the spare room: its share of it, and the most it grows past its minimum, in points. */
export type Claim = { share: number; cap: number };

/**
 * Splits `spare` between the gaps by their shares, none past its cap: what a capped gap cannot take goes to the others by their
 * shares. `extra` is each gap's growth in order; `left` what remains once every gap is at its cap.
 */
export function shareOut(spare: number, claims: readonly Claim[]): { extra: number[]; left: number } {
  const extra = claims.map(() => 0);
  let left = Math.max(0, spare);
  let open = claims.map((_, index) => index).filter((index) => (claims[index]?.cap ?? 0) > 0 && (claims[index]?.share ?? 0) > 0);
  // Each pass hands out what is left by share; a gap that reaches its cap leaves the pool, and the next pass shares its overflow.
  while (left > 1e-9 && open.length > 0) {
    const total = open.reduce((sum, index) => sum + (claims[index]?.share ?? 0), 0);
    let given = 0;
    const still: number[] = [];
    for (const index of open) {
      const claim = claims[index] as Claim;
      const take = Math.min((left * claim.share) / total, claim.cap - (extra[index] ?? 0));
      extra[index] = (extra[index] ?? 0) + take;
      given += take;
      if ((extra[index] ?? 0) < claim.cap - 1e-9) still.push(index);
    }
    left -= given;
    if (still.length === open.length) break;
    open = still;
  }
  return { extra, left: Math.max(0, left) };
}

// Down the canvas: the gap above staging, staging to the engagement area, the engagement area to the play area, and the play area
// to the hand. The user named the hand, the engagement area and staging, so the two gaps around the play area take the larger
// shares. Caps are shares of the card's height.
export const DOWN = {
  top: { share: 0.1, cap: 0.15 },
  stagingEngaged: { share: 0.2, cap: 0.3 },
  engagedPlay: { share: 0.35, cap: 0.4 },
  playHand: { share: 0.35, cap: 0.4 },
} as const;

// Room under this much (Medium's points, times the UI scale) is not shared: a phone's few points of slack leave its table as it was.
export const SLACK = 12;

// Across a table of capped cards: the left and right edges and the gap between the left column and the rows. Caps are shares of the
// card's width; the rest widens the rows.
export const ACROSS = {
  edge: { share: 0.25, cap: 0.25 },
  column: { share: 0.5, cap: 0.4 },
} as const;

/** The growth of each gap down the canvas, for `spare` points under the play area and a card `cardH` tall, at a UI scale. */
export function downGaps(spare: number, cardH: number, scale: number): { top: number; stagingEngaged: number; engagedPlay: number; playHand: number } {
  const order = [DOWN.top, DOWN.stagingEngaged, DOWN.engagedPlay, DOWN.playHand];
  const { extra } = shareOut(spare - SLACK * scale, order.map((claim) => ({ share: claim.share, cap: claim.cap * cardH })));
  const [top = 0, stagingEngaged = 0, engagedPlay = 0, playHand = 0] = extra;
  return { top, stagingEngaged, engagedPlay, playHand };
}

/** The growth of the left edge, the gap beside the left column and the right edge, for `spare` points across and a card `cardW` wide. */
export function acrossGaps(spare: number, cardW: number): { left: number; column: number; right: number } {
  const order = [ACROSS.edge, ACROSS.column, ACROSS.edge];
  const { extra } = shareOut(spare, order.map((claim) => ({ share: claim.share, cap: claim.cap * cardW })));
  const [left = 0, column = 0, right = 0] = extra;
  return { left, column, right };
}

/** Rows for items of these widths across `width`, one gap apart: each row takes items in order until the next would not fit. A row holds at least one item. */
export function wrapRows(widths: readonly number[], width: number, gap: number): number[][] {
  const rows: number[][] = [];
  let used = 0;
  widths.forEach((w, index) => {
    const row = rows[rows.length - 1];
    if (row && used + gap + w <= width + 1e-9) {
      row.push(index);
      used += gap + w;
      return;
    }
    rows.push([index]);
    used = w;
  });
  return rows;
}
