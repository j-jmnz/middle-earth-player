import { deckRulesOf } from "../catalog/deck-rules";
import { deckSaveRefusal, formatDeckRefusal, type DeckSaveCard, type DeckSaveRefusal } from "../catalog/deck-save";
import { EFFECTS } from "../effects";

// What the deck screens say about a deck: whether it is ready to play, its counts, and its cards grouped by type. A deck
// saves at any stage (user decision, 2026-10-25); the deckbuilding rules decide whether it is ready, and the briefing does
// not offer a deck that is not.

export type DeckFace = DeckSaveCard & {
  code: string;
  typeName: string;
  sphereName: string | null;
  imagesrc: string | null;
  threat: number | null;
};

export type DeckContent = {
  name: string;
  heroes: readonly string[];
  cards: readonly { code: string; count: number }[];
};

export const DECK_MINIMUM = 50;

export function deckCardCount(cards: DeckContent["cards"]): number {
  return cards.reduce((sum, card) => sum + card.count, 0);
}

/** The first rule the deck breaks (rr.deckbuilding), or null when it is ready to play. The name is not a rule. */
export function deckRefusal(deck: DeckContent, faces: ReadonlyMap<string, DeckSaveCard>): DeckSaveRefusal | null {
  // The rules of the deck's contract, if it has one (a contract prints deckbuilding rules on its side A).
  return deckSaveRefusal(deck.heroes, deck.cards, faces, [], deckRulesOf(EFFECTS, deck.cards.map((card) => card.code)));
}

export type DeckReadiness = { ready: true; text: string } | { ready: false; text: string };

/** One sentence for the list, the editor and the briefing. A short deck says how many cards it still needs. */
export function deckReadiness(deck: DeckContent, faces: ReadonlyMap<string, DeckSaveCard>): DeckReadiness {
  const refusal = deckRefusal(deck, faces);
  if (!refusal) return { ready: true, text: "Ready to play" };
  // "At least 50 cards." (100 with A Perilous Voyage): a contract is no deck card, so it is not counted.
  const short = /^At least (\d+) cards\.$/.exec(refusal.rule);
  if (short) {
    const missing = Number(short[1]) - deckCardCount(deck.cards.filter((card) => faces.get(card.code)?.typeCode !== "contract"));
    return { ready: false, text: `Needs ${missing} more ${missing === 1 ? "card" : "cards"}` };
  }
  if (refusal.rule === "At least one hero.") return { ready: false, text: "Needs a hero" };
  return { ready: false, text: formatDeckRefusal(refusal) };
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "3 heroes · 47 of 50 cards". */
export function deckCountLine(deck: Pick<DeckContent, "heroes" | "cards">): string {
  const total = deckCardCount(deck.cards);
  const cards = total < DECK_MINIMUM ? `${total} of ${DECK_MINIMUM} cards` : plural(total, "card", "cards");
  return `${plural(deck.heroes.length, "hero", "heroes")} · ${cards}`;
}

/** "2 heroes and 4 cards": what a deck holds, for a sentence. */
export function deckContentsPhrase(deck: Pick<DeckContent, "heroes" | "cards">): string {
  return `${plural(deck.heroes.length, "hero", "heroes")} and ${plural(deckCardCount(deck.cards), "card", "cards")}`;
}

/** The heroes' printed threat added up: the starting threat before any campaign penalty (rr.initial-threat-level). */
export function startingThreat(heroes: readonly string[], faces: ReadonlyMap<string, Pick<DeckFace, "threat">>): number | null {
  if (heroes.length === 0) return null;
  let total = 0;
  for (const code of heroes) {
    const threat = faces.get(code)?.threat;
    if (threat == null) return null;
    total += threat;
  }
  return total;
}

const TYPE_ORDER = ["ally", "attachment", "event", "contract", "player-side-quest", "treasure"];
const TYPE_TITLE: Readonly<Record<string, string>> = {
  ally: "Allies",
  attachment: "Attachments",
  event: "Events",
  contract: "Contracts",
  "player-side-quest": "Side quests",
  treasure: "Treasures",
};

export type DeckSectionRow<TCard> =
  | { kind: "type"; key: string; type: string; title: string; count: number }
  | { kind: "card"; key: string; card: TCard }
  | { kind: "empty"; key: string; type: string; title: string };

// The groups every deck shows, empty or not: the deck editor's subsections after Heroes.
const ALWAYS_SHOWN = ["ally", "attachment", "event"];

/**
 * The deck's cards under one heading per type (Allies · 18), each group by name. Allies, attachments and events always
 * have a heading, with an empty row when the deck has none; another type shows when the deck holds one. A card the
 * catalog lacks goes last.
 */
export function deckSections<TCard extends { code: string; count: number; name: string; typeCode: string | null }>(
  cards: readonly TCard[],
): DeckSectionRow<TCard>[] {
  const groups = new Map<string, TCard[]>(ALWAYS_SHOWN.map((type) => [type, []]));
  for (const card of cards) {
    const type = card.typeCode ?? "other";
    const group = groups.get(type) ?? [];
    group.push(card);
    groups.set(type, group);
  }
  const rank = (type: string) => {
    const at = TYPE_ORDER.indexOf(type);
    return at < 0 ? TYPE_ORDER.length : at;
  };
  const rows: DeckSectionRow<TCard>[] = [];
  for (const type of [...groups.keys()].sort((left, right) => rank(left) - rank(right) || left.localeCompare(right))) {
    const group = (groups.get(type) ?? []).sort((left, right) => left.name.localeCompare(right.name) || left.code.localeCompare(right.code));
    const title = TYPE_TITLE[type] ?? "Other cards";
    rows.push({ kind: "type", key: `type-${type}`, type, title, count: deckCardCount(group) });
    if (group.length === 0) rows.push({ kind: "empty", key: `empty-${type}`, type, title });
    for (const card of group) rows.push({ kind: "card", key: card.code, card });
  }
  return rows;
}

function unusedName(base: string, taken: Iterable<string>): string {
  const names = new Set([...taken].map((name) => name.trim().toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} ${n}`;
    if (!names.has(candidate.toLowerCase())) return candidate;
  }
}

/** "New deck", or "New deck 2" when that name is taken. */
export function newDeckName(taken: Iterable<string>): string {
  return unusedName("New deck", taken);
}

/** "Stealth and Steadfastness copy", numbered when that is taken too. */
export function copyDeckName(name: string, taken: Iterable<string>): string {
  return unusedName(`${name.trim()} copy`, taken);
}

/** The name a deck is saved under: what was typed, or a fresh New deck name when the field was left empty. */
export function savedDeckName(typed: string, taken: Iterable<string>): string {
  const name = typed.trim();
  return name.length > 0 ? name : newDeckName(taken);
}
