// A two-sided contract's sides as its preview shows them (user request, 2026-11-17): the card text the catalog keeps prints both sides
// under "Side A" and "Side B" headings; the preview shows each side with its own lines, side A first. A one-sided contract (Bond of
// Friendship, Council of the Wise) has no headings and shows as any card.

const HEADING = /<b>\s*Side ([AB])\s*<\/b>/g;

/** The text of each side of a contract, or null for a card that is not a two-sided contract. */
export function contractSides(type: string | null | undefined, text: string | null | undefined): { A: string; B: string } | null {
  if (type !== "contract" || !text) return null;
  const marks = [...text.matchAll(HEADING)];
  const a = marks.find((mark) => mark[1] === "A");
  const b = marks.find((mark) => mark[1] === "B");
  if (!a || !b || a.index === undefined || b.index === undefined || a.index > b.index) return null;
  const A = text.slice(a.index + a[0].length, b.index).trim();
  const B = text.slice(b.index + b[0].length).trim();
  return A && B ? { A, B } : null;
}
