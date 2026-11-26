import type { Card } from "../../catalog/card-facts.ts";
import type { UpgradedStats } from "../../catalog/schema.ts";

// The part of a data/cards record the engine reads. A catalog row maps onto it (src/campaign/cards.ts).
export type PrintedSource = Pick<
  Card,
  | "code" | "name" | "type" | "traits" | "sphere" | "cost" | "threat" | "willpower" | "attack" | "defense" | "health"
  | "questPoints" | "victory" | "isUnique" | "engagementCost" | "keywords" | "campaignKind" | "burdenSet" | "backType" | "encounterSet"
> & {
  // The printed type line ("Objective Location"): the Lost in Mirkwood objective-locations are objectives that travel, explore and count as locations (rr.victory, ledger lines 18029:A:2, 18029:A:3).
  typeName?: string;
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
  // A player card played in the planning phase into the staging area (families/sidequests/play.ts), and a contract
  // card that begins the game in its player's play area (families/sidequests/contract.ts).
  | "player-side-quest"
  | "contract"
  // An encounter side quest (Fire in the Night, emce.side-quests): a quest card with an encounter card back. It is revealed into the staging area and may be the current quest, as a player side quest in play may (families/sidequests/play.ts) (families/wilderland/night-quest.ts).
  | "encounter-side-quest";

export type Keywords = {
  surge: boolean;
  hide: number | null;
  doomed: number | null;
  // Regenerate X (dwd.regenerate): healed from the enemy itself after the first player token passes in the Refresh phase (families/encounter/regenerate.ts).
  regenerate: number | null;
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
  // The Sauron's Eye icons the card prints (mec113.fortitude-tests), null when it prints none.
  eyeIcons: number | null;
  // Uncharted: the card is a double-sided location whose side B is a Lost Island (dcce.uncharted).
  uncharted: boolean;
  // Aflame X (dcce.aflame): the damage on a location that destroys it, null when the card prints none.
  aflame: number | null;
  // The Siege value the card prints (docs/scenarios/standalone-scenarios/attack-on-dol-guldur.md, Attack on Dol Guldur, reading 2), null when it prints none.
  siegeValue: number | null;
  pillage: number | null;
  // Burn X (The Battle of Lake-town): the burn damage a location adds to the pool "resolve all burn damage" deals, null when the card prints none.
  burn: number | null;
  // Grapple (dcce.grapple): the location in the staging area the enemy attaches to, facedown, when it is revealed; null when the card prints none.
  grapple: "highestThreat" | "lowestThreat" | "highestQuestPoints" | "lowestQuestPoints" | null;
  // Phantom (mec113.phantom): the damage the enemy's attack would deal becomes a threat raise for the defending player (families/grey-company/).
  phantom: boolean;
  // Spectral (docs/scenarios/standalone-scenarios/the-stone-of-erech.md, The Stone of Erech): characters attacking the enemy use their Willpower instead of their Attack (families/attack/spectral.ts).
  spectral: boolean;
  // Dire (mec113.dire): read from the current quest card by families/black-gate/dire.ts.
  dire: boolean;
  // PASS (dwd.locate-test): the card passes a locate test it is discarded for (families/long-dark/).
  pass: boolean;
  // Ambush (dwd.ambush): the enemy makes the players engagement checks against it when it enters play (families/encounter/ambush.ts).
  ambush: boolean;
  // The enemy prints X for its Attack and its hit points (rr.attachment-cards): a record sets them (families/nameless).
  statsX: boolean;
};

// A ship (dcce.ships): a ship-enemy is an enemy and a ship-objective an objective ally for every purpose (`type` says which), with the
// exceptions in dcce.ship-enemies and dcce.ship-objectives (families/sea/ships.ts).
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
  // The card prints X for its quest points: a record sets them (Hills of Wilderland), so the card takes progress and is explored.
  questPointsX: boolean;
  victory: number | null;
  isUnique: boolean;
  engagementCost: number | null;
  keywords: Keywords;
  leavesPlayLoses: boolean;
  // A boon or burden (Campaign Mode), its burden set, and the deck it joins when it is in the campaign pool.
  campaignKind: "boon" | "burden" | "treasure" | null;
  burdenSet: string | null;
  backType: "player" | "encounter" | null;
  // An Objective-Location (Lost in Mirkwood, 18029 to 18032): an objective card that the players travel to, that takes progress as the active location and goes to the victory display explored. `type` stays "objective" (it is guarded, claimed and revealed as an objective).
  objectiveLocation: boolean;
  // The printed type line ("Objective Ally", "Ship-objective"), empty where the source gives none; the table's preview names an objective by it.
  typeName: string;
  // The copies the card allows in a deck, when the catalog states it (rr.deckbuilding; read by AddEventsToHand, 40009:B:2). Absent where the engine never needs it.
  deckLimit?: number | null;
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
  regenerate: null,
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
  eyeIcons: null,
  uncharted: false,
  aflame: null,
  burn: null,
  siegeValue: null,
  pillage: null,
  grapple: null,
  phantom: false,
  spectral: false,
  dire: false,
  pass: false,
  ambush: false,
  statsX: false,
};

