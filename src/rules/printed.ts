import type { Card } from "../catalog/card-facts.ts";

// The part of a data/cards record the engine reads. A catalog row maps onto it (src/campaign/cards.ts).
export type PrintedSource = Pick<
  Card,
  | "code" | "name" | "type" | "traits" | "sphere" | "cost" | "threat" | "willpower" | "attack" | "defense" | "health"
  | "questPoints" | "victory" | "isUnique" | "engagementCost" | "keywords" | "campaignKind" | "burdenSet" | "backType"
>;

export type Sphere = "leadership" | "tactics" | "spirit" | "lore" | "neutral" | "fellowship" | "baggins";

export type CardType =
  | "hero"
  | "ally"
  | "attachment"
  | "event"
  | "enemy"
  | "location"
  | "treachery"
  | "quest"
  | "objective"
  | "treasure"
  // A player card played in the planning phase into its player's quest area (families/sidequests-play.ts), and a contract
  // card that begins the game in its player's play area (families/sidequests-contract.ts).
  | "player-side-quest"
  | "contract";

export type Keywords = {
  surge: boolean;
  hide: number | null;
  doomed: number | null;
  peril: boolean;
  archery: number | null;
  immuneToPlayerCardEffects: boolean;
  indestructible: boolean;
  toughness: number | null;
  permanent: boolean;
  setup: boolean;
  sentinel: boolean;
  ranged: boolean;
  restricted: boolean;
  secrecy: number | null;
};

export type PrintedCard = {
  code: string;
  name: string;
  type: CardType;
  traits: readonly string[];
  sphere: Sphere | null;
  cost: number | null;
  // The card prints X for its cost: the player pays any amount, and the card's effect reads it (Stand and Fight).
  costX: boolean;
  threat: number | null;
  willpower: number | null;
  attack: number | null;
  defense: number | null;
  health: number | null;
  questPoints: number | null;
  victory: number | null;
  isUnique: boolean;
  engagementCost: number | null;
  keywords: Keywords;
  leavesPlayLoses: boolean;
  // A boon or burden (Campaign Mode), its burden set, and the deck it joins when it is in the campaign pool.
  campaignKind: "boon" | "burden" | null;
  burdenSet: string | null;
  backType: "player" | "encounter" | null;
};

const EMPTY_KEYWORDS: Keywords = {
  surge: false,
  hide: null,
  doomed: null,
  peril: false,
  archery: null,
  immuneToPlayerCardEffects: false,
  indestructible: false,
  toughness: null,
  permanent: false,
  setup: false,
  sentinel: false,
  ranged: false,
  restricted: false,
  secrecy: null,
};

export function definePrinted(
  card: Partial<Omit<PrintedCard, "keywords">> &
    Pick<PrintedCard, "code" | "name" | "type"> & { keywords?: Partial<Keywords> },
): PrintedCard {
  return {
    traits: [],
    sphere: null,
    cost: null,
    costX: false,
    threat: null,
    willpower: null,
    attack: null,
    defense: null,
    health: null,
    questPoints: null,
    victory: null,
    isUnique: false,
    engagementCost: null,
    leavesPlayLoses: false,
    campaignKind: null,
    burdenSet: null,
    backType: null,
    ...card,
    keywords: { ...EMPTY_KEYWORDS, ...card.keywords },
  };
}

export function printedOf(cards: ReadonlyMap<string, PrintedCard>, code: string): PrintedCard {
  const card = cards.get(code);
  if (!card) throw new Error(`Missing printed card ${code}`);
  return card;
}

export function spherePays(pool: Sphere | null, cost: Sphere | null): boolean {
  if (pool == null) return false;
  if (cost == null || cost === "neutral") return true;
  return pool === cost;
}

// An objective ally with printed combat stats (Gildor Inglorion) acts as an ally once a player controls it.
export function isAllyLike(printed: PrintedCard): boolean {
  return printed.type === "ally" || ((printed.type === "objective" || printed.type === "treasure") && printed.health != null);
}

export function isCharacterType(printed: PrintedCard): boolean {
  return printed.type === "hero" || isAllyLike(printed);
}

// A card whose originating deck is the encounter deck: an encounter card, or a campaign card with an encounter back.
// Discarded, it goes to the encounter discard pile even while a player controls it (Gildor Inglorion)
// (rr.discard-pile-and-victory-display, rr.ownership-and-control).
export function fromEncounterDeck(printed: PrintedCard): boolean {
  if (printed.backType != null) return printed.backType === "encounter";
  return !(printed.type === "hero" || printed.type === "ally" || printed.type === "attachment" || printed.type === "event" || printed.type === "treasure" || printed.type === "player-side-quest" || printed.type === "contract");
}

export function isPlayerType(printed: PrintedCard): boolean {
  return isCharacterType(printed) || printed.type === "attachment" || printed.type === "event" || printed.type === "player-side-quest";
}

const CARD_TYPES: readonly CardType[] = ["hero", "ally", "attachment", "event", "enemy", "location", "treachery", "quest", "objective", "treasure", "player-side-quest", "contract"];
const SPHERES: readonly Sphere[] = ["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"];

// The engine-facing subset of a data/cards record. A type or sphere the engine does not know fails loudly.
export function printedFromCard(card: PrintedSource): PrintedCard {
  const type = CARD_TYPES.find((candidate) => candidate === card.type);
  if (!type) throw new Error(`Card ${card.code} ${card.name} has unsupported type ${card.type}`);
  let sphere: Sphere | null = null;
  if (card.sphere != null) {
    sphere = SPHERES.find((candidate) => candidate === card.sphere) ?? null;
    if (!sphere) throw new Error(`Card ${card.code} ${card.name} has unsupported sphere ${card.sphere}`);
  }
  const keywords = card.keywords ?? {};
  return definePrinted({
    code: card.code,
    name: card.name,
    type,
    traits: card.traits,
    sphere,
    // A variable cost prints as "X" and is not a number.
    cost: card.cost != null && /^\d+$/.test(card.cost) ? Number(card.cost) : null,
    costX: card.cost === "X",
    threat: card.threat,
    willpower: card.willpower,
    attack: card.attack,
    defense: card.defense,
    health: card.health,
    questPoints: card.questPoints,
    victory: card.victory,
    isUnique: card.isUnique,
    engagementCost: card.engagementCost,
    leavesPlayLoses: keywords.leavesPlayLoses === true,
    campaignKind: card.campaignKind,
    burdenSet: card.burdenSet,
    backType: card.backType,
    keywords: {
      surge: keywords.surge === true,
      hide: keywords.hide ?? null,
      doomed: keywords.doomed ?? null,
      peril: keywords.peril === true,
      archery: keywords.archery ?? null,
      immuneToPlayerCardEffects: keywords.immune === true,
      indestructible: keywords.indestructible === true,
      toughness: keywords.toughness ?? null,
      permanent: keywords.permanent === true,
      sentinel: keywords.sentinel === true,
      ranged: keywords.ranged === true,
      restricted: keywords.restricted === true,
      secrecy: keywords.secrecy ?? null,
    },
  });
}
