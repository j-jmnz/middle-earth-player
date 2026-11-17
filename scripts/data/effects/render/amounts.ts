// Amounts: a printed number, or a number the engine reads ("the number of enemies in play", "the stage number"). `src/catalog/effect-schema-amount.ts` owns the keys.
import { done, isObj, jsonOf, str, type Ctx, type Obj } from "./kit.ts";
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
  if (typeof expr.stat === "string") {
    take("stat", "of", "ofNamed", "printed");
    const whose = typeof expr.ofNamed === "string" ? `"${expr.ofNamed}"` : cardRef(expr.of ?? "self");
    return { text: `${expr.printed === true ? "printed " : ""}${statName(expr.stat)} of ${whose}`, read };
  }
  if (expr.players === true) return { text: "the number of players", read: ["players"] };
  if (expr.stagingThreat === true) return { text: "the total Threat of all cards in the staging area now", read: ["stagingThreat"] };
  if (typeof expr.pile === "string") return { text: `the number of cards left in the ${expr.pile === "harad" ? "Harad" : str(expr.pile)} deck`, read: ["pile"] };
  if (expr.highestThreat === true) return { text: "the highest threat among the living players", read: ["highestThreat"] };
  if (typeof expr.playersAtThreat === "number") return { text: `the number of living players with a threat of ${expr.playersAtThreat} or higher`, read: ["playersAtThreat"] };
  if (expr.pursuit === true) return { text: "the pursuit value", read: ["pursuit"] };
  if (expr.questCards === true) return { text: "the number of quest cards in play (the main quest card, each encounter side quest in the staging area and each player side quest; at least 1)", read: ["questCards"] };
  if (expr.shadowCardsInPlay === true) return { text: "the number of shadow cards dealt to the enemies in play (in the staging area and engaged)", read: ["shadowCardsInPlay"] };
  if (expr.discardPileMaxCost === true) return { text: "the highest printed cost among the cards in the acting player's discard pile (0 for none, a hero or an X cost)", read: ["discardPileMaxCost"] };
  if (expr.discarded === "cost") return { text: "the combined printed cost of the cards this effect has discarded from decks (a card with no printed cost counts 0)", read: ["discarded"] };
  if (expr.discarded === "types") return { text: "the number of different card types among the cards this effect has discarded from decks, all the players' together", read: ["discarded"] };
  if (expr.discardedThreat === true) return { text: "the total printed Threat of the cards this effect discarded from the top of the encounter deck (a card with no printed Threat counts 0)", read: ["discardedThreat"] };
  if (expr.destroyedWillpower === true) return { text: "the Willpower the destroyed character had in play (last known)", read: ["destroyedWillpower"] };
  if (expr.x === true) return { text: "X", read: ["x"] };
  if (expr.stage === true) return { text: "the stage number of the quest", read: ["stage"] };
  if (typeof expr.threat === "string") return { text: expr.threat === "tens" ? "the tens digit of your threat" : "your threat", read: ["threat"] };
  if (expr.hand === true) return { text: "the cards in your hand", read: ["hand"] };
  if (expr.dealt === true) return { text: "the damage just dealt", read: ["dealt"] };
  if (isObj(expr.resourcesOn)) return { text: `the resource tokens on ${pick(expr.resourcesOn, ctx)}${expr.max === true ? " (the most on any one)" : ""}`, read: ["resourcesOn", "max"] };
  if (isObj(expr.damageOn)) return { text: `the damage tokens on ${pick(expr.damageOn, ctx)}`, read: ["damageOn"] };
  return null;
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

