// The shapes the Cards tab's Scenario and Campaign views and the card-group route share (docs/design-system.md, Card groups): one card as a
// grid cell shows it, and the cards of a group sorted under their type's heading. Pure.

/** The catalog columns the group rows read (groups/cache.ts): the non-player kinds and the Messenger of the King heroes. */
export type GroupRow = {
  code: string;
  name: string;
  typeCode: string;
  typeName: string;
  packCode: string;
  packCodes: readonly string[];
  position: number;
  encounterSet: string | null;
  quantity: number;
  easyQuantity: number | null;
  campaignKind: string | null;
  burdenSet: string | null;
  campaignId: string | null;
  imagesrc: string | null;
};

/** One card of a group: the copies a box holds and, in the encounter deck's types, the copies Easy Mode keeps when that is fewer. */
export type GroupCard = {
  code: string;
  name: string;
  typeCode: string;
  imagesrc: string | null;
  copies: number;
  /** Copies kept in Easy Mode, only where it differs from `copies`. */
  easy: number | null;
  /** A line under the name where `data/` says where the card comes from ("From Journey up the Anduin"). */
  note?: string;
};

export type TypeGroup = { id: string; title: string; cards: readonly GroupCard[] };

// The types whose copies the Easy Mode sheet thins out: the encounter deck's. A quest card, a setup card and a campaign card are not.
const EASY_TYPES: ReadonlySet<string> = new Set(["enemy", "location", "treachery", "objective", "encounter-side-quest", "ship-enemy", "ship-objective"]);

export function groupCard(row: GroupRow, note?: string): GroupCard {
  const easy = EASY_TYPES.has(row.typeCode) && row.campaignKind == null && row.easyQuantity != null && row.easyQuantity !== row.quantity ? row.easyQuantity : null;
  return { code: row.code, name: row.name, typeCode: row.typeCode, imagesrc: row.imagesrc, copies: row.quantity, easy, ...(note ? { note } : {}) };
}

/** The badge on a card: "×3", "×3 · Easy ×1", "×2 · Not in Easy"; null for a single copy that Easy keeps. */
export function copyBadge(card: Pick<GroupCard, "copies" | "easy">): string | null {
  const copies = card.copies > 1 ? `×${card.copies}` : null;
  const easy = card.easy == null ? null : card.easy === 0 ? "Not in Easy" : `Easy ×${card.easy}`;
  return [copies, easy].filter((part) => part != null).join(" · ") || null;
}

/** What a screen reader hears for the badge: "3 copies, 1 in Easy Mode". */
export function copyWords(card: Pick<GroupCard, "copies" | "easy">): string | null {
  const copies = card.copies > 1 ? `${card.copies} copies` : null;
  const easy = card.easy == null ? null : card.easy === 0 ? "not in Easy Mode" : `${card.easy} in Easy Mode`;
  return [copies, easy].filter((part) => part != null).join(", ") || null;
}

export type TypeSpec = { id: string; title: string; types: readonly string[] };

/** The scenario's headings in the order a set reads: its quest cards first, then what the encounter deck holds. */
export const SCENARIO_TYPES: readonly TypeSpec[] = [
  { id: "quest", title: "Quest cards", types: ["quest"] },
  { id: "enemy", title: "Enemies", types: ["enemy"] },
  { id: "location", title: "Locations", types: ["location"] },
  { id: "treachery", title: "Treacheries", types: ["treachery"] },
  { id: "objective", title: "Objectives", types: ["objective"] },
  { id: "side-quest", title: "Side quests", types: ["encounter-side-quest"] },
  { id: "ship", title: "Ship cards", types: ["ship-enemy", "ship-objective"] },
  { id: "nightmare", title: "Nightmare setup", types: ["nightmare"] },
];

/** The player-card headings of a campaign's boons and burdens. */
export const PLAYER_TYPES: readonly TypeSpec[] = [
  { id: "hero", title: "Heroes", types: ["hero"] },
  { id: "ally", title: "Allies", types: ["ally"] },
  { id: "attachment", title: "Attachments", types: ["attachment"] },
  { id: "event", title: "Events", types: ["event"] },
  { id: "objective", title: "Objectives", types: ["objective"] },
];

// Cards of a type no spec names follow the named ones, one heading per type under the type's own name.
function otherTitle(row: { typeName: string }): string {
  return row.typeName.endsWith("s") ? row.typeName : `${row.typeName}s`;
}

/** The rows' cards under `specs`' headings in that order (a heading with no card is left out), each heading's cards in print order; a type no spec names gets its own heading after them. */
export function typeGroups(rows: readonly GroupRow[], specs: readonly TypeSpec[], note?: (row: GroupRow) => string | undefined): TypeGroup[] {
  const sorted = [...rows].sort((left, right) => left.position - right.position || left.code.localeCompare(right.code));
  const named = new Set(specs.flatMap((spec) => spec.types));
  const make = (id: string, title: string, members: readonly GroupRow[]): TypeGroup[] => (members.length === 0 ? [] : [{ id, title, cards: members.map((row) => groupCard(row, note?.(row)))}]);
  const known = specs.flatMap((spec) => make(spec.id, spec.title, sorted.filter((row) => spec.types.includes(row.typeCode))));
  const extra = [...new Set(sorted.filter((row) => !named.has(row.typeCode)).map((row) => row.typeCode))].flatMap((type) => {
    const members = sorted.filter((row) => row.typeCode === type);
    return make(type, otherTitle(members[0]!), members);
  });
  return [...known, ...extra];
}

/** Total copies the groups hold. */
export function copiesOf(groups: readonly TypeGroup[]): number {
  return groups.reduce((sum, group) => sum + group.cards.reduce((inner, card) => inner + card.copies, 0), 0);
}
