// Amounts: a printed number, or a number the engine reads ("the number of enemies in play", "the stage number"). `src/catalog/effect-schema-amount.ts` owns the keys.
import { done, isObj, jsonOf, str, type Ctx, type Obj } from "./kit.ts";
import { familyAmount } from "./families/family-amounts.ts";
import type { PickRenderer } from "./picks.ts";

const CARD_REF: Readonly<Record<string, string>> = {
  self: "this card",
  host: "its host",
  picked: "the picked card",
  subject: "the card the event is about",
  other: "the event's other card",
  attacker: "the attacking enemy",
  defender: "the defender",
  activeLocation: "the active location",
  previous: "the card picked before",
  discardTop: "the top card of the encounter discard pile",
  questStage: "the current quest stage",
};

export const cardRef = (ref: unknown): string => CARD_REF[str(ref)] ?? str(ref);

const STAT: Readonly<Record<string, string>> = { hitPoints: "hit points", engagementCost: "engagement cost", questPoints: "quest points", threatCost: "threat cost" };
const statName = (stat: unknown): string => STAT[str(stat)] ?? str(stat);

// The value an amount expression reads, before `times`, `plus` and `limit`.
function base(expr: Obj, ctx: Ctx, pick: PickRenderer): { text: string; read: string[] } | null {
  const read: string[] = [];
  const take = (...keys: string[]): void => void read.push(...keys);
  if (isObj(expr.count)) {
    take("count", "distinct");
    return { text: `the number of ${expr.distinct === true ? "different " : ""}${pick(expr.count, ctx)}`, read };
  }
  if (isObj(expr.totalOf)) {
    take("totalOf", "stat");
    return { text: `${expr.stat === "cost" ? "the printed costs (a card with none counts 0)" : `the ${statName(expr.stat)} as the table shows it now`} of every ${pick(expr.totalOf, ctx)} added up, read live`, read };
  }
  if (typeof expr.stat === "string") {
    take("stat", "of", "ofNamed", "printed", "remaining");
    const whose = typeof expr.ofNamed === "string" ? `"${expr.ofNamed}"` : cardRef(expr.of ?? "self");
    // `remaining` (hit points): what the card has left, its hit points less its damage and at least 0.
    return { text: `${expr.remaining === true ? "remaining " : ""}${expr.printed === true ? "printed " : ""}${statName(expr.stat)} of ${whose}${expr.remaining === true ? " (its hit points less its damage, at least 0)" : ""}`, read };
  }
  if (expr.startedPlayers === true) return { text: "the number of players who started the game, an eliminated one included", read: ["startedPlayers"] };
  if (expr.players === true) return { text: "the number of players", read: ["players"] };
  if (expr.remainingQuestPoints === "activeLocation") return { text: "the quest points the active location still needs (its quest points less its progress; 0 with no active location)", read: ["remainingQuestPoints"] };
  if (expr.victoryPoints === true) return { text: "the Victory points of the cards in the victory display added up (read live)", read: ["victoryPoints"] };
  if (typeof expr.namelessCost === "number") return { text: `the total printed cost of the player cards attached to this card from the top of a deck (a hero, an X cost or no printed cost counts 0), or ${expr.namelessCost} when none is attached`, read: ["namelessCost"] };
  if (expr.playersAtStage === true) return { text: "the number of players at the acting player's staging area (every player before the areas are separate)", read: ["playersAtStage"] };
  if (expr.stagingThreat === true) return { text: "the total Threat of all cards in the staging area now", read: ["stagingThreat"] };
  if (typeof expr.pile === "string") return { text: `the number of cards left in the ${expr.pile === "harad" ? "Harad" : str(expr.pile)} deck`, read: ["pile"] };
  if (expr.highestThreat === true) return { text: "the highest threat among the living players", read: ["highestThreat"] };
  if (typeof expr.playersAtThreat === "number") return { text: `the number of living players with a threat of ${expr.playersAtThreat} or higher`, read: ["playersAtThreat"] };
  if (expr.lakeTownDamage === true) return { text: "the damage on Lake-town", read: ["lakeTownDamage"] };
  if (expr.victoryDisplay === true) return { text: "the Victory points in the victory display", read: ["victoryDisplay"] };
  if (expr.siegeTally === true) return { text: "the Siege values added up this round: each enemy destroyed and each location explored adds its printed Siege value", read: ["siegeTally"] };
  if (expr.pursuit === true) return { text: "the pursuit value", read: ["pursuit"] };
  if (expr.questCards === true) return { text: "the number of quest cards in play (the main quest card, each encounter side quest in the staging area and each player side quest; at least 1)", read: ["questCards"] };
  if (expr.stagesNoProgress === true) return { text: "the number of quest stages in play with no progress on them (stages 2 to 4 in play together, the only stage before them, stage 5 after)", read: ["stagesNoProgress"] };
  if (expr.timeOfActive === true) return { text: "the printed Time X value of the active location (0 with none)", read: ["timeOfActive"] };
  if (expr.shadowCardsInPlay === true) return { text: "the number of shadow cards dealt to the enemies in play (in the staging area and engaged)", read: ["shadowCardsInPlay"] };
  if (expr.discardPileMaxCost === true) return { text: "the highest printed cost among the cards in the acting player's discard pile (0 for none, a hero or an X cost)", read: ["discardPileMaxCost"] };
  if (expr.discarded === "cost") return { text: "the combined printed cost of the cards this effect has discarded from decks (a card with no printed cost counts 0)", read: ["discarded"] };
  if (expr.discarded === "types") return { text: "the number of different card types among the cards this effect has discarded from decks, all the players' together", read: ["discarded"] };
  if (expr.investigateValue === true) return { text: "the Investigate value of the active location (its printed Investigate X; 0 with no active location or none printed)", read: ["investigateValue"] };
  if (expr.discardedEncounterTypes === true) return { text: "the number of different card types among the cards this effect discarded from the top of the encounter deck (enemy, location, treachery, objective and side quest each their own)", read: ["discardedEncounterTypes"] };
  if (expr.discardedThreat === true) return { text: "the total printed Threat of the cards this effect discarded from the top of the encounter deck (a card with no printed Threat counts 0)", read: ["discardedThreat"] };
  if (isObj(expr.discardedMatching)) return { text: `the number of cards this effect discarded from the top of the encounter deck, still in the discard pile, that are ${pick(expr.discardedMatching, ctx)}`, read: ["discardedMatching"] };
  if (expr.destroyedWillpower === true) return { text: "the Willpower the destroyed character had in play (last known)", read: ["destroyedWillpower"] };
  if (expr.facedown === true) return { text: "the number of cards attached facedown to this card", read: ["facedown"] };
  if (typeof expr.facedownUnder === "string") return { text: `the number of cards facedown underneath the card in play with code ${expr.facedownUnder} (0 when it is not in play)`, read: ["facedownUnder"] };
  if (expr.firstPlayerTens === true) return { text: "the tens digit of the first player's threat, whoever the actor is", read: ["firstPlayerTens"] };
  if (isObj(expr.mostPerPlayer)) return { text: `the most ${pick(expr.mostPerPlayer, ctx)} any one player controls, each player counted from their own side`, read: ["mostPerPlayer"] };
  if (expr.guardedCost === true) return { text: "the printed cost of the card this card guards (one under it, or the host it guards as a guard; 0 for a card with no printed cost)", read: ["guardedCost"] };
  if (expr.discoverValue === true) return { text: "the Discover value of the active location (its Discover X, with the adjustment a Response made; 0 when it has none)", read: ["discoverValue"] };
  if (expr.x === true) return { text: "X", read: ["x"] };
  if (expr.stage === true) return { text: "the stage number of the main quest (also while a side quest is the current quest)", read: ["stage"] };
  if (typeof expr.threat === "string") return { text: expr.threat === "tens" ? "the tens digit of your threat" : "your threat", read: ["threat"] };
  if (expr.hand === true) return { text: "the cards in your hand", read: ["hand"] };
  if (expr.attackDamage === true) return { text: "the damage the player attack this effect answers would deal this enemy: the attackers' total Attack less this enemy's Defense (0 at the least)", read: ["attackDamage"] };
  if (expr.dealt === true) return { text: "the damage just dealt", read: ["dealt"] };
  if (isObj(expr.archeryOf)) return { text: `the total archery value (printed, gained and what the card gives itself) of the card with the most among ${pick(expr.archeryOf, ctx)}, 0 when none`, read: ["archeryOf", "max"] };
  if (isObj(expr.resourcesOn)) return { text: `the resource tokens on ${pick(expr.resourcesOn, ctx)}${expr.max === true ? " (the most on any one)" : ""}`, read: ["resourcesOn", "max"] };
  if (isObj(expr.damageOn)) return { text: `the damage tokens on ${pick(expr.damageOn, ctx)}`, read: ["damageOn"] };
  return familyAmount(expr);
}