// The Upgraded side's stats of a data/cards record, when its side B prints all four (dcce.scalable-upgradable), or a location's side B that prints a Threat.
function upgradedOfBack(back: Card["back"] | undefined): UpgradedStats | null {
  // A location's other side prints a Threat and no combat stats (the Temple of the Deceived side of a map location, Threat 4; dcce.uncharted).
  if (back?.threat != null && back.attack == null && back.defense == null && back.health == null) return { threat: back.threat, attack: 0, defense: 0, health: 0 };
  if (back?.attack == null || back.defense == null || back.health == null) return null;
  return { ...(back.willpower != null ? { willpower: back.willpower } : {}), ...(back.threat != null ? { threat: back.threat } : {}), ...(back.engagementCost != null ? { engagementCost: back.engagementCost } : {}), attack: back.attack, defense: back.defense, health: back.health, ...(back.victory != null ? { victory: back.victory } : {}) };
}

// Whether the card has quest points: a printed number, or X that a record sets (the card prints it as `questPointsX`).
export function hasQuestPoints(printed: PrintedCard): boolean {
  return printed.questPoints != null || printed.questPointsX;
}

// Whether the card is a location for travel, exploring, progress and the victory display: a location, or an Objective-Location.
export function isLocationCard(printed: PrintedCard): boolean {
  return printed.type === "location" || printed.objectiveLocation;
}

// Whether the instance with this id is a location card (isLocationCard).
export function isLocationId(state: { cards: Readonly<Record<string, { code: string } | undefined>> }, id: string | null | undefined, cards: ReadonlyMap<string, PrintedCard>): boolean {
  const card = id ? state.cards[id] : undefined;
  return card != null && isLocationCard(printedOf(cards, card.code));
}

// The card type a card in play has: an ally among its controller's heroes (the zone heroType puts it in, families/play/sweep.ts) lost
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
    questPointsX: false,
    victory: null,
    isUnique: false,
    engagementCost: null,
    leavesPlayLoses: false,
    campaignKind: null,
    burdenSet: null,
    backType: null,
    ship: null,
    objectiveLocation: false,
    typeName: "",
    encounterSet: null,
    upgraded: null,
    ...card,
    keywords: { ...EMPTY_KEYWORDS, ...card.keywords },
  };
}

// The code of the "Orc Guard" a deck card becomes in Escape from Dol Guldur (01107:A:1, 01125:B:1): not a printed card but a stand-in the
// engine creates, "an enemy with 1 hit point, 1 Attack and 1 Defense" (families/dungeon/guard.ts). Every card map knows it.
export const ORC_GUARD_CODE = "orc-guard";
const BUILT_IN: ReadonlyMap<string, PrintedCard> = new Map([
  [ORC_GUARD_CODE, definePrinted({ code: ORC_GUARD_CODE, name: "Orc Guard", type: "enemy", threat: 0, engagementCost: 0, attack: 1, defense: 1, health: 1 })],
]);

