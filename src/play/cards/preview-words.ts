// The words the card preview says for the cards shown with a card (card-preview.tsx; docs/design-system-table.md, Cards). Pure, so a test reads them.

type Said = { name: string; title?: string; detail?: string; role?: string };

/** The role of a quest stage defeated before the one shown (table-preview.ts). */
export const EARLIER_STAGE = "Earlier stage";

/** What the adjustable card announces as its value after a step: the title or name, its detail, then its place among the cards. */
export function previewValue(card: Said, at: number, count: number): string {
  return [card.title ?? card.name, ...(card.detail ? [card.detail] : []), `${at + 1} of ${count}`].join(", ");
}

/** An earlier stage as a row of the wide list reads it: "Stage 1B · Three is Company"; any other card reads its name. */
export function rowName(card: Said): string {
  return card.role === EARLIER_STAGE && card.title ? `${card.title} · ${card.name}` : card.name;
}

/** The heading over the wide list: it names the earlier stages when it holds any. */
export function listHeading(cards: readonly Said[], at: number): string {
  if (cards.some((card) => card.role === EARLIER_STAGE)) return "This stage and before";
  return at === 0 ? "With it" : "The card and what is with it";
}

/** A chip of the strip under an upright card: the name and role, an earlier stage with its place ("Stage 1B, Three is Company, Earlier stage"). */
export function chipLabel(card: Said): string {
  if (card.role === EARLIER_STAGE && card.title) return `${card.title}, ${card.name}, ${card.role}`;
  return card.role ? `${card.name}, ${card.role}` : card.name;
}