/** The N of an amount that tops the actor's hand up to N cards ({ hand, times: -1, plus: N }: "draw until you have N cards in hand"), or null for any other amount. A hand of N or more gives 0 or less, which draws nothing. */
export function topUpTo(amount: unknown): number | null {
  if (!isObj(amount) || amount.hand !== true || amount.times !== -1 || typeof amount.plus !== "number" || amount.plus <= 0) return null;
  return amount.every === undefined && amount.limit === undefined && amount.negative === undefined ? amount.plus : null;
}

export function renderAmount(amount: unknown, ctx: Ctx, pick: PickRenderer): string {
  if (typeof amount === "number") return String(amount);
  if (!isObj(amount)) return jsonOf(ctx, "amount", amount);
  const found = base(amount, ctx, pick);
  if (!found) return jsonOf(ctx, "amount", amount);
  let text = found.text;
  const read = [...found.read, "times", "plus", "limit", "every", "negative"];
  if (typeof amount.every === "number") text = `${text} divided by ${amount.every}, rounded down`;
  if (typeof amount.times === "number") text = `${text} x ${amount.times}`;
  if (typeof amount.plus === "number") text = `${text} ${amount.plus < 0 ? "-" : "+"} ${Math.abs(amount.plus)}`;
  if (typeof amount.limit === "number") text = `${text}, at most ${amount.limit}`;
  if (amount.negative === true) text = `minus (${text})`;
  return done(ctx, text, amount, read);
}