// A hero that Fallen Into Evil (142083) made an enemy keeps its card with the code `<code>~enemy`: "Attached hero loses the hero card type and gains the enemy
// card type with Threat equal to its Willpower and engagement cost equal to its threat cost". The printed card is made from the hero's; its game text is blank.
export const FALLEN_SUFFIX = "~enemy";
const FALLEN = new WeakMap<PrintedCard, PrintedCard>();

// A Ship enemy that a player took control of as a Ship-objective (Corsair Skirmisher, 12125:A:3) keeps its card with the code `<code>~ship`: "It loses the Ship-Enemy card type and gains the Ship-Objective
// card type ... with Willpower equal to its Threat". The printed card is made from the enemy's: its Attack, Defense, hit points, Traits and keywords stay, its Threat and engagement cost go, and its game
// text is blank (the Response was for the enemy). The sea family turns the card back into the enemy when it leaves play (families/sea/skirmisher.ts).
export const SHIP_SUFFIX = "~ship";

// A player card reanimated (The Dread Realm, mec108.reanimated-dead) keeps its card with the code `<code>~dead`: it lies facedown and acts as an Undead enemy with 0 engagement cost, 2 Threat, 2 Attack, 2 Defense and 2 hit points, with no game text of its own. The
// engine puts the printed code back when the card leaves play, for its owner's discard pile (zones.ts moveCard). Only a card with this code is affected, so no other game reads it.
export const DEAD_SUFFIX = "~dead";
const DEAD = new WeakMap<PrintedCard, PrintedCard>();

/** Whether the code is that of a Reanimated Dead (a card turned facedown into an Undead enemy). */
export function isReanimatedCode(code: string): boolean {
  return code.endsWith(DEAD_SUFFIX);
}

/** The printed code of a card turned into a Reanimated Dead. The table never shows it (picture-key.ts keeps the suffix, so a facedown player card is never drawn as its face or named by it). */
export function reanimatedBase(code: string): string {
  return isReanimatedCode(code) ? code.slice(0, -DEAD_SUFFIX.length) : code;
}

function reanimatedOf(card: PrintedCard): PrintedCard {
  let made = DEAD.get(card);
  if (!made) {
    made = definePrinted({ code: card.code + DEAD_SUFFIX, name: "Reanimated Dead", type: "enemy", traits: ["Undead"], threat: 2, engagementCost: 0, attack: 2, defense: 2, health: 2 });
    DEAD.set(card, made);
  }
  return made;
}
const SHIPPED = new WeakMap<PrintedCard, PrintedCard>();

// The code of a ship-objective made from a Ship enemy, and the enemy's own code for it.
export function shipObjectiveCode(code: string): string {
  return code + SHIP_SUFFIX;
}
export function isShipObjectiveCode(code: string): boolean {
  return code.endsWith(SHIP_SUFFIX);
}

// The card's own code for the code of a derived card (a fallen hero or a Ship enemy taken as a Ship-objective), or the code itself.
export function fallenBase(code: string): string {
  if (code.endsWith(SHIP_SUFFIX)) return code.slice(0, -SHIP_SUFFIX.length);
  return code.endsWith(FALLEN_SUFFIX) ? code.slice(0, -FALLEN_SUFFIX.length) : code;
}

