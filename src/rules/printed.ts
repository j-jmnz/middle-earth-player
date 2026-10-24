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
  | "treasure";

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
};

export type PrintedCard = {
  code: string;
  name: string;
  type: CardType;
  traits: readonly string[];
  sphere: Sphere | null;
  cost: number | null;
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
};

export function definePrinted(
  card: Partial<Omit<PrintedCard, "keywords">> &
    Pick<PrintedCard, "code" | "name" | "type"> & { keywords?: Partial<Keywords> },
): PrintedCard {
  return {
    traits: [],
    sphere: null,
    cost: null,
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

// A campaign card with printed combat stats (Gildor Inglorion) acts as an ally once a player controls it.
export function isAllyLike(printed: PrintedCard): boolean {
  return printed.type === "ally" || (printed.type === "treasure" && printed.health != null);
}

export function isCharacterType(type: CardType): boolean {
  return type === "hero" || type === "ally";
}

export function isPlayerType(type: CardType): boolean {
  return type === "hero" || type === "ally" || type === "attachment" || type === "event";
}
