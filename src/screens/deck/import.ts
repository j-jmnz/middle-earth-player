import prebuiltJson from "../../../data/decks/prebuilt.json";
import { prebuiltDecksSchema, type PrebuiltDeck } from "../../catalog/prebuilt-deck";

import { notAppliedCards } from "./status";

export type DecklistCounts = Record<string, number>;

export type DecklistBody = {
  name: string;
  heroes: DecklistCounts;
  slots: DecklistCounts;
};

export type PoolFact = {
  name: string;
  typeCode: string;
  deckLegal: boolean;
};

export type BuiltDecklist = {
  name: string;
  heroes: string[];
  cards: { code: string; count: number }[];
  droppedCodes: string[];
  heroLimit: { cardCode: string; cardName: string } | null;
};

/** What an import names on RingsDB: a published decklist, or a player's own deck (shown only while its owner shares it). */
export type RingsDbRef = { kind: "decklist" | "deck"; id: string };

/**
 * A decimal id (a decklist), a ringsdb.com decklist or deck view URL (with or without its slug), or the public decklist or
 * deck JSON URL.
 */
export function parseDecklistRef(input: string): RingsDbRef | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return { kind: "decklist", id: trimmed };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== "ringsdb.com" && url.hostname !== "www.ringsdb.com") return null;
  // The link RingsDB shows carries the slug: /decklist/view/68989/thegoodthebadandtheugly-1.0, /deck/view/4821/road.
  const view = /^\/(decklist|deck)\/view\/(\d+)(?:\/[^/]+)?\/?$/.exec(url.pathname);
  if (view?.[1] && view[2]) return { kind: view[1] === "deck" ? "deck" : "decklist", id: view[2] };
  const api = /^\/api\/public\/(decklist|deck)\/(\d+)\.json$/.exec(url.pathname);
  if (api?.[1] && api[2]) return { kind: api[1] === "deck" ? "deck" : "decklist", id: api[2] };
  return null;
}

/** The public JSON for a ref. A deck's payload has the decklist's `name`, `heroes` and `slots`. */
export function ringsDbUrl(ref: RingsDbRef): string {
  return `https://ringsdb.com/api/public/${ref.kind}/${ref.id}.json`;
}

export function cardUrl(code: string): string {
  return `https://ringsdb.com/api/public/card/${code}.json`;
}

function countRecord(value: unknown): DecklistCounts | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const counts: DecklistCounts = {};
  for (const [code, count] of Object.entries(value)) {
    if (!Number.isInteger(count) || typeof count !== "number") return null;
    counts[code] = count;
  }
  return counts;
}

/** Reads name, heroes, and slots. sideslots are ignored. */
export function readDecklistBody(payload: unknown): DecklistBody | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as { name?: unknown; heroes?: unknown; slots?: unknown };
  if (typeof record.name !== "string") return null;
  const heroes = countRecord(record.heroes ?? {});
  const slots = countRecord(record.slots ?? {});
  if (!heroes || !slots) return null;
  return { name: record.name, heroes, slots };
}

export function buildDecklist(
  body: DecklistBody,
  pool: ReadonlyMap<string, PoolFact>,
): BuiltDecklist {
  const heroes: string[] = [];
  const cards: { code: string; count: number }[] = [];
  const droppedCodes: string[] = [];
  let heroLimit: BuiltDecklist["heroLimit"] = null;
  const heroCounts = new Map<string, number>();

  function takeHero(code: string, count: number, fact: PoolFact): void {
    heroCounts.set(code, (heroCounts.get(code) ?? 0) + count);
    if (!heroes.includes(code)) heroes.push(code);
    if ((heroCounts.get(code) ?? 0) > 1 && !heroLimit) {
      heroLimit = { cardCode: code, cardName: fact.name };
    }
  }

  function take(code: string, count: number): void {
    const fact = pool.get(code);
    if (!fact || !fact.deckLegal) {
      droppedCodes.push(code);
      return;
    }
    if (fact.typeCode === "hero") {
      takeHero(code, count, fact);
      return;
    }
    const existing = cards.find((card) => card.code === code);
    if (existing) {
      existing.count += count;
      return;
    }
    cards.push({ code, count });
  }

  for (const [code, count] of Object.entries(body.heroes)) take(code, count);
  // RingsDB's public decklist repeats each hero in `slots`. That entry is the same hero, not a second copy.
  for (const [code, count] of Object.entries(body.slots)) {
    // A code the pool does not hold was already dropped from `heroes`, so it is not dropped twice.
    const fact = pool.get(code);
    if (code in body.heroes && (!fact || fact.typeCode === "hero")) continue;
    take(code, count);
  }

  return { name: body.name, heroes, cards, droppedCodes, heroLimit };
}

