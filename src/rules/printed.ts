import type { Card } from "../catalog/card-facts.ts";
import type { UpgradedStats } from "../catalog/schema.ts";

// The part of a data/cards record the engine reads. A catalog row maps onto it (src/campaign/cards.ts).
export type PrintedSource = Pick<
  Card,
  | "code" | "name" | "type" | "traits" | "sphere" | "cost" | "threat" | "willpower" | "attack" | "defense" | "health"
  | "questPoints" | "victory" | "isUnique" | "engagementCost" | "keywords" | "campaignKind" | "burdenSet" | "backType" | "encounterSet"
> & {
  // The stats of the Upgraded side, side B (a catalog row carries them as `upgraded`, a data/cards record as `back`).
  upgraded?: UpgradedStats | null;
  back?: Card["back"];
};

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
  // The campaign card, next to the quest deck. The engine holds it only when it has an ability that works during the scenario.
  | "campaign"
  // The Nightmare setup card, next to the quest deck on Nightmare (zone `nightmare`): its side A's lines stay active all game.
  | "nightmare"
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
  battle: boolean;
  siege: boolean;
  secrecy: number | null;
  // The sea family's keywords (families/sea*.ts): Sailing on a quest stage (dcce.sailing), Boarding X on a ship-enemy (dcce.boarding).
  sailing: boolean;
  boarding: number | null;
  // The Sailing success symbols the card prints (dcce.sailing-tests), null when it prints none.
  sailingSuccess: number | null;
  // Uncharted: the card is a double-sided location whose side B is a Lost Island (dcce.uncharted).
  uncharted: boolean;
};

// A ship (dcce.ships): a ship-enemy is an enemy and a ship-objective an objective ally for every purpose (`type` says which), with the
// exceptions in dcce.ship-enemies and dcce.ship-objectives (families/sea-ships.ts).
export type ShipKind = "enemy" | "objective";

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
  // Null for a card that is not a ship.
  ship: ShipKind | null;
  // The encounter set the card belongs to, or null (the fleet: The Dream-chaser's Fleet; the Stormcaller Elite).
  encounterSet: string | null;
  // The stats a card dealt on its Upgraded side, side B, has in place of the printed ones (dcce.scalable-upgradable). Null for a card without.
  upgraded: UpgradedStats | null;
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
  battle: false,
  siege: false,
  secrecy: null,
  sailing: false,
  boarding: null,
  sailingSuccess: null,
  uncharted: false,
};

// The Upgraded side's stats of a data/cards record, when its side B prints all four (dcce.scalable-upgradable).
function upgradedOfBack(back: Card["back"] | undefined): UpgradedStats | null {
  if (back?.willpower == null || back.attack == null || back.defense == null || back.health == null) return null;
  return { willpower: back.willpower, attack: back.attack, defense: back.defense, health: back.health };
}

// The card type a card in play has: an ally among its controller's heroes (the zone heroType puts it in, families/play-sweep.ts) lost
// the ally type and gained the hero type (rr.card-types: Sword-thain, Prince Imrahil). Everything else has its printed type.
export function cardTypeOf(instance: { zone: string }, printed: PrintedCard): CardType {
  return instance.zone === "heroes" ? "hero" : printed.type;
}

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
    ship: null,
    encounterSet: null,
    upgraded: null,
    ...card,
    keywords: { ...EMPTY_KEYWORDS, ...card.keywords },
  };
}

// The code of the "Orc Guard" a deck card becomes in Escape from Dol Guldur (01107:A:1, 01125:B:1): not a printed card but a stand-in the
// engine creates, "an enemy with 1 hit point, 1 Attack and 1 Defense" (families/dungeon-guard.ts). Every card map knows it.
export const ORC_GUARD_CODE = "orc-guard";
const BUILT_IN: ReadonlyMap<string, PrintedCard> = new Map([
  [ORC_GUARD_CODE, definePrinted({ code: ORC_GUARD_CODE, name: "Orc Guard", type: "enemy", threat: 0, engagementCost: 0, attack: 1, defense: 1, health: 1 })],
]);

// A hero that Fallen Into Evil (142083) made an enemy keeps its card with the code `<code>~enemy`: "Attached hero loses the hero card type and gains the enemy
// card type with Threat equal to its Willpower and engagement cost equal to its threat cost". The printed card is made from the hero's; its game text is blank.
export const FALLEN_SUFFIX = "~enemy";
const FALLEN = new WeakMap<PrintedCard, PrintedCard>();

// The hero's own code for the code of a fallen hero, or the code itself.
export function fallenBase(code: string): string {
  return code.endsWith(FALLEN_SUFFIX) ? code.slice(0, -FALLEN_SUFFIX.length) : code;
}

function fallenOf(hero: PrintedCard): PrintedCard {
  let made = FALLEN.get(hero);
  if (!made) {
    made = definePrinted({
      code: hero.code + FALLEN_SUFFIX,
      name: hero.name,
      type: "enemy",
      traits: hero.traits,
      threat: hero.willpower ?? 0,
      engagementCost: hero.threat ?? 0,
      attack: hero.attack,
      defense: hero.defense,
      health: hero.health,
      isUnique: hero.isUnique,
    });
    FALLEN.set(hero, made);
  }
  return made;
}

export function printedOf(cards: ReadonlyMap<string, PrintedCard>, code: string): PrintedCard {
  const card = cards.get(code) ?? BUILT_IN.get(code);
  if (card) return card;
  const hero = code.endsWith(FALLEN_SUFFIX) ? cards.get(fallenBase(code)) : undefined;
  if (!hero) throw new Error(`Missing printed card ${code}`);
  return fallenOf(hero);
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
  return isCharacterType(printed) || printed.type === "attachment" || printed.type === "event" || printed.type === "player-side-quest" || printed.type === "contract";
}

const CARD_TYPES: readonly CardType[] = ["hero", "ally", "attachment", "event", "enemy", "location", "treachery", "quest", "objective", "treasure", "campaign", "nightmare", "player-side-quest", "contract"];
const SPHERES: readonly Sphere[] = ["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"];

// The engine-facing subset of a data/cards record. A type or sphere the engine does not know fails loudly.
export function printedFromCard(card: PrintedSource): PrintedCard {
  // A ship is an enemy or an objective ally that carries a mark (dcce.ships): the catalog types ship-enemy and ship-objective.
  const ship: ShipKind | null = card.type === "ship-enemy" ? "enemy" : card.type === "ship-objective" ? "objective" : null;
  const engineType = ship === "enemy" ? "enemy" : ship === "objective" ? "objective" : card.type;
  const type = CARD_TYPES.find((candidate) => candidate === engineType);
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
    ship,
    encounterSet: card.encounterSet,
    upgraded: card.upgraded ?? upgradedOfBack(card.back),
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
      battle: keywords.battle === true,
      siege: keywords.siege === true,
      secrecy: keywords.secrecy ?? null,
      sailing: keywords.sailing === true,
      boarding: keywords.boarding ?? null,
      sailingSuccess: keywords.sailingSuccess ?? null,
      uncharted: keywords.uncharted === true,
    },
  });
}
