import type { PrintedCard } from "../rules/printed.ts";

// The Fellowship saga rules on a briefing loadout: one deck and its heroes per seat. Pure. Each error
// names the card and the rule. The Ring-bearer comes from the player's own heroes and is never inserted.

export type LoadoutSeat = { heroes: readonly string[]; deck: readonly string[] };

export type LoadoutRule =
  | "unknownCard"
  | "twoFellowshipHeroes"
  | "secondFrodo"
  | "noRingBearer"
  | "tooManyHeroes"
  | "ringInDeck"
  | "sameHero";

export type LoadoutError = { rule: LoadoutRule; code: string; card: string; message: string };

const MOST_HEROES = 3;

function isFellowship(card: PrintedCard): boolean {
  return card.type === "hero" && card.sphere === "fellowship";
}

function isRingBearer(card: PrintedCard): boolean {
  return isFellowship(card) && card.traits.includes("Ring-bearer");
}

export function validateLoadout(seats: readonly LoadoutSeat[], cards: ReadonlyMap<string, PrintedCard>): LoadoutError[] {
  const errors: LoadoutError[] = [];
  const fail = (rule: LoadoutRule, card: PrintedCard, why: string) =>
    errors.push({ rule, code: card.code, card: card.name, message: `${card.name} (${card.code}): ${why}` });

  const known = (code: string): PrintedCard | null => {
    const card = cards.get(code);
    if (!card) errors.push({ rule: "unknownCard", code, card: code, message: `${code}: the catalog has no such card` });
    return card ?? null;
  };

  const heroCards = seats.map((seat) => seat.heroes.map(known));
  const deckCards = seats.map((seat) => seat.deck.map(known));
  if (errors.length > 0) return errors;

  // The first seat needs a Ring-bearer of its own.
  const first = heroCards[0] ?? [];
  if (!first.some((card) => card != null && isRingBearer(card))) {
    const named = first[0];
    errors.push({
      rule: "noRingBearer",
      code: named?.code ?? "",
      card: named?.name ?? "",
      message: `${named ? `${named.name} (${named.code}): ` : ""}the first seat needs a Fellowship-sphere hero with the Ring-bearer trait`,
    });
  }

  // One Fellowship-sphere hero across the table, which also means one Ring-bearer: only Fellowship heroes carry the trait.
  const fellowship = heroCards.flat().filter((card): card is PrintedCard => card != null && isFellowship(card));
  for (const card of fellowship.slice(1)) fail("twoFellowshipHeroes", card, "only one Fellowship-sphere hero may start the scenario");

  // No other version of the seat-0 Ring-bearer, in a hero slot or in a deck. The name comes from the chosen card.
  const ringBearer = first.find((card): card is PrintedCard => card != null && isRingBearer(card));
  if (ringBearer) {
    const everyCard = [...heroCards.flat(), ...deckCards.flat()];
    const chosen = everyCard.indexOf(ringBearer);
    everyCard.forEach((card, index) => {
      if (card != null && index !== chosen && card.name === ringBearer.name) {
        fail("secondFrodo", card, `a second ${ringBearer.name} cannot be a starting hero or in the deck`);
      }
    });
  }

  // Heroes are unique: the players as a group have one copy of each title in play, so no two seats start with the
  // same hero (rr.unique-cards).
  const heroNames = new Set<string>();
  for (const card of heroCards.flat()) {
    // A second Ring-bearer is already named by secondFrodo.
    if (card == null || card.type !== "hero" || card.name === ringBearer?.name) continue;
    if (heroNames.has(card.name)) fail("sameHero", card, `only one ${card.name} can be in play, so no two heroes may share that title`);
    heroNames.add(card.name);
  }

  // The One Ring is granted by setup. It is never a deck card, so it never counts toward the deck minimum.
  for (const card of [...heroCards.flat(), ...deckCards.flat()]) {
    if (card?.leavesPlayLoses) fail("ringInDeck", card, "this card is granted by setup and cannot be in a deck");
  }

  // Three heroes besides the Ring-bearer. A fourth hero is legal only when the extra one is the Ring-bearer.
  heroCards.forEach((heroes) => {
    const bearer = heroes.find((card) => card != null && isRingBearer(card));
    const others = heroes.filter((card): card is PrintedCard => card != null && card !== bearer);
    for (const card of others.slice(MOST_HEROES)) fail("tooManyHeroes", card, "a fourth hero is legal only when the extra hero is the Ring-bearer");
  });
  return errors;
}