function shipObjectiveOf(enemy: PrintedCard): PrintedCard {
  let made = SHIPPED.get(enemy);
  if (!made) {
    made = definePrinted({
      code: shipObjectiveCode(enemy.code),
      name: enemy.name,
      type: "objective",
      ship: "objective",
      traits: enemy.traits,
      willpower: enemy.threat ?? 0,
      attack: enemy.attack,
      defense: enemy.defense,
      health: enemy.health,
      isUnique: false,
      encounterSet: enemy.encounterSet,
      keywords: { ...enemy.keywords, boarding: null },
    });
    SHIPPED.set(enemy, made);
  }
  return made;
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
  const dead = isReanimatedCode(code) ? cards.get(reanimatedBase(code)) : undefined;
  if (dead) return reanimatedOf(dead);
  const enemy = code.endsWith(SHIP_SUFFIX) ? cards.get(fallenBase(code)) : undefined;
  if (enemy) return shipObjectiveOf(enemy);
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

// A card the scenario owns (rr.ownership-and-control: "The scenario is considered to be the owner of the encounter deck and each encounter card"): an encounter card of an encounter set. An objective ally with no encounter set (Mendor, Gwaihir)
// is a campaign card a player adds to their deck, so a player owns it.
export function scenarioOwned(printed: PrintedCard): boolean {
  return fromEncounterDeck(printed) && printed.encounterSet != null && printed.encounterSet !== "";
}

// A quest card (mec108.side-quests: "Side quests are a new type of quest card"): a quest stage, an encounter side quest or a player side quest.
export function isQuestCardType(type: CardType): boolean {
  return type === "quest" || isSideQuestType(type);
}

// A side quest, encounter or player (mec108.side-quests).
export function isSideQuestType(type: CardType): boolean {
  return type === "encounter-side-quest" || type === "player-side-quest";
}

// A card played onto a host from the hand: an attachment, or a treasure, which prints a cost and an "Attach to" line
// (emce.treasure, rr.attachment-cards).
export function playsOntoHost(printed: PrintedCard): boolean {
  return printed.type === "attachment" || printed.type === "treasure";
}

// A treasure is a player card ("Treasure is a new type of player card", emce.treasure).
export function isPlayerType(printed: PrintedCard): boolean {
  return isCharacterType(printed) || printed.type === "attachment" || printed.type === "event" || printed.type === "player-side-quest" || printed.type === "contract" || printed.type === "treasure";
}

const CARD_TYPES: readonly CardType[] = ["hero", "ally", "attachment", "event", "enemy", "location", "treachery", "quest", "objective", "treasure", "campaign", "nightmare", "player-side-quest", "contract", "encounter-side-quest"];
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
    // An enemy that prints X for its hit points (`statsX`) has 0 until a record sets them, so the damage rule reads them as a number.
    health: card.health ?? (keywords.statsX === true ? 0 : null),
    questPoints: card.questPoints,
    questPointsX: keywords.questPointsX === true,
    victory: card.victory,
    isUnique: card.isUnique,
    engagementCost: card.engagementCost,
    leavesPlayLoses: keywords.leavesPlayLoses === true,
    campaignKind: card.campaignKind,
    burdenSet: card.burdenSet,
    backType: card.backType,
    ship,
    objectiveLocation: card.typeName === "Objective Location",
    typeName: card.typeName ?? "",
    encounterSet: card.encounterSet,
    upgraded: card.upgraded ?? upgradedOfBack(card.back),
    keywords: {
      surge: keywords.surge === true,
      hide: keywords.hide ?? null,
      doomed: keywords.doomed ?? null,
      regenerate: keywords.regenerate ?? null,
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
      eyeIcons: keywords.eyeIcons ?? null,
      uncharted: keywords.uncharted === true,
      aflame: keywords.aflame ?? null,
      burn: keywords.burn ?? null,
      siegeValue: keywords.siegeValue ?? null,
      pillage: keywords.pillage ?? null,
      grapple: keywords.grapple ?? null,
      phantom: keywords.phantom === true,
      spectral: keywords.spectral === true,
      dire: keywords.dire === true,
      pass: keywords.pass === true,
      ambush: keywords.ambush === true,
      statsX: keywords.statsX === true,
    },
  });
}
