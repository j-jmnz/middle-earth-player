// Conditions: when a record applies, a verb runs or an option is offered. `src/catalog/effect-schema-conditions.ts` owns the kinds; `not`, `all` and `any` combine the others one level deep.
import { cardRef as cardRefWords, renderAmount } from "./amounts.ts";
import { done, isObj, jsonOf, str, withArticle, type Ctx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";
import { ESCAPE_CONDITIONS } from "./families/escape.ts";
import { GUARDIAN_CONDITIONS } from "./families/guardian.ts";
import { ERECH_CONDITIONS } from "./families/erech.ts";
import { FOG_CONDITIONS } from "./families/fog.ts";
import { INVESTIGATION_CONDITIONS } from "./families/investigation.ts";
import { LONG_DARK_CONDITIONS } from "./families/long-dark.ts";
import { SHARED_CONDITIONS } from "./shared-conditions.ts";
import { FAMILY_CONDITIONS } from "./families.ts";

export { ESCAPE_CONDITION_SAMPLES } from "./families/escape.ts";
export { GUARDIAN_CONDITION_SAMPLES } from "./families/guardian.ts";
export { ERECH_CONDITION_SAMPLES } from "./families/erech.ts";
export { FOG_CONDITION_SAMPLES } from "./families/fog.ts";
export { INVESTIGATION_CONDITION_SAMPLES } from "./families/investigation.ts";
export { LONG_DARK_CONDITION_SAMPLES } from "./families/long-dark.ts";
export { SHARED_CONDITION_SAMPLES } from "./shared-conditions.ts";

const ZONE: Readonly<Record<string, string>> = {
  activeLocation: "is the active location",
  staging: "is in the staging area",
  engaged: "is engaged with a player (that player is who \"you\" means in this record)",
  questStage: "is the quest stage",
  play: "is in play",
  victory: "is in the victory display",
  hand: "is in its player's hand",
  stormcallerArea: "is in the Stormcaller's area",
  encounterDeck: "is in the encounter deck",
  attached: "is attached to a card",
};

const range = (min: unknown, max: unknown): string => {
  const parts = [typeof min === "number" ? `at least ${min}` : "", typeof max === "number" ? `at most ${max}` : ""].filter((part) => part !== "");
  return parts.join(" and ");
};

// One template per condition kind; a kind with none prints as JSON. A template returns its text and the keys it read.
type Template = (c: Obj, ctx: Ctx) => { text: string; read: readonly string[] } | null;

export const CONDITION_TEMPLATES: Readonly<Record<string, Template>> = {
  ...ESCAPE_CONDITIONS,
  ...GUARDIAN_CONDITIONS,
  ...ERECH_CONDITIONS,
  ...FOG_CONDITIONS,
  ...INVESTIGATION_CONDITIONS,
  ...LONG_DARK_CONDITIONS,
  ...SHARED_CONDITIONS,
  ...FAMILY_CONDITIONS,
  sourceIn: (c) => ({ text: `this card ${ZONE[str(c.zone)] ?? `is in ${str(c.zone)}`}`, read: ["zone"] }),
  less: (c, ctx) => ({ text: `${renderAmount(c.left, ctx, renderPick)} is less than ${renderAmount(c.right, ctx, renderPick)}`, read: ["left", "right"] }),
  subjectExplored: () => ({ text: "the card the event is about had enough progress to be explored", read: [] }),
  x: (c) => ({ text: `X is at least ${str(c.min)} (X is the number the running effect counted; in an after-attack step, the characters the attack destroyed)`, read: ["min"] }),
  shadowBlank: () => ({ text: "the enemy held a shadow card with no shadow effect (read when the attack ends, as the card the event is about)", read: [] }),
  namedFlag: (c) => ({ text: `the card in play titled "${str(c.name)}" holds the flag ${str(c.stat)}`, read: ["name", "stat"] }),
  flag: (c) => ({ text: `${c.holder === "seat" ? "the actor's seat" : c.holder === "table" ? "the table" : "this card"} ${c.is === false ? "does not hold" : "holds"} the flag ${str(c.stat)}`, read: ["stat", "holder", "is"] }),
  canPick: (c, ctx) => ({ text: `there is a ${renderPick(c.pick, ctx)} to choose`, read: ["pick"] }),
  optionTaken: (c) => ({ text: `the running effect took the option "${str(c.id)}" (a choice made earlier in it, or the stage picked at random)`, read: ["id"] }),
  attackedThisPhase: (c) => ({ text: `"${str(c.name)}" has resolved an attack this phase`, read: ["name"] }),
  lastFortitudeFailed: () => ({ text: "the last Fortitude test the running effect made was failed (false before it has made one)", read: [] }),
  lastFortitudePassed: () => ({ text: "the last Fortitude test the running effect made was passed (false before it has made one)", read: [] }),
  fortitudeFailed: (c) => ({ text: `${c.who === "any" ? "any player has" : "the actor has"} failed a Fortitude test this ${str(c.scope)}`, read: ["scope", "who"] }),
  hostControlledByActor: () => ({ text: "the card this one is attached to is controlled by the acting player", read: [] }),
  phaseEnded: (c) => ({ text: `the ${str(c.is)} phase has just ended`, read: ["is"] }),
  phase: (c) => ({ text: `it is the ${str(c.is)} phase`, read: ["is"] }),
  hasEngaged: (c) => ({ text: `the actor has ${typeof c.trait === "string" ? `a ${c.trait} ` : "an "}enemy engaged`, read: ["trait"] }),
  exhausted: (c) => ({ text: `the card with code ${str(c.code)} in play is ${c.is === true ? "exhausted" : "ready"}`, read: ["code", "is"] }),
  count: (c, ctx) => ({ text: `the number of ${renderPick(c.pick, ctx)} is ${range(c.min, c.max)}`, read: ["pick", "min", "max"] }),
  threat: (c) => ({ text: `the actor's threat is ${range(c.min, c.max)}`, read: ["min", "max"] }),
  enemyInPlay: (c) => ({ text: `${c.is === true ? "there is" : "there is no"} ${typeof c.trait === "string" ? `${c.trait} ` : ""}enemy in play (in the staging area or engaged${c.other === true ? ", other than this card" : ""})`, read: ["trait", "other", "is"] }),
  discardedHasShadowOrTentacle: () => ({ text: "the encounter card this effect just discarded from the top of the deck has a shadow effect (a printed Shadow line) or is a Tentacle enemy (false when nothing was discarded)", read: [] }),
  firstLetterMatches: () => ({ text: "the title of the encounter card this effect just discarded starts with the same letter (case and accents aside) as the title of a player card this effect had discarded from a hand (false when nothing was discarded)", read: [] }),
  inVictory: (c) => ({ text: `the card with code ${str(c.code)} ${c.is === true ? "is" : "is not"} in the victory display`, read: ["code", "is"] }),
  inPlay: (c) => ({ text: `the card with code ${str(c.code)} ${c.is === true ? "is" : "is not"} in play`, read: ["code", "is"] }),
  faceUp: (c) => ({ text: `this card shows side ${str(c.side)}`, read: ["side"] }),
  freeOfEncounters: () => ({ text: "no encounter card is attached to this card (it is free of encounters)", read: [] }),
  firstPlayer: () => ({ text: "the actor holds the first player token", read: [] }),
  lastPlayer: () => ({ text: "the actor is the last player (to the first player's right; the only player of a solo game)", read: [] }),
  otherPlayer: () => ({ text: "another player is still in the game", read: [] }),
  handHasCard: () => ({ text: "the actor has a card in hand", read: [] }),
  undefended: (c) => ({ text: c.is === false ? "the attack has a defender" : "the attack has no defender", read: ["is"] }),
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
  questProgressNoted: (c) => ({ text: typeof c.min === "number" ? `${c.is === false ? "fewer than " : ""}${c.min} or more progress was placed on the current quest card this quest phase in all (the quest card itself; progress an active location took does not count)` : c.is === false ? "no progress was placed on the current quest card this quest phase (the quest card itself; progress an active location took does not count)" : "progress was placed on the current quest card this quest phase (the quest card itself, the overflow of an explored active location included)", read: ["is", "min"] }),
  currentQuestProgress: (c) => ({ text: c.is === "some" ? "the current quest card holds 1 or more progress" : "the current quest card holds no progress (neither is true while there is no current quest)", read: ["is"] }),
  versusDefender: (c) => ({ text: `the card holding this stat is an enemy attacking a declared defender${c.ally === true ? " that is an ally" : ""}${typeof c.maxHitPoints === "number" ? ` with ${c.maxHitPoints} or fewer printed hit points` : ""}${typeof c.maxWillpower === "number" ? ` with a current Willpower of ${c.maxWillpower} or less (modifiers counted)` : ""}`, read: ["ally", "maxHitPoints", "maxWillpower"] }),
  defendingAgainst: (c) => ({ text: `the card holding this stat (its host, or this card itself) is the declared defender of the attack against a ${str(c.trait)} enemy`, read: ["trait"] }),
  attacking: (c, ctx) => ({ text: `${c.card === "host" ? "its host" : "this card"} is attacking${isObj(c.enemy) ? ` a ${renderPick(c.enemy, ctx)}` : ""}${isObj(c.notEnemy) ? ` that is not a ${renderPick(c.notEnemy, ctx)}` : ""}${c.alone === true ? ", alone" : ""}${c.ranged === true ? ", with a ranged attack" : ""}`, read: ["card", "enemy", "notEnemy", "alone", "ranged"] }),
  committedThisRound: () => ({ text: "a hero of any player was committed to the quest this round (a hero committed when the commit step ended still counts after a card removes it from the quest)", read: [] }),
  hitPointsLeft: (c) => ({ text: `the card with code ${str(c.code)} in play has damage below its hit points (any hit points remaining)`, read: ["code"] }),
  timeOfDay: (c) => ({ text: `it is ${c.is === "day" ? "Day (Daybreak is faceup)" : "Night (Nightfall is faceup)"}`, read: ["is"] }),
  safeActive: (c) => ({ text: c.is === false ? "no location with the safe keyword is the active location" : "a location with the safe keyword is the active location", read: ["is"] }),
  setAsideHas: (c) => ({ text: `a copy of the card with code ${str(c.code)} is set aside, out of play`, read: ["code"] }),
  searchable: (c) => ({ text: `the encounter deck or its discard pile holds ${withArticle(`${typeof c.trait === "string" ? `${c.trait} ` : ""}${typeof c.type === "string" ? (c.type === "encounter-side-quest" ? "side quest" : str(c.type)) : "card"}`)}${typeof c.code === "string" ? ` with code ${c.code}` : ""}${c.deckOnly === true ? " (the deck alone)" : ""}${c.victory === true ? " (the victory display too)" : ""}`, read: ["trait", "type", "code", "deckOnly", "victory"] }),
  firstTreachery: () => ({ text: "the card the event is about is the first treachery the encounter deck revealed this quest phase", read: [] }),
  victoryPoints: (c) => ({ text: `the victory display holds at least ${str(c.min)} Victory points`, read: ["min"] }),
  stageProgress: (c) => ({ text: `the current quest stage holds at least ${str(c.min)} progress${c.perStartedPlayer === true ? " for each player who started the game" : ""}`, read: ["min", "perStartedPlayer"] }),
  questLeads: () => ({ text: "the total Willpower of the characters committed to the quest is greater than the total Threat in the staging area", read: [] }),
  soleAttacker: () => ({ text: "exactly one character was declared as an attacker in this attack", read: [] }),
  captives: (c) => ({ text: `the number of Captives in play${c.of === "actor" ? " that belong to the acting seat" : ""} is ${range(c.min, c.max)}`, read: ["min", "max", "of"] }),
  matches: (c, ctx) => {
    const subject = typeof c.card === "string" ? cardRefWords(c.card) : "the card";
    const where = [c.inPlay === false ? "out of play now" : c.inPlay === true ? "in play now" : "", c.inStaging === true ? "in the staging area" : c.inStaging === false ? "not in the staging area" : ""].filter((part) => part !== "").join(" and ");
    const kind = c.pick === undefined ? "" : `a ${renderPick(c.pick, ctx)}`;
    const text = kind === "" ? `${subject} is ${where === "" ? "any card" : where}` : `${subject} is ${kind}${where === "" ? "" : ` that is ${where}`}`;
    return { text, read: ["card", "pick", "inPlay", "inStaging"] };
  },
  tokens: (c) => ({ text: `the card with code ${str(c.code)} in play holds at least ${str(c.min)} resource token(s)${c.perPlayer === true ? " for each player" : ""}`, read: ["code", "min", "perPlayer"] }),
  controls: (c) => ({ text: `${c.who === "anyPlayer" ? "a player" : "the actor"} controls the card with code ${str(c.code)}`, read: ["code", "who"] }),
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
