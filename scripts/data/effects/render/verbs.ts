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
const WHO: Readonly<Record<string, string>> = { actor: "the acting player", firstPlayer: "the first player", picked: "the picked player", eventSeat: "the player the event is about", eachSeat: "each player", defendingPlayer: "the defending player (the player this enemy is engaged with)" };
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
// What a stat flag means where the bare name would not say it.
const STAT_NOTE: Readonly<Record<string, string>> = {
  questProgressCap: " (no more than this much progress can be placed on the current quest in all; progress that goes to the active location first does not count)",
  cannotLeaveStaging: " (nothing moves it out of the staging area: not an engagement, a return, a discard or an effect)",
  cannotBeEngaged: " (no player engages it: not optionally, not by an engagement check, not by an effect)",
  blankText: " (its text box is blank)",
  engagedThreatSeat: " (each enemy engaged with that player adds its Threat to the staging area's total, counted live: an enemy that engages later counts too)",
  cannotHaveTreachery: " (no treachery card can be attached to it)",
  alliesCannotAttack: " (allies cannot be declared as attackers against it)",
};
const untilWords = (until: unknown): string => STAT_UNTIL[str(until)] ?? str(until);

// What bounds an Each that lets the actor choose: how many cards, the total printed cost they may add up to, and the cards the engine has already recorded.
function eachLimits(i: Obj, ctx: Ctx): string {
  const total = i.totalCost === undefined ? "" : `their printed costs adding up to at most ${amount(i.totalCost, ctx)}`;
  const upTo = i.upTo === undefined ? "" : `up to ${i.upTo === "any" ? "any number" : amount(i.upTo, ctx)} chosen`;
  const bound = [upTo, total].filter((part) => part !== "").join(", ");
  const taken = Array.isArray(i.taken) ? ` (the engine has recorded ${i.taken.length} chosen so far)` : "";
  return `${bound === "" ? "" : ` (${bound})`}${taken}`;
}

const FLIP_GOLLUM = {
  smeagol: "flip Gollum to Sméagol: discard his damage; he enters play exhausted, controlled by the first player (not the discard pile or the victory display)",
  gollum: "flip Sméagol to Gollum: discard his damage; he enters play ready, engaged with the first player (nothing if Sméagol is not in play)",
} as const;

