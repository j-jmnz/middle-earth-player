import prebuiltJson from "../../data/decks/prebuilt.json";
import { prebuiltDecksSchema, type PrebuiltDeck } from "../catalog/prebuilt-deck";

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

/** A decimal id, a ringsdb.com decklist view URL (with or without its slug), or the public decklist JSON URL. */
export function parseDecklistRef(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== "ringsdb.com" && url.hostname !== "www.ringsdb.com") return null;
  // The link RingsDB shows carries the deck's slug: /decklist/view/68989/thegoodthebadandtheugly-1.0.
  const view = /^\/decklist\/view\/(\d+)(?:\/[^/]+)?\/?$/.exec(url.pathname);
  if (view?.[1]) return view[1];
  const api = /^\/api\/public\/decklist\/(\d+)\.json$/.exec(url.pathname);
  if (api?.[1]) return api[1];
  return null;
}

export function decklistUrl(id: string): string {
  return `https://ringsdb.com/api/public/decklist/${id}.json`;
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

export function importSavedSentence(names: readonly string[]): string {
  const dropped = droppedSentence(names);
  if (!dropped) return "The deck was saved.";
  return `The deck was saved. ${dropped}`;
}

/** The pre-built player decks from data/decks/prebuilt.json, in the order the index lists them. */
export const prebuiltDecks: readonly PrebuiltDeck[] = prebuiltDecksSchema.parse(prebuiltJson);

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
