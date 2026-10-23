export type DeckSaveCard = {
  name: string;
  typeCode: string;
  sphereCode: string | null;
  deckLimit: number | null;
  deckLegal: boolean;
  traits: string | null;
  /** Present on some catalog rows. The save check does not read it. */
  campaignId?: string | null;
};

export type DeckSaveEntry = {
  code: string;
  count: number;
};

export type DeckSaveRefusal = {
  cardCode: string | null;
  cardName: string | null;
  rule: string;
};

export type DeckRestriction =
  | { cardCode: string; kind: "trait"; trait: string }
  | { cardCode: string; kind: "sphere"; sphere: string }
  | { cardCode: string; kind: "campaignId" };

const OPEN_SPHERES = new Set(["neutral", "fellowship"]);

export function traitTokens(traits: string | null): string[] {
  if (!traits) return [];
  const tokens: string[] = [];
  for (const part of traits.split(".")) {
    const token = part.trim();
    if (token.length > 0) tokens.push(token);
  }
  return tokens;
}

export function formatDeckRefusal(refusal: Pick<DeckSaveRefusal, "cardName" | "rule">): string {
  if (refusal.cardName && refusal.cardName.length > 0) return `${refusal.cardName} ${refusal.rule}`;
  return refusal.rule;
}

/** Rule for a stored count. Over 3 is the copy cap. A lower deck_limit is named only when it is under 3. */
export function copyCapRule(count: number, deckLimit: number | null): string | null {
  if (!Number.isInteger(count) || count < 1) return "Count must be at least 1.";
  if (count > 3) return "At most three copies.";
  if (deckLimit != null && deckLimit < 3 && count > deckLimit) return `Deck limit is ${deckLimit}.`;
  return null;
}

function named(cardCode: string, cardName: string, rule: string): DeckSaveRefusal {
  return { cardCode, cardName, rule };
}

function unresolved(code: string): DeckSaveRefusal {
  return named(code, code, "Not a deck-legal card.");
}

function combinedCounts(cards: readonly DeckSaveEntry[]): DeckSaveEntry[] {
  const combined: DeckSaveEntry[] = [];
  const indexByCode = new Map<string, number>();
  for (const card of cards) {
    const existing = indexByCode.get(card.code);
    if (existing == null) {
      indexByCode.set(card.code, combined.length);
      combined.push({ code: card.code, count: card.count });
      continue;
    }
    const line = combined[existing];
    if (line) line.count += card.count;
  }
  return combined;
}

export function deckSaveRefusal(
  heroCodes: readonly string[],
  cards: readonly DeckSaveEntry[],
  facts: ReadonlyMap<string, DeckSaveCard>,
  restrictions: readonly DeckRestriction[] = [],
): DeckSaveRefusal | null {
  const codes = [...heroCodes, ...cards.map((card) => card.code)];
  for (const code of codes) {
    const fact = facts.get(code);
    if (!fact || !fact.deckLegal) return unresolved(code);
  }

  const seenHeroes = new Set<string>();
  for (const code of heroCodes) {
    const fact = facts.get(code);
    if (!fact) return unresolved(code);
    if (fact.typeCode !== "hero") return named(code, fact.name, "Not a hero.");
    if (seenHeroes.has(code)) return named(code, fact.name, "A hero appears once.");
    seenHeroes.add(code);
  }

  for (const card of cards) {
    const fact = facts.get(card.code);
    if (!fact) return unresolved(card.code);
    if (fact.typeCode === "hero") return named(card.code, fact.name, "A hero is not a deck card.");
  }

  if (heroCodes.length > 3) {
    const extra = heroCodes[3];
    if (!extra) return { cardCode: null, cardName: null, rule: "Exactly three heroes." };
    const fact = facts.get(extra);
    return named(extra, fact?.name ?? extra, "Exactly three heroes.");
  }
  if (heroCodes.length !== 3) return { cardCode: null, cardName: null, rule: "Exactly three heroes." };

  const combined = combinedCounts(cards);
  for (const card of cards) {
    const fact = facts.get(card.code);
    if (!fact) return unresolved(card.code);
    if (!Number.isInteger(card.count) || card.count < 1) {
      return named(card.code, fact.name, "Count must be at least 1.");
    }
  }
  for (const card of combined) {
    const fact = facts.get(card.code);
    if (!fact) return unresolved(card.code);
    const rule = copyCapRule(card.count, fact.deckLimit);
    if (rule) return named(card.code, fact.name, rule);
  }

  let total = 0;
  for (const card of combined) total += card.count;
  if (total < 50) return { cardCode: null, cardName: null, rule: "At least 50 cards." };

  const heroSpheres = new Set<string>();
  for (const code of heroCodes) {
    const sphere = facts.get(code)?.sphereCode;
    if (sphere) heroSpheres.add(sphere);
  }

  for (const card of combined) {
    const fact = facts.get(card.code);
    if (!fact) return unresolved(card.code);
    const sphere = fact.sphereCode;
    if (sphere == null || OPEN_SPHERES.has(sphere)) continue;
    if (!heroSpheres.has(sphere)) return named(card.code, fact.name, "Sphere must match a hero.");
  }

  const inDeck = new Set(codes);
  for (const restriction of restrictions) {
    if (!inDeck.has(restriction.cardCode)) continue;
    const fact = facts.get(restriction.cardCode);
    const cardName = fact?.name ?? restriction.cardCode;
    if (restriction.kind === "campaignId") {
      return named(restriction.cardCode, cardName, "Campaign restriction.");
    }
    if (restriction.kind === "trait") {
      const matched = heroCodes.some((code) => traitTokens(facts.get(code)?.traits ?? null).includes(restriction.trait));
      if (!matched) return named(restriction.cardCode, cardName, `Requires a ${restriction.trait} hero.`);
    }
    if (restriction.kind === "sphere") {
      const matched = heroCodes.some((code) => facts.get(code)?.sphereCode === restriction.sphere);
      if (!matched) return named(restriction.cardCode, cardName, `Requires a ${restriction.sphere} hero.`);
    }
  }

  return null;
}