export function droppedSentence(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  return `Dropped ${names.join(", ")}.`;
}

let decks: readonly PrebuiltDeck[] | null = null;

/** The pre-built player decks from data/decks/prebuilt.json, in the order the index lists them. Parsed on the first call, then kept. */
export function prebuiltDecks(): readonly PrebuiltDeck[] {
  decks ??= prebuiltDecksSchema.parse(prebuiltJson);
  return decks;
}

/** A pre-built deck as a decklist body, read like an import. Its sideboard is left out, like RingsDB sideslots. */
export function prebuiltBody(deck: PrebuiltDeck): DecklistBody {
  return {
    name: deck.name,
    heroes: Object.fromEntries(deck.heroes.map((code) => [code, 1])),
    slots: Object.fromEntries(deck.cards.map((slot) => [slot.code, slot.count])),
  };
}

// The product's own title, when the group heading and the deck's name do not already say it: "Angmar Awakened" for a
// Dúnedain deck, nothing for "The Road Darkens I" or a Starter Deck.
function productTitle(deck: PrebuiltDeck): string | null {
  const title = deck.productName.replace(/^The Hobbit: /, "").replace(/ (Hero|Saga) Expansion$| Starter Deck$/, "");
  if (deck.group === "Core Set" || deck.group === "Community Deck Lists" || deck.name.startsWith(title)) return null;
  return title;
}

/** The heroes, after the product when the row does not already name it, so a row says what the player is choosing. */
export function prebuiltDetail(deck: PrebuiltDeck, heroName: (code: string) => string): string {
  const heroes = deck.heroes.map(heroName).join(", ");
  const title = productTitle(deck);
  return title ? `${title} · ${heroes}` : heroes;
}

export type PrebuiltRow = { kind: "group"; title: string } | { kind: "deck"; deck: PrebuiltDeck };

/** The list the import screen draws: each group's heading, then its decks. */
export function prebuiltRows(decks: readonly PrebuiltDeck[]): PrebuiltRow[] {
  const rows: PrebuiltRow[] = [];
  for (const deck of decks) {
    const last = rows.at(-1);
    if (!last || (last.kind === "deck" ? last.deck.group : last.title) !== deck.group) rows.push({ kind: "group", title: deck.group });
    rows.push({ kind: "deck", deck });
  }
  return rows;
}

/**
 * "12 of 47 cards with text not applied": the copies of a pre-built deck (heroes included) whose printed text the app does not
 * fully apply (notAppliedCards, as the deck screens count them), against the deck's total; null when it applies every card
 * (docs/brief.md, Three layers).
 */
export function prebuiltNotApplied(deck: PrebuiltDeck, inactive: ReadonlySet<string>): string | null {
  const total = deck.heroes.length + deck.cards.reduce((sum, card) => sum + card.count, 0);
  const off = notAppliedCards(deck, inactive).reduce((sum, card) => sum + card.copies, 0);
  return off === 0 ? null : `${off} of ${total} cards with text not applied`;
}

/** A row's detail with the not-applied count after it. */
export function withNotApplied(detail: string, notApplied: string | null): string {
  return notApplied ? `${detail} · ${notApplied}` : detail;
}

let list: { rows: PrebuiltRow[]; sticky: number[] } | null = null;

/** The import screen's list, and the indexes of its group headings (they stay at the top while the decks scroll under them). Built on the first call, then kept. */
export function prebuiltList(): { rows: readonly PrebuiltRow[]; sticky: readonly number[] } {
  if (!list) {
    const rows = prebuiltRows(prebuiltDecks());
    list = { rows, sticky: rows.flatMap((row, at) => (row.kind === "group" ? [at] : [])) };
  }
  return list;
}
