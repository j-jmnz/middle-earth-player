// Instructions: one small template per verb. A verb with none prints as compact JSON. `src/catalog/effect-schema-verbs.ts`, `effect-schema.ts` and each family's `VERBS` own the shapes.
// The structural verbs (Choose, Each, Delay, AfterAttack, Repeat, ForEachPlayer) hold instructions of their own and print them indented beneath.
import { cardRef, renderAmount } from "./amounts.ts";
import { renderCondition } from "./conditions.ts";
import { compact, done, isObj, jsonOf, joinAnd, quoted, str, type Ctx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";

type Made = { text: string; read: readonly string[]; children?: readonly Obj[] };
type Template = (ins: Obj, ctx: Ctx) => Made | null;

const amount = (value: unknown, ctx: Ctx): string => renderAmount(value, ctx, renderPick);
const pick = (value: unknown, ctx: Ctx): string => renderPick(value, ctx);
const WHO: Readonly<Record<string, string>> = { actor: "the acting player", firstPlayer: "the first player", picked: "the picked player", eventSeat: "the player the event is about", eachSeat: "each player" };
const who = (value: unknown): string => WHO[str(value)] ?? str(value);

// A target: a card reference (`self`) or a target object (`{ kind: "picked" }`).
function target(value: unknown): string {
  if (value === undefined) return "this card";
  if (isObj(value) && typeof value.kind === "string") return value.kind === "byCode" ? `the card with code ${str(value.code)}` : value.kind === "byName" ? `"${str(value.name)}"` : value.kind === "ref" ? cardRef(value.ref) : cardRef(value.kind);
  return cardRef(value);
}

const STAT_UNTIL: Readonly<Record<string, string>> = {
  endOfPhase: "until the end of the phase",
  endOfRound: "until the end of the round",
  endOfAttack: "until the end of the attack",
  whileSourceInPlay: "while this card is in play",
  whileSourceActive: "while this card is active",
  whileSourceInVictory: "while this card is in the victory display",
  endOfGame: "until the end of the game",
};

const plural = (noun: string, count: unknown): string => (count === 1 ? noun : noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`);
const DELAY_UNTIL: Readonly<Record<string, string>> = {
  endOfPhase: "at the end of this phase",
  endOfRound: "at the end of the round",
  questSucceeded: "if the players quest successfully this phase (never, if they do not)",
  questFailed: "if the players quest unsuccessfully this phase (never, if they do not)",
  endOfAttack: "when the attack ends",
  startOfGame: "once the opening hands are done, before the first round",
};
const TARGET_STAT: Readonly<Record<string, string>> = {
  stagingCards: "every enemy and location in the staging area, now and arriving there later while the effect lasts",
  heroes: "every hero in play",
  enemies: "every enemy in play",
  allies: "every ally in play, now and entering later",
  characters: "every character in play, now and entering later",
  attacker: "the attacking enemy",
  table: "the table",
  eachSeat: "each player",
};
const targetStat = (value: string): string => TARGET_STAT[value] ?? cardRef(value);
const untilWords = (until: unknown): string => STAT_UNTIL[str(until)] ?? str(until);

const TEMPLATES: Readonly<Record<string, Template>> = {
  ModifyStat: (i, ctx) => {
    const holders = isObj(i.holders) ? `each ${pick(i.holders, ctx)}` : typeof i.target === "string" ? targetStat(i.target) : "this card";
    const per = typeof i.per === "string" ? ` for each ${i.per}` : "";
    const trait = typeof i.trait === "string" ? ` (${i.trait} only)` : "";
    const sign = i.subtract === true ? "minus " : "";
    return { text: `${holders}${trait}: stat ${str(i.stat)} ${sign}${amount(i.amount, ctx)}${per}, ${untilWords(i.until)}`, read: ["stat", "amount", "until", "holders", "target", "per", "trait", "subtract"] };
  },
  Pick: (i, ctx) => ({ text: `choose ${pick(i.pick, ctx)}`, read: ["pick"] }),
  PlaceProgressOn: (i, ctx) => ({ text: `place ${amount(i.amount, ctx)} progress on ${cardRef(i.target)}`, read: ["amount", "target"] }),
  RemoveProgressFrom: (i, ctx) => ({ text: `remove ${amount(i.amount, ctx)} progress from "${str(i.named)}"`, read: ["amount", "named"] }),
  PlaceResourceTokens: (i, ctx) => ({ text: `place ${amount(i.amount, ctx)} resource tokens on ${cardRef(i.on)}`, read: ["amount", "on"] }),
  AddResources: (i, ctx) => ({ text: `add ${amount(i.amount, ctx)} resources to ${cardRef(i.to ?? "host")}`, read: ["amount", "to"] }),
  DealDamage: () => ({ text: "deal damage", read: [] }),
  DamageCard: (i, ctx) => ({ text: `deal ${amount(i.amount, ctx)} damage to ${cardRef(i.target ?? "picked")}`, read: ["amount", "target"] }),
  Heal: (i, ctx) => ({ text: `heal ${i.all === true ? "all damage" : `${amount(i.amount, ctx)} damage`} from ${cardRef(i.target ?? "picked")}`, read: ["amount", "all", "target"] }),
  Exhaust: (i) => ({ text: `exhaust ${target(i.target)}${typeof i.who === "string" ? ` (controlled by ${who(i.who)})` : ""}`, read: ["target", "who"] }),
  Ready: (i) => ({ text: `ready ${typeof i.target === "string" && i.target === "allCharacters" ? "every character" : cardRef(i.target ?? "self")}`, read: ["target"] }),
  Discard: (i) => ({ text: `discard ${target(i.target)}`, read: ["target"] }),
  DiscardFromHand: (i, ctx) => ({ text: `discard ${amount(i.amount, ctx)} cards from hand`, read: ["amount"] }),
  Draw: (i, ctx) => ({ text: `${who(i.who ?? "actor")} draws ${i.amount === undefined ? "1" : amount(i.amount, ctx)} card(s)${typeof i.perHero === "string" ? ` for each ${i.perHero} hero` : ""}${i.from === "bottom" ? " from the bottom of the deck" : ""}`, read: ["who", "amount", "perHero", "from"] }),
  RaiseThreat: (i, ctx) => ({ text: `raise threat by ${i.amount === undefined ? "1" : amount(i.amount, ctx)} (${who(i.who ?? "actor")})`, read: ["amount", "who", "perCommitted"] }),
  LowerThreat: (i, ctx) => ({ text: `lower threat by ${amount(i.amount, ctx)} (${who(i.who)})`, read: ["amount", "who"] }),
  ReturnToStaging: (i) => ({ text: `return ${target(i.target)} to the staging area`, read: ["target"] }),
  ShuffleEncounterDeck: () => ({ text: "shuffle the encounter deck", read: [] }),
  ShuffleEncounterDiscard: () => ({ text: "shuffle the encounter discard pile into the encounter deck", read: [] }),
  DiscardEncounterTop: (i, ctx) => ({ text: `discard ${amount(i.count, ctx)} card(s) from the top of the encounter deck`, read: ["count"] }),
  DiscardUntilEnemies: (i) => ({ text: `discard from the top of the encounter deck until ${str(i.perPlayer)} enem${i.perPlayer === 1 ? "y" : "ies"} for each player ${i.perPlayer === 1 ? "is" : "are"} discarded${i.to === "staging" ? "; add those enemies to the staging area" : ""}`, read: ["perPlayer", "to"] }),
  RevealEncounter: (i) => ({ text: `${who(i.who ?? "actor")} reveals an encounter card`, read: ["who"] }),
  AdvanceStage: () => ({ text: "advance to the next quest stage", read: [] }),
  WinGame: () => ({ text: "the players win the game", read: [] }),
  LoseGame: (i) => ({ text: `the players lose the game${typeof i.reason === "string" ? ` (${i.reason})` : ""}`, read: ["reason"] }),
  StageDiscarded: (i) => ({ text: `add the discarded ${plural(str(i.type), 2)} to the staging area`, read: ["type"] }),
  SearchStageCard: (i) => ({ text: `search for the card with code ${str(i.code)} and add it to the staging area`, read: ["code"] }),
  SearchBoonOrTreasureToHand: () => ({ text: "each player may search their deck for a boon or treasure card and add it to their hand", read: [] }),
  RemoveFromEncounterDeckIfLogged: (i) => ({
    text: `if the Campaign Log holds "${str(i.line)}": remove ${str(i.count)} ${i.nonUnique === true ? "non-unique " : ""}${plural(str(i.cardType), i.count)} from the encounter deck${Array.isArray(i.except) ? ` except ${quoted(i.except)}` : ""}`,
    read: ["line", "count", "cardType", "nonUnique", "except"],
  }),
  IgnoreKeyword: (i) => ({ text: `ignore the ${Array.isArray(i.keywords) ? joinAnd(i.keywords.map(str)) : compact(i.keywords)} keyword(s)`, read: ["keywords"] }),
  AttackFromStaging: (i) => ({ text: `${i.target === "self" ? "this card" : "the picked enemy"} attacks ${i.who === "firstPlayer" ? "the first player" : "the acting player"} now, from the staging area${i.orEngaged === true ? " (or engaged)" : ""}${i.undefendedToStage === true ? ", undefended damage going to the stage" : ""}`, read: ["who", "target", "orEngaged", "undefendedToStage"] }),
  DiscardPicked: () => ({ text: "discard the picked card", read: [] }),
  Engage: (i) => ({ text: `engage ${cardRef(i.target ?? "picked")}`, read: ["target"] }),
  Travel: () => ({ text: "travel to this location", read: ["to"] }),
  Attack: () => ({ text: "make an attack", read: [] }),
  MovePicked: (i) => ({ text: `move the picked card to ${i.to === "hand" ? "hand" : "play"}`, read: ["to", "who"] }),
  Choose: (i, ctx) => ({
    text: `${who(i.who)} chooses${i.different === true ? " (each option once)" : ""}${i.upTo !== undefined ? ` up to ${amount(i.upTo, ctx)} options` : " one of"}:`,
    read: ["who", "different", "upTo", "options"],
    children: Array.isArray(i.options) ? (i.options as readonly Obj[]) : [],
  }),
  Each: (i, ctx) => ({
    text: `for each ${pick(i.pick, ctx)}${i.upTo !== undefined ? ` (up to ${i.upTo === "any" ? "any number" : amount(i.upTo, ctx)} chosen)` : ""}:`,
    read: ["pick", "upTo", "instructions", "totalCost", "taken"],
    children: Array.isArray(i.instructions) ? (i.instructions as readonly Obj[]) : [],
  }),
  Delay: (i, ctx) => ({
    text: `later, ${DELAY_UNTIL[str(i.until)] ?? `at ${str(i.until)}`}${isObj(i.uncancelable) ? ` (cannot be canceled while ${renderCondition(i.uncancelable, ctx)})` : ""}:`,
    read: ["until", "uncancelable", "subject", "instructions"],
    children: Array.isArray(i.instructions) ? (i.instructions as readonly Obj[]) : [],
  }),
  AfterAttack: () => ({ text: "when the attack in progress ends:", read: ["instructions"], children: [] }),
  Repeat: (i, ctx) => ({ text: `repeat ${amount(i.times, ctx)} times:`, read: ["times", "instructions"], children: Array.isArray(i.instructions) ? (i.instructions as readonly Obj[]) : [] }),
  ForEachPlayer: (i) => ({ text: `for each player, ${str(i.order) === "lastFirst" ? "last player first" : "first player first"}:`, read: ["order", "instructions"], children: Array.isArray(i.instructions) ? (i.instructions as readonly Obj[]) : [] }),
};

// The children of the verbs that hold instructions: AfterAttack's, and a Choose option's, are read from the instruction itself.
function childrenOf(ins: Obj, made: Made): readonly Obj[] {
  if (ins.verb === "AfterAttack") return Array.isArray(ins.instructions) ? (ins.instructions as readonly Obj[]) : [];
  return made.children ?? [];
}

// One instruction as indented lines.
export function renderInstruction(value: unknown, ctx: Ctx, depth = 0, later = false): string[] {
  const pad = "  ".repeat(depth);
  if (!isObj(value) || typeof value.verb !== "string") return [`${pad}- ${jsonOf(ctx, "instruction", value)}`];
  const template = TEMPLATES[value.verb];
  const made = template?.(value, ctx);
  if (!made) return [`${pad}- ${jsonOf(ctx, value.verb, value)}`];
  const when = isObj(value.when) ? `${later ? "then, " : ""}if ${renderCondition(value.when, ctx)}${later ? " (checked when this step runs, after the steps above; not tied to whether they did anything)" : ""}: ` : "";
  const text = done(ctx, `${when}${made.text}`, value, ["verb", "when", ...made.read]);
  const lines = [`${pad}- ${text}`];
  if (value.verb === "Choose") {
    for (const option of childrenOf(value, made)) lines.push(...renderOption(option, ctx, depth + 1));
  } else {
    childrenOf(value, made).forEach((child, at) => lines.push(...renderInstruction(child, ctx, depth + 1, at > 0)));
  }
  return lines;
}

function renderOption(option: Obj, ctx: Ctx, depth: number): string[] {
  const pad = "  ".repeat(depth);
  const requires = isObj(option.requires) ? ` (only if ${renderCondition(option.requires, ctx)})` : "";
  const head = done(ctx, `option "${str(option.id)}"${requires}:`, option, ["id", "requires", "instructions"]);
  const body = Array.isArray(option.instructions) ? option.instructions.flatMap((child, at) => renderInstruction(child, ctx, depth + 1, at > 0)) : [];
  return [`${pad}* ${head}`, ...body];
}
