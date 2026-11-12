import type { CampaignData } from "../catalog/scenario-data.ts";
import type { PrintedCard } from "../rules/core/printed.ts";

import { sameTitle, type TitleBan } from "./saga.ts";

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
// the campaign card of The King's Quest, the third part, says "Haldan may be included among a player's heroes" (12170:A:2), so the ban holds in every part but that one.
const HERO_BANS: Readonly<Record<string, HeroBanEntry>> = {
  "dream-chaser": { ban: { code: "12109", name: "Na'asiyah", rule: "dcce.naasiyah" }, parts: upTo(7) },
  // "When playing campaign mode, the Amarthiúl hero cannot be used until indicated by a campaign card" (mec108.campaign-mode): The Battle of Carn Dûm's campaign card (10188:A:2) is the one that indicates it. From then he stays usable (agent recommendation, docs/brief.md, Angmar Awakened).
  "angmar-awakened": { ban: { code: "10115", name: "Amarthiúl", rule: "mec108.campaign-mode" }, parts: upTo(7) },
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
  | "bannedTitle"
  | "stolenCard"
  | "secondVersion"
  | "undiscoveredTreasure"
  | "treasureCopies";

// What a scenario's saga start adds to the loadout rules: the ☺ hero it grants the first player in place of a Ring-bearer from their own heroes
// (mec112.setting-up-the-game; ☺ Aragorn in scenarios 7 to 9), and the titles the players cannot use (src/campaign/saga.ts).
export type SagaRules = { hero?: string | undefined; titleBans?: readonly TitleBan[] | undefined };

export type LoadoutError = { rule: LoadoutRule; code: string; card: string; message: string };

const MOST_HEROES = 3;

function isFellowship(card: PrintedCard): boolean {
  return card.type === "hero" && card.sphere === "fellowship";
}

function isRingBearer(card: PrintedCard): boolean {
  return isFellowship(card) && card.traits.includes("Ring-bearer");
}

// A scenario that grants ☺ Aragorn (mec112.setting-up-the-game): no Ring-bearer is asked for. Only one ☺ hero is in play, so no player hero is from the
// Fellowship sphere; no other version of the granted hero is a starting hero or in a deck (mec112.fellowship-sphere-heroes); ☺ Aragorn does not count against
// the hero limit (mec112.aragorn); heroes are unique (rr.unique-cards).
type Cards = readonly (readonly (PrintedCard | null)[])[];

function grantedHeroErrors(heroCards: Cards, deckCards: Cards, cards: ReadonlyMap<string, PrintedCard>, hero: string): LoadoutError[] {
  const errors: LoadoutError[] = [];
  const fail = (rule: LoadoutRule, card: PrintedCard, why: string) => errors.push({ rule, code: card.code, card: card.name, message: `${card.name} (${card.code}): ${why}` });
  const granted = cards.get(hero);
  const heroes = heroCards.flat();
  const inDecks = deckCards.flat();
  for (const card of heroes) {
    if (card != null && card.code !== hero && isFellowship(card)) fail("twoFellowshipHeroes", card, "only one Fellowship-sphere hero may be in play, and this scenario grants one");
  }
  for (const card of [...heroes, ...inDecks]) {
    if (card == null || card.code === hero) continue;
    if (granted && card.name === granted.name) fail("secondVersion", card, `another ${granted.name} cannot be a starting hero or in the deck while the ☺ ${granted.name} is in the game`);
    if (card.leavesPlayLoses) fail("ringInDeck", card, "this card is granted by setup and cannot be in a deck");
  }
  for (const seat of heroCards) {
    for (const card of seat.filter((item): item is PrintedCard => item != null && item.code !== hero).slice(MOST_HEROES)) fail("tooManyHeroes", card, "a fourth hero is legal only when the extra hero is ☺ Aragorn");
  }
  const names = new Set<string>();
  for (const card of heroes) {
    if (card == null || card.type !== "hero") continue;
    if (names.has(card.name) && card.name !== granted?.name) fail("sameHero", card, `only one ${card.name} can be in play, so no two heroes may share that title`);
    names.add(card.name);
  }
  return errors;
}

// `discovered` is the treasures the Campaign Log records (emce.treasure): a deck may hold a treasure only when its code is listed, one copy by title, and a game without a log lists none.
// `rules` is the scenario's saga start and title bans (SagaRules).
// `stolen` is the unique cards the campaign log records as stolen from each seat in Escape from Mount Gram (10174:B:3), by seat: they cannot be in that player's deck for the rest of the campaign, and a stolen hero cannot start.
export function validateLoadout(seats: readonly LoadoutSeat[], cards: ReadonlyMap<string, PrintedCard>, saga: boolean, bans: readonly HeroBan[] = [], discovered: readonly string[] = [], rules: SagaRules = {}, stolen: readonly (readonly string[])[] = []): LoadoutError[] {
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

  // A unique card stolen from the player (mec108.captured-deck, 10174:B:3) is no deck card of theirs and no hero of theirs.
  seats.forEach((seat, index) => {
    const lost = stolen[index] ?? [];
    for (const card of [...heroCards[index] ?? [], ...deckCards[index] ?? []]) {
      if (card != null && lost.includes(card.code)) fail("stolenCard", card, "the Goblins of Mount Gram stole this unique card (the campaign log notes it), so it cannot be in this player's deck for the rest of the campaign");
    }
  });

  // A title the box refuses (mec112.saruman-grima-smeagol): a hero or an ally, or any card for Frodo Baggins in the scenarios that grant ☺ Aragorn.
  for (const ban of rules.titleBans ?? []) {
    for (const card of [...heroCards.flat(), ...deckCards.flat()]) {
      if (card != null && sameTitle(card.name, ban.title) && (ban.types == null || ban.types.includes(card.type))) fail("bannedTitle", card, `the players cannot use ${ban.types == null ? "any card" : "any ally or hero card"} titled ${ban.title} in this box (${ban.rule})`);
    }
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

  if (rules.hero != null) {
    // A Fellowship hero whose title the box already bans (Frodo Baggins in 7 to 9) is refused once, for the ban.
    const banned = new Set(errors.filter((error) => error.rule === "bannedTitle").map((error) => error.code));
    return [...errors, ...grantedHeroErrors(heroCards, deckCards, cards, rules.hero).filter((error) => !(error.rule === "twoFellowshipHeroes" && banned.has(error.code)))];
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
