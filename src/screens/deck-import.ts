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

/** A decimal id, a ringsdb.com decklist view URL, or the public decklist JSON URL. */
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
  const view = /^\/decklist\/view\/(\d+)\/?$/.exec(url.pathname);
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
  for (const [code, count] of Object.entries(body.slots)) take(code, count);

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
