// Conditions: when a record applies, a verb runs or an option is offered. `src/catalog/effect-schema-conditions.ts` owns the kinds; `not`, `all` and `any` combine the others one level deep.
import { cardRef as cardRefWords, renderAmount } from "./amounts.ts";
import { done, isObj, jsonOf, str, type Ctx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";

const ZONE: Readonly<Record<string, string>> = {
  activeLocation: "is the active location",
  staging: "is in the staging area",
  engaged: "is engaged with the player",
  questStage: "is the quest stage",
  play: "is in play",
  victory: "is in the victory display",
  hand: "is in its player's hand",
  stormcallerArea: "is in the Stormcaller's area",
  encounterDeck: "is in the encounter deck",
};

const range = (min: unknown, max: unknown): string => {
  const parts = [typeof min === "number" ? `at least ${min}` : "", typeof max === "number" ? `at most ${max}` : ""].filter((part) => part !== "");
  return parts.join(" and ");
};

// One template per condition kind; a kind with none prints as JSON. A template returns its text and the keys it read.
type Template = (c: Obj, ctx: Ctx) => { text: string; read: readonly string[] } | null;
export const CONDITION_TEMPLATES: Readonly<Record<string, Template>> = {
  sourceIn: (c) => ({ text: `this card ${ZONE[str(c.zone)] ?? `is in ${str(c.zone)}`}`, read: ["zone"] }),
  less: (c, ctx) => ({ text: `${renderAmount(c.left, ctx, renderPick)} is less than ${renderAmount(c.right, ctx, renderPick)}`, read: ["left", "right"] }),
  subjectExplored: () => ({ text: "the card the event is about had enough progress to be explored", read: [] }),
  x: (c) => ({ text: `X is at least ${str(c.min)} (X is the number the running effect counted; in an after-attack step, the characters the attack destroyed)`, read: ["min"] }),
  shadowBlank: () => ({ text: "the enemy held a shadow card with no shadow effect (read when the attack ends, as the card the event is about)", read: [] }),
  namedFlag: (c) => ({ text: `the card in play titled "${str(c.name)}" holds the flag ${str(c.stat)}`, read: ["name", "stat"] }),
  flag: (c) => ({ text: `${c.holder === "seat" ? "the actor's seat" : "this card"} ${c.is === false ? "does not hold" : "holds"} the flag ${str(c.stat)}`, read: ["stat", "holder", "is"] }),
  canPick: (c, ctx) => ({ text: `there is a ${renderPick(c.pick, ctx)} to choose`, read: ["pick"] }),
  attackedThisPhase: (c) => ({ text: `"${str(c.name)}" has resolved an attack this phase`, read: ["name"] }),
  lastFortitudeFailed: () => ({ text: "the last Fortitude test the running effect made was failed (false before it has made one)", read: [] }),
  lastFortitudePassed: () => ({ text: "the last Fortitude test the running effect made was passed (false before it has made one)", read: [] }),
  fortitudeFailed: (c) => ({ text: `${c.who === "any" ? "any player has" : "the actor has"} failed a Fortitude test this ${str(c.scope)}`, read: ["scope", "who"] }),
  hostControlledByActor: () => ({ text: "the card this one is attached to is controlled by the acting player", read: [] }),
  phase: (c) => ({ text: `it is the ${str(c.is)} phase`, read: ["is"] }),
  hasEngaged: (c) => ({ text: `the actor has ${typeof c.trait === "string" ? `a ${c.trait} ` : "an "}enemy engaged`, read: ["trait"] }),
  exhausted: (c) => ({ text: `the card with code ${str(c.code)} in play is ${c.is === true ? "exhausted" : "ready"}`, read: ["code", "is"] }),
  count: (c, ctx) => ({ text: `the number of ${renderPick(c.pick, ctx)} is ${range(c.min, c.max)}`, read: ["pick", "min", "max"] }),
  threat: (c) => ({ text: `the actor's threat is ${range(c.min, c.max)}`, read: ["min", "max"] }),
  inPlay: (c) => ({ text: `the card with code ${str(c.code)} ${c.is === true ? "is" : "is not"} in play`, read: ["code", "is"] }),
  faceUp: (c) => ({ text: `this card shows side ${str(c.side)}`, read: ["side"] }),
  firstPlayer: () => ({ text: "the actor holds the first player token", read: [] }),
  otherPlayer: () => ({ text: "another player is still in the game", read: [] }),
  handHasCard: () => ({ text: "the actor has a card in hand", read: [] }),
  undefended: () => ({ text: "the attack has no defender", read: [] }),
  questSucceeded: () => ({ text: "the quest succeeded", read: [] }),
  questFailed: () => ({ text: "the quest failed", read: [] }),
  logged: (c) => ({ text: `the Campaign Log ${c.is === false ? "does not hold" : "holds"} the line "${str(c.line)}"`, read: ["line", "is"] }),
  onStage: (c) => ({ text: `the players are on stage ${str(c.stage)}`, read: ["stage"] }),
  pileHas: (c) => ({ text: `the number of cards in the ${c.pile === "harad" ? "Harad" : str(c.pile)} deck is ${range(c.min, c.max)}`, read: ["pile", "min", "max"] }),
  facedownUnder: (c) => ({ text: `the number of cards facedown under the card with code ${str(c.code)} in play is ${range(typeof c.min === "number" ? c.min : undefined, c.max)}${c.players === true ? ", each plus the number of players" : ""}`, read: ["code", "min", "max", "players"] }),
  onDial: (c) => ({ text: `the actor's threat dial holds a copy of the card with code ${str(c.code)}`, read: ["code"] }),
  canAttachToDial: (c) => ({ text: `a copy of the card with code ${str(c.code)} is set aside and the actor's threat dial holds none`, read: ["code"] }),
  pursuit: (c) => ({ text: `the pursuit value is ${range(c.min, c.max)}`, read: ["min", "max"] }),
  currentQuest: (c) => ({ text: c.is === "side" ? "the current quest is a side quest" : c.is === "self" ? "this card is the current quest" : "there is a quest card besides the current quest that could be chosen to be the current quest (the main quest card, or an encounter side quest in the staging area)", read: ["is"] }),
  questLeads: (c) => ({ text: `the total Willpower of the characters committed to the quest is greater than the total Threat in the staging area${c.attacks === true ? ", and an enemy is in the staging area to attack" : ""}`, read: ["attacks"] }),
  soleAttacker: () => ({ text: "exactly one character was declared as an attacker in this attack", read: [] }),
  captives: (c) => ({ text: `the number of Captives in play${c.of === "actor" ? " that belong to the acting seat" : ""} is ${range(c.min, c.max)}`, read: ["min", "max", "of"] }),
  matches: (c, ctx) => ({ text: `${typeof c.card === "string" ? cardRefWords(c.card) : "the card"} is a ${renderPick(c.pick, ctx)}`, read: ["card", "pick"] }),
  controls: (c) => ({ text: `the actor controls the card with code ${str(c.code)}`, read: ["code"] }),
};

export function renderCondition(value: unknown, ctx: Ctx): string {
  if (!isObj(value) || typeof value.kind !== "string") return jsonOf(ctx, "condition", value);
  const kind = value.kind;
  if (kind === "not") return done(ctx, `not (${renderCondition(value.condition, ctx)})`, value, ["kind", "condition"]);
  if (kind === "all" || kind === "any") {
    const parts = Array.isArray(value.conditions) ? value.conditions.map((part) => renderCondition(part, ctx)) : [];
    return done(ctx, `${kind === "all" ? "all of" : "any of"}: ${parts.map((part) => `(${part})`).join(kind === "all" ? " and " : " or ")}`, value, ["kind", "conditions"]);
  }
  const template = CONDITION_TEMPLATES[kind];
  const made = template?.(value, ctx);
  if (!made) return jsonOf(ctx, "condition", value);
  return done(ctx, made.text, value, ["kind", ...made.read]);
}
