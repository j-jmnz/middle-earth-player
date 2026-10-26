import type { DeckRule } from "./deck-rules.ts";
import { heroLimit } from "./deck-rules.ts";

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
  if (refusal.cardName && refusal.cardName.length > 0) return `${refusal.cardName}: ${refusal.rule}`;
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

// The Rules Reference's deckbuilding rules (rr.deckbuilding): 1 to 3 heroes, at least 50 player cards, and at most 3
// copies of a title, whichever printings they are. A card's sphere does not have to match a hero to be in a deck: it
// needs a matching hero to be played (rr.resource-match), which the table checks.
//
// A contract in the deck is no deck card: it does not count toward the minimum, and the deckbuilding rules on its side A (`rules`,
// deck-rules.ts) change the deck: no allies, one copy by title, one starting hero, exactly 50 cards with 10 of each sphere, at least
// 100 cards.
export function deckSaveRefusal(
  heroCodes: readonly string[],
  cardEntries: readonly DeckSaveEntry[],
  facts: ReadonlyMap<string, DeckSaveCard>,
  restrictions: readonly DeckRestriction[] = [],
  rules: readonly DeckRule[] = [],
): DeckSaveRefusal | null {
  const isContract = (code: string) => facts.get(code)?.typeCode === "contract";
  const contracts = cardEntries.filter((card) => isContract(card.code));
  const cards = cardEntries.filter((card) => !isContract(card.code));
  const contractCount = contracts.reduce((sum, card) => sum + card.count, 0);
  if (contractCount > 1) return { cardCode: contracts[1]?.code ?? null, cardName: facts.get(contracts[1]?.code ?? "")?.name ?? null, rule: "At most one contract." };
  const codes = [...heroCodes, ...cardEntries.map((card) => card.code)];
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

  const limit = heroLimit(rules);
  if (heroCodes.length > limit) {
    const extra = heroCodes[limit];
    const words = limit === 3 ? "three heroes" : limit === 1 ? "one hero" : `${limit} heroes`;
    if (!extra) return { cardCode: null, cardName: null, rule: `At most ${words}.` };
    const fact = facts.get(extra);
    return named(extra, fact?.name ?? extra, `At most ${words}.`);
  }
  if (rules.some((rule) => rule.kind === "heroes" && rule.differentSpheres)) {
    const spheres = new Set<string>();
    for (const code of heroCodes) {
      const fact = facts.get(code);
      const sphere = fact?.sphereCode ?? code;
      if (spheres.has(sphere)) return named(code, fact?.name ?? code, "Each hero must belong to a different sphere.");
      spheres.add(sphere);
    }
  }
  if (heroCodes.length === 0) return { cardCode: null, cardName: null, rule: "At least one hero." };
  const heroNames = new Set<string>();
  for (const code of heroCodes) {
    const fact = facts.get(code);
    if (fact && heroNames.has(fact.name)) return named(code, fact.name, "A hero appears once.");
    if (fact) heroNames.add(fact.name);
  }

  const combined = combinedCounts(cards);
  for (const card of cards) {
    const fact = facts.get(card.code);
    if (!fact) return unresolved(card.code);
    if (!Number.isInteger(card.count) || card.count < 1) {
      return named(card.code, fact.name, "Count must be at least 1.");
    }
  }
  // Copies count by title: two printings of one card share the 3-copy limit and the lower deck limit.
  const byTitle = new Map<string, { code: string; count: number; deckLimit: number | null }>();
  for (const card of combined) {
    const fact = facts.get(card.code);
    if (!fact) return unresolved(card.code);
    const title = byTitle.get(fact.name);
    const deckLimit = title?.deckLimit == null ? fact.deckLimit : fact.deckLimit == null ? title.deckLimit : Math.min(title.deckLimit, fact.deckLimit);
    byTitle.set(fact.name, { code: title?.code ?? card.code, count: (title?.count ?? 0) + card.count, deckLimit });
  }
  for (const [name, title] of byTitle) {
    const rule = copyCapRule(title.count, title.deckLimit);
    if (rule) return named(title.code, name, rule);
  }
  for (const rule of rules) {
    if (rule.kind === "copies") {
      for (const [name, title] of byTitle) if (title.count > rule.max) return named(title.code, name, `At most ${rule.max} ${rule.max === 1 ? "copy" : "copies"} by title.`);
    }
    if (rule.kind === "noCards") {
      const found = combined.find((card) => facts.get(card.code)?.typeCode === rule.type);
      if (found) return named(found.code, facts.get(found.code)?.name ?? found.code, `The contract forbids ${rule.type} cards.`);
    }
  }

  let total = 0;
  for (const card of combined) total += card.count;
  const sizeRule = rules.find((rule): rule is Extract<DeckRule, { kind: "size" }> => rule.kind === "size");
  if (sizeRule?.exactly != null && total !== sizeRule.exactly) return { cardCode: null, cardName: null, rule: total < sizeRule.exactly ? `At least ${sizeRule.exactly} cards.` : `Exactly ${sizeRule.exactly} cards.` };
  const minimum = sizeRule?.min ?? 50;
  if (total < minimum) return { cardCode: null, cardName: null, rule: `At least ${minimum} cards.` };
  const perSphere = rules.find((rule): rule is Extract<DeckRule, { kind: "perSphere" }> => rule.kind === "perSphere");
  if (perSphere) {
    for (const sphere of ["leadership", "lore", "spirit", "tactics"] as const) {
      const count = combined.reduce((sum, card) => sum + (facts.get(card.code)?.sphereCode === sphere ? card.count : 0), 0);
      if (count !== perSphere.count) return { cardCode: null, cardName: null, rule: `Exactly ${perSphere.count} ${sphere[0]?.toUpperCase()}${sphere.slice(1)} cards (it has ${count}).` };
    }
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
