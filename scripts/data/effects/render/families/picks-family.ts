// The pick keys only one family or box reads, each worded from where the engine reads it (src/rules/interpret/pick.ts and src/rules/families/*/pick.ts; the key's comment in src/catalog/effect-schema-pick.ts). picks.ts calls this with its `note`.
import { isObj, str, type Obj } from "../kit.ts";

type Note = (keys: readonly string[], text: string | null) => void;

const ISLAND: Readonly<Record<string, string>> = {
  start: "that is a faceup left corner of the Island Map at Setup, before one is the active location",
  temple: "in the Temple column of the Island Map that lies facedown, wherever it is on the map",
  secret: "that is a card facedown under a Temple location (a secret)",
  here: "that is the secret under the active location",
  adjacent: "that is a copy of Lost Island (not Temple of the Deceived) next to the active location",
};
const CAPTURED: Readonly<Record<string, string>> = {
  underSelf: "captured underneath this card (any owner's; one its owner cannot put into play is left out)",
  rescued: "that the last rescue put into a hand and is still there",
  hosts: "among the encounter cards in play in the asking player's staging area (the staged cards, the active location and the enemies engaged with a player there)",
};
const SHARES: Readonly<Record<string, string>> = { self: "this card", host: "this card's host", other: "the event's other card", activeLocation: "the active location", attackingEnemy: "the enemy making the attack in progress" };
const EMBASSY: Readonly<Record<string, string>> = { player: "a player card of the Embassy's faceup row that is not paired yet", encounter: "an encounter card of the Embassy's faceup row that is not paired yet" };

function costBound(value: unknown): string | null {
  if (typeof value === "number") return `with a printed cost of ${value} or less`;
  if (isObj(value) && value.level === true) return `with a printed cost of X or less, X being the card's level in the Campaign Log${value.halved === true ? " (half of it rounded up)" : ""}${value.plusChosen === true ? " plus 1 for each copy the campaign card's Setup let the players choose" : ""} plus 1`;
  return null;
}

// The words of a `hasAttachment` object the older chain does not word: any mix of trait, player card, treasure, names and none.
export function attachmentWords(value: unknown): string | null {
  if (!isObj(value)) return null;
  const what = `${typeof value.trait === "string" ? `${value.trait} ` : ""}${value.playerCard === true ? "player-card " : ""}${value.treasure === true ? "treasure " : ""}attachment${Array.isArray(value.names) ? ` named ${value.names.map((one) => `"${str(one)}"`).join(" or ")}` : ""}`;
  return `${value.none === true ? "with no" : "with an"} ${what}`;
}

export function familyPickNotes(pick: Obj, note: Note): void {
  note(["unique"], pick.unique === false ? "(unique: false filters nothing: the engine reads only unique: true)" : null);
  note(["lootKeyword"], pick.lootKeyword === true ? "that prints the Loot keyword" : null);
  note(["minProgress"], typeof pick.minProgress === "number" ? `with at least ${pick.minProgress} progress on it` : null);
  note(["island"], typeof pick.island === "string" ? (ISLAND[pick.island] ?? pick.island) : null);
  note(["aflame"], pick.aflame === true ? "that prints the Aflame keyword" : pick.aflame === false ? "that does not print the Aflame keyword" : null);
  note(["lowestAflame"], pick.lowestAflame === true ? "with the lowest Aflame value of those (every one of them when tied, and then the chooser decides)" : null);
  note(["attackingEnemy"], pick.attackingEnemy === true ? "that is the enemy making the attack in progress" : pick.attackingEnemy === false ? "other than the enemy making the attack in progress" : null);
  note(["uncharted"], pick.uncharted === true ? "that is a double-sided location lying on its Lost Island side (Uncharted)" : pick.uncharted === false ? "that is not an Uncharted location" : null);
  note(["doubleSided"], pick.doubleSided === true ? "that is a double-sided location, whichever side it shows" : pick.doubleSided === false ? "that is not a double-sided location" : null);
  note(["nemesis"], pick.nemesis === true ? "that is the nemesis (the enemy the stage named, until it leaves play)" : null);
  note(["sameTitleAs"], pick.sameTitleAs === "activeLocation" ? "with the same title as the active location" : pick.sameTitleAs === "picked" ? "with the same title as the last card picked, never that card itself" : null);
  note(["guardsHero"], pick.guardsHero === true ? "that guards a hero, in play or not" : null);
  note(["hasFacedownUnder"], pick.hasFacedownUnder === true ? "with a facedown player card under it, wherever the card is now" : null);
  note(["facedownUnder"], pick.facedownUnder === true ? "(the cards counted are the facedown player cards under the holder, not its attachments)" : null);
  note(["guardsCard"], pick.guardsCard === true ? "that guards a card, as the guard of an objective or as the keeper of a player card held under it" : null);
  note(["guardsNamed"], typeof pick.guardsNamed === "string" ? `attached as the guard of the objective titled "${pick.guardsNamed}"` : null);
  note(["engagedThisRound"], pick.engagedThisRound === true ? "that engaged a player this round" : pick.engagedThisRound === false ? "that did not engage a player this round" : null);
  note(["objectiveLocation"], pick.objectiveLocation === true ? "that is an Objective-Location (its printed type line says so), in the staging area or the active location" : null);
  note(["notCardType"], typeof pick.notCardType === "string" ? `whose printed type is not ${pick.notCardType}` : null);
  note(["maxCost"], costBound(pick.maxCost));
  note(["fewerHitPointsThan"], pick.fewerHitPointsThan === "attackingEnemy" ? "with fewer printed hit points than the enemy making the attack in progress" : null);
  note(["captured"], typeof pick.captured === "string" ? (CAPTURED[pick.captured] ?? pick.captured) : null);
  note(["minResources"], typeof pick.minResources === "number" ? `with at least ${pick.minResources} resources on it` : null);
  note(["noVictory"], pick.noVictory === true ? "that prints no victory points" : pick.noVictory === false ? "that prints some victory points" : null);
  note(["maxDefense"], typeof pick.maxDefense === "number" ? `with a current Defense of ${pick.maxDefense} or less` : null);
  note(["minAttack"], typeof pick.minAttack === "number" ? `with a current Attack of at least ${pick.minAttack}` : null);
  note(["oddCost"], pick.oddCost === true ? "with an odd printed cost (a card with no printed cost, or with X, is not)" : null);
  note(["intoPlay"], pick.intoPlay === true ? "that can be put into play (a unique card with a copy in play, or one a play restriction bars, cannot be chosen)" : null);
  note(["heroSphere"], pick.heroSphere === true ? "whose printed sphere is the printed sphere of a hero the chooser controls (a neutral card, or a Fellowship hero, matches no sphere)" : null);
  note(["embassy"], typeof pick.embassy === "string" ? (EMBASSY[pick.embassy] ?? pick.embassy) : null);
  note(["burden"], pick.burden === true ? "that is a burden card (Campaign Mode) in play, in the encounter deck or in the encounter discard pile" : null);
  note(["side"], typeof pick.side === "string" ? `showing side ${pick.side}` : null);
  note(["sharesTrait"], typeof pick.sharesTrait === "string" ? `that shares at least one Trait with ${SHARES[pick.sharesTrait] ?? pick.sharesTrait} (never that card itself)` : null);
  note(["hostForPicked"], pick.hostForPicked === true ? "that the last picked attachment may be attached to" : null);
  note(["fromDeck"], pick.fromDeck === "evilCreatures" ? "dealt into the Evil Creatures deck, in play or not" : null);
}