export const TEMPLATES: Readonly<Record<string, Template>> = {
  ModifyStat: (i, ctx) => {
    const holders = isObj(i.holders) ? `each ${pick(i.holders, ctx)}` : typeof i.target === "string" ? targetStat(i.target) : "this card";
    const per = typeof i.per === "string" ? ` for each ${i.per}` : "";
    const trait = typeof i.trait === "string" ? ` (${i.trait} only)` : "";
    const sign = i.subtract === true ? "minus " : "";
    return { text: `${holders}${trait}: stat ${str(i.stat)}${STAT_NOTE[str(i.stat)] ?? ""} ${sign}${amount(i.amount, ctx)}${per}, ${untilWords(i.until)}`, read: ["stat", "amount", "until", "holders", "target", "per", "trait", "subtract"] };
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
  RaiseThreat: (i, ctx) => ({ text: `raise threat by ${i.amount === undefined ? "1" : amount(i.amount, ctx)} (${who(i.who ?? "actor")})${isObj(i.perCommitted) ? ` for each ${typeof i.perCommitted.exceptSphere === "string" ? `non-${i.perCommitted.exceptSphere} ` : ""}${str(i.perCommitted.type)} committed to the quest` : ""}`, read: ["amount", "who", "perCommitted"] }),
  LowerThreat: (i, ctx) => ({ text: `lower threat by ${amount(i.amount, ctx)} (${who(i.who)})`, read: ["amount", "who"] }),
  ReturnToStaging: (i, ctx) => {
    const found = isObj(i.target) ? i.target : null;
    if (found?.kind === "engagedEnemies") return { text: `return ${found.pick === "choose" ? "one enemy" : "every enemy"}${typeof found.trait === "string" ? ` with the trait ${found.trait}` : ""} engaged with ${found.who === "actor" ? "the acting player" : "a player"}${found.pick === "choose" ? " (that player picks which)" : ""} to the staging area`, read: ["target"] };
    if (found?.kind === "self" && ctx.attacker === true) return { text: "return the attacking enemy (the card whose shadow this is the attacker of) to the staging area", read: ["target"] };
    return { text: `return ${target(i.target)} to the staging area`, read: ["target"] };
  },
  PlaceFacedownUnder: (i) => ({
    text: `${i.afterAttack === true ? "once the attack in progress has ended, " : ""}place ${cardRef(i.target ?? "picked")} facedown under the card with code ${str(i.code)} in play (out of play there; its attachments are discarded, its tokens go)`,
    read: ["code", "target", "afterAttack"],
  }),
  AttachToDial: (i) => ({
    text: typeof i.code === "string" ? `the acting player attaches a set-aside copy of the card with code ${str(i.code)} to their threat dial (nothing when the dial holds one already, Limit 1 per threat dial, or none is set aside)` : "this card attaches itself to the acting player's threat dial (nothing when the dial holds a copy already)",
    read: ["code"],
  }),
  DetachFromDial: (i) => ({
    text: typeof i.code === "string" ? `the copy of the card with code ${str(i.code)} on the acting player's threat dial is detached and set aside, out of play` : "this card is detached from the acting player's threat dial and set aside, out of play",
    read: ["code"],
  }),
  RemoveSetAside: (i) => ({ text: `every set-aside copy of the card with code ${str(i.code)} is removed from the game`, read: ["code"] }),
  DiscardHand: () => ({ text: "the acting player discards all the cards in their hand", read: [] }),
  SetPursuit: (i) => ({ text: `set the pursuit value to ${str(i.value)}`, read: ["value"] }),
  RaisePursuit: (i, ctx) => ({ text: `increase the pursuit value by ${amount(i.amount, ctx)}`, read: ["amount"] }),
  LowerPursuit: (i, ctx) => ({ text: `reduce the pursuit value by ${amount(i.amount, ctx)} (never below 0)`, read: ["amount"] }),
  TakeLoggedCaptives: (i) => ({ text: `each seat the Campaign Log names a Captive for has that hero lie faceup under the card with code ${str(i.under)}`, read: ["under"] }),
  MakeCaptive: (i) => ({ text: `the picked hero becomes a Captive: it lies faceup under the card with code ${str(i.under)}, in play and controlled by no one`, read: ["under"] }),
  HoldCaptive: () => ({ text: "the picked Captive is attached to this card", read: [] }),
  ReturnCaptive: (i) => ({ text: `the Captive this card holds lies faceup under the card with code ${str(i.under)} again`, read: ["under"] }),
  DamageHeldCaptive: (i, ctx) => ({ text: `deal ${amount(i.amount, ctx)} damage to the Captive this card holds`, read: ["amount"] }),
  DiscardRandomFromHand: (i, ctx) => ({
    text: `${i.who === "eachSeat" ? "each player" : i.who === "firstPlayer" ? "the first player" : "the acting player"} discards ${i.amount === undefined ? "1" : amount(i.amount, ctx)} random card(s) from hand${i.remember === true ? " (the last card discarded becomes the picked card)" : ""}`,
    read: ["amount", "who", "remember"],
  }),
  SearchReveal: (i) => ({
    text: `the ${i.who === "firstPlayer" ? "first player" : "acting player"} searches the encounter deck and discard pile for ${typeof i.trait === "string" ? `a ${i.trait} ` : "a "}${typeof i.type === "string" ? i.type : "card"}, reveals it and ${i.to === "engaged" ? "puts it into play engaged with them" : "adds it to the staging area"}`,
    read: ["trait", "type", "who", "to"],
  }),
  AttachSelf: (i) => (isObj(i.to) && i.to.kind === "hero" ? { text: `attach this card to ${typeof i.to.trait === "string" ? `a ${i.to.trait} hero` : "a hero"}`, read: ["to"] } : null),
  EndQuestPhase: () => ({ text: "end the quest phase at once (no quest resolution)", read: [] }),
  ImmediateAttack: (i, ctx) => ({ text: `${ctx.attacker === true ? "the attacking enemy attacks the defending player again (an additional attack, against \"you\" on the shadow card)" : "this enemy attacks now"}${i.shadow === false ? ", dealt no shadow card" : ", dealt a new shadow card after its old ones are discarded"}`, read: ["shadow"] }),
  ConsiderUndefended: () => ({ text: "this attack is considered undefended", read: [] }),
  DiscardShadowOf: (i) => ({ text: `discard a shadow card dealt to ${cardRef(i.target ?? "picked")}`, read: ["target"] }),
  DamageEach: (i, ctx) => ({ text: `deal ${amount(i.amount, ctx)} damage to each ${pick(i.pick, ctx)}`, read: ["amount", "pick"] }),
  // A restriction read from the record's own fields; one the template does not word (attach, heroLimit, travelOnly) prints as JSON.
  Restrict: (i) => {
    if (i.what === "advance") return { text: "the players cannot defeat this stage while this holds", read: ["what"] };
    if (i.what === "defend") {
      const who = i.allies === true ? "allies" : i.belowSourceHitPoints === true ? "allies with fewer printed hit points than this card" : typeof i.maxWillpower === "number" ? `characters with Willpower ${i.maxWillpower} or less` : "characters";
      return { text: `${who}${typeof i.exceptTrait === "string" ? ` (except those with the trait ${i.exceptTrait})` : ""} cannot be declared as defenders against this card's attacks (only this card's, not another enemy's)`, read: ["what", "allies", "maxWillpower", "belowSourceHitPoints", "exceptTrait"] };
    }
    if (i.what === "travel") return { text: `the players cannot travel to ${typeof i.location === "string" ? `the location with code ${i.location}${typeof i.guarding === "string" ? ` that guards ${i.guarding}` : ""}` : "any location"} while this holds`, read: ["what", "location", "guarding"] };
    return null;
  },
  PlaceMireToken: (i, ctx) => ({ text: `place ${amount(i.amount, ctx)} mire token(s) (resources) on ${cardRef(i.on)}; a location whose mire tokens then reach its Mire X is discarded by the Mire keyword`, read: ["on", "amount"] }),
  ReturnRandomVictoryLocation: () => ({ text: "return a random location from the victory display to the staging area (chosen with the game's seed)", read: [] }),
  ShuffleVictoryIntoEncounterDeck: () => ({ text: "shuffle every location in the victory display into the encounter deck", read: [] }),
  FlipGollum: (i) => ({ text: i.to === "smeagol" ? FLIP_GOLLUM.smeagol : FLIP_GOLLUM.gollum, read: ["to"] }),
  FollowFirstPlayer: () => ({ text: "this enemy moves to the first player's play area and engages them (nothing if it is not engaged, or already engaged with them)", read: [] }),
  GollumAttacks: () => ({ text: "Gollum, if he is in play, makes an immediate attack against the player he is engaged with", read: [] }),
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
  AttackFromStaging: (i) => ({ text: `${i.target === "self" ? "this card" : i.target === "host" ? "its host" : "the picked enemy"} attacks ${i.who === "firstPlayer" ? "the first player" : "the acting player"} now, from the staging area${i.shadows ? `, dealt ${i.shadows} shadow cards` : ""}${i.orEngaged === true ? " (or engaged)" : ""}${i.undefendedToStage === true ? ", undefended damage going to the stage" : ""}`, read: ["who", "target", "shadows", "orEngaged", "undefendedToStage"] }),
  DiscardPicked: () => ({ text: "discard the picked card", read: [] }),
  Engage: (i) => ({ text: `engage ${cardRef(i.target ?? "picked")}`, read: ["target"] }),
  Travel: () => ({ text: "travel to this location", read: ["to"] }),
  Attack: () => ({ text: "make an attack", read: [] }),
  MovePicked: (i) => ({
    text: typeof i.who === "string" ? `move the picked card ${i.to === "hand" ? `to ${who(i.who)}'s hand` : `into play under ${who(i.who)}'s control`}` : `move the picked card to ${i.to === "hand" ? "hand" : "play"}`,
    read: ["to", "who"],
  }),
  Choose: (i, ctx) => ({
    text: `${who(i.who)} chooses${i.different === true ? " (each option once)" : ""}${i.upTo !== undefined ? ` up to ${amount(i.upTo, ctx)} options` : " one of"}:`,
    read: ["who", "different", "upTo", "options"],
    children: Array.isArray(i.options) ? (i.options as readonly Obj[]) : [],
  }),
  Each: (i, ctx) => ({
    text: `for each ${pick(i.pick, ctx)}${eachLimits(i, ctx)}:`,
    read: ["pick", "upTo", "instructions", "totalCost", "taken"],
    children: Array.isArray(i.instructions) ? (i.instructions as readonly Obj[]) : [],
  }),
  Delay: (i, ctx) => ({
    text: `later, ${DELAY_UNTIL[str(i.until)] ?? `at ${str(i.until)}`}${i.subject === "picked" ? ", acting on the card last picked" : ""}${isObj(i.uncancelable) ? ` (cannot be canceled while ${renderCondition(i.uncancelable, ctx)})` : ""}:`,
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
    const inner = value.verb === "AfterAttack" ? { ...ctx, attacker: true } : ctx;
    childrenOf(value, made).forEach((child, at) => lines.push(...renderInstruction(child, inner, depth + 1, at > 0)));
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
