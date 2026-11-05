import type { CampaignData } from "../catalog/scenario-data.ts";
import type { PrintedCard } from "../rules/core/printed.ts";

// The loadout rules of a briefing: one deck and its heroes per seat. Pure. Each error names the card and the rule. In a saga
// campaign (the Fellowship of the Ring) the Fellowship saga rules apply: a Ring-bearer from the player's own heroes, one
// Fellowship-sphere hero, no second Frodo, no One Ring in a deck, a fourth hero only as the Ring-bearer. Outside a saga none of
// them runs, and a Fellowship-sphere hero is refused (mec109.the-fellowship-sphere: "can only be used when playing the
// scenarios in the saga expansions").

export type LoadoutSeat = { heroes: readonly string[]; deck: readonly string[] };

// A hero a campaign refuses in a scenario, with the rule that says so. Campaign Mode only: a standalone game is not bound by it.
export type HeroBan = { code: string; name: string; rule: string };

// A ban holds in the listed parts of the campaign, counted from 1 in the campaign's order of play (not in the other parts).
type HeroBanEntry = { ban: HeroBan; parts: readonly number[] };

const upTo = (last: number): number[] => Array.from({ length: last }, (_, index) => index + 1);

// "When playing the Dream-chaser campaign, the Na'asiyah hero cannot be used in scenarios 1 through 7" (dcce.naasiyah). "Haldan cannot be used as a hero in this campaign" (emce.haldan, MEC115 p.2):
// the campaign card of The King's Quest, the third part, says "Haldan may be included among a player's heroes" (12170:A:1), so the ban holds in every part but that one.
const HERO_BANS: Readonly<Record<string, HeroBanEntry>> = {
  "dream-chaser": { ban: { code: "12109", name: "Na'asiyah", rule: "dcce.naasiyah" }, parts: upTo(7) },
  "ered-mithrin": { ban: { code: "19026", name: "Haldan", rule: "emce.haldan" }, parts: [1, 2, 4, 5, 6, 7, 8, 9] },
};

/** The heroes the campaign refuses in this scenario (the scenario's place in the campaign's order decides). */
export function heroBansOf(campaign: Pick<CampaignData, "id" | "scenarios">, scenarioId: string): HeroBan[] {
  const entry = HERO_BANS[campaign.id];
  const place = campaign.scenarios.indexOf(scenarioId);
  return entry && place >= 0 && entry.parts.includes(place + 1) ? [entry.ban] : [];
}

export type LoadoutRule =
  | "unknownCard"
  | "fellowshipOutsideSaga"
  | "twoFellowshipHeroes"
  | "secondFrodo"
  | "noRingBearer"
  | "tooManyHeroes"
  | "ringInDeck"
  | "sameHero"
  | "bannedHero"
  | "undiscoveredTreasure"
  | "treasureCopies";

export type LoadoutError = { rule: LoadoutRule; code: string; card: string; message: string };

const MOST_HEROES = 3;

function isFellowship(card: PrintedCard): boolean {
  return card.type === "hero" && card.sphere === "fellowship";
}

function isRingBearer(card: PrintedCard): boolean {
  return isFellowship(card) && card.traits.includes("Ring-bearer");
}

// `discovered` is the treasures the Campaign Log records (emce.treasure): a deck may hold a treasure only when its code is listed, one copy by title, and a game without a log lists none.
export function validateLoadout(seats: readonly LoadoutSeat[], cards: ReadonlyMap<string, PrintedCard>, saga: boolean, bans: readonly HeroBan[] = [], discovered: readonly string[] = []): LoadoutError[] {
  const errors: LoadoutError[] = [];
  const fail = (rule: LoadoutRule, card: PrintedCard, why: string) =>
    errors.push({ rule, code: card.code, card: card.name, message: `${card.name} (${card.code}): ${why}` });

  const known = (code: string): PrintedCard | null => {
    const card = cards.get(code);
    if (!card) errors.push({ rule: "unknownCard", code, card: code, message: `${code}: the catalog has no such card` });
    return card ?? null;
  };

  // One title once across the table: a second hero of a name is refused. `skip` is a name another rule already refused.
  const refuseSameHero = (heroes: readonly (PrintedCard | null)[], skip: string | null) => {
    const names = new Set<string>();
    for (const card of heroes) {
      if (card == null || card.type !== "hero" || card.name === skip) continue;
      if (names.has(card.name)) fail("sameHero", card, `only one ${card.name} can be in play, so no two heroes may share that title`);
      names.add(card.name);
    }
  };

  const heroCards = seats.map((seat) => seat.heroes.map(known));
  const deckCards = seats.map((seat) => seat.deck.map(known));
  if (errors.length > 0) return errors;

  for (const card of heroCards.flat()) {
    const ban = card == null ? undefined : bans.find((item) => item.code === card.code);
    if (card != null && ban != null) fail("bannedHero", card, `${ban.name} cannot be used in this scenario of the campaign (${ban.rule})`);
  }

  // A treasure is a deck card only once the log records it (emce.treasure): "if that treasure card is marked in the campaign log". No more than 1 copy of a title.
  for (const deck of deckCards) {
    const seen = new Set<string>();
    for (const card of deck) {
      if (card == null || card.campaignKind !== "treasure") continue;
      if (!discovered.includes(card.code)) fail("undiscoveredTreasure", card, "a treasure can be added to a deck only once the players have discovered it and it is marked in the campaign log (emce.treasure)");
      else if (seen.has(card.name)) fail("treasureCopies", card, "no more than 1 copy of a treasure, by title, can be added to a player's deck (emce.treasure)");
      seen.add(card.name);
    }
  }

  if (!saga) {
    for (const card of heroCards.flat()) {
      if (card != null && isFellowship(card)) fail("fellowshipOutsideSaga", card, "a Fellowship-sphere hero can only be used when playing the scenarios in the saga expansions (mec109.the-fellowship-sphere)");
    }
    // The same hero twice is still refused (rr.unique-cards).
    refuseSameHero(heroCards.flat(), null);
    return errors;
  }

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
  // same hero (rr.unique-cards). A second Ring-bearer is already named by secondFrodo.
  refuseSameHero(heroCards.flat(), ringBearer?.name ?? null);

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
