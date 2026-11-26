// Instructions: one small template per verb. A verb with none prints as compact JSON. `src/catalog/effect-schema-verbs.ts`, `effect-schema.ts` and each family's `VERBS` own the shapes.
// The structural verbs (Choose, Each, Delay, AfterAttack, Repeat, ForEachPlayer) hold instructions of their own and print them indented beneath.
import { cardRef, renderAmount, topUpTo } from "./amounts.ts";
import { renderCondition } from "./conditions.ts";
import { who } from "./family-kit.ts";
import { FAMILY_TEMPLATES } from "./families.ts";
import { compact, done, isObj, jsonOf, joinAnd, joinOr, quoted, str, withArticle, type Ctx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";
import { ANGMAR_TEMPLATES } from "./families/angmar.ts";
import { ESCAPE_TEMPLATES } from "./families/escape.ts";
import { BURGLE_TEMPLATES } from "./families/burgle.ts";
import { ATTACH_TEMPLATES } from "./attach.ts";
import { GUARDIAN_SAMPLES, GUARDIAN_TEMPLATES } from "./families/guardian.ts";
import { AMBUSH_TEMPLATES } from "./families/ambush.ts";
import { LONG_DARK_SAMPLES, LONG_DARK_TEMPLATES } from "./families/long-dark.ts";
import { STAT_TEMPLATES, STAT_UNTIL } from "./stats.ts";
import { STONE_SAMPLES, STONE_TEMPLATES } from "./families/stone.ts";
import { SMAUG_SAMPLES, SMAUG_TEMPLATES } from "./families/smaug.ts";
import { ERECH_SAMPLES, ERECH_TEMPLATES } from "./families/erech.ts";
import { WESTERN_LANDS_SAMPLES, WESTERN_LANDS_TEMPLATES } from "./families/western-lands.ts";
import { SACK_SAMPLES, SACK_TEMPLATES } from "./families/sack.ts";
import { FOG_SAMPLES, FOG_TEMPLATES } from "./families/fog.ts";
import { RUINS_SAMPLES, RUINS_TEMPLATES } from "./families/ruins.ts";
import { SIEGE_SAMPLES, SIEGE_TEMPLATES } from "./families/siege.ts";
import { DREADNAUGHT_SAMPLES, DREADNAUGHT_TEMPLATES } from "./families/dreadnaught.ts";
import { GULDUR_SAMPLES, GULDUR_TEMPLATES } from "./families/dolguldur.ts";
import { INVESTIGATION_SAMPLES, INVESTIGATION_TEMPLATES } from "./families/investigation.ts";
import { POISON_SAMPLES, POISON_TEMPLATES } from "./families/poison.ts";
import { searchLimits, searchPolicy, WIZARDS_QUEST_SAMPLES, WIZARDS_QUEST_TEMPLATES } from "./families/wizards-quest.ts";

export { ESCAPE_SAMPLES } from "./families/escape.ts";
export { BURGLE_SAMPLES } from "./families/burgle.ts";
export { DREADNAUGHT_SAMPLES, ERECH_SAMPLES, FOG_SAMPLES, GULDUR_SAMPLES, GUARDIAN_SAMPLES, INVESTIGATION_SAMPLES, LONG_DARK_SAMPLES, POISON_SAMPLES, RUINS_SAMPLES, SIEGE_SAMPLES, SMAUG_SAMPLES, SACK_SAMPLES, STONE_SAMPLES, WESTERN_LANDS_SAMPLES, WIZARDS_QUEST_SAMPLES };

type Made = { text: string; read: readonly string[]; children?: readonly Obj[] };
type Template = (ins: Obj, ctx: Ctx) => Made | null;

// The note on a hand amount: `{ hand: true, plus: -N }` is "until N cards are left"; a hand amount with no negative `plus` gets none.
const handLeft = (amount: unknown): string => {
  if (!isObj(amount) || !("hand" in amount) || typeof amount.plus !== "number" || amount.plus >= 0) return "";
  return ` (the player chooses which cards, until ${-amount.plus} cards are left)`;
};

const amount = (value: unknown, ctx: Ctx): string => renderAmount(value, ctx, renderPick);

// The most ChooseX allows: its one amount, or the least of several (the engine takes the smallest of `max`).
const chooseXMost = (max: unknown, ctx: Ctx): string => (Array.isArray(max) ? (max.length === 1 ? amount(max[0], ctx) : `the least of ${joinAnd(max.map((one) => amount(one, ctx)))}`) : "?");
const pick = (value: unknown, ctx: Ctx): string => renderPick(value, ctx);

// A target: a card reference (`self`) or a target object (`{ kind: "picked" }`).
function target(value: unknown): string {
  if (value === undefined) return "this card";
  if (isObj(value) && typeof value.kind === "string") return value.kind === "byCode" ? `the card with code ${str(value.code)}` : value.kind === "byName" ? `"${str(value.name)}"` : value.kind === "ref" ? cardRef(value.ref) : cardRef(value.kind);
  return cardRef(value);
}

const MOVE_CARD_TO: Readonly<Record<string, string>> = { hand: "to its owner's hand", deckTop: "on the top of its owner's deck", deckBottom: "to the bottom of its owner's deck", deckShuffle: "into its owner's deck, which is shuffled", discard: "to its owner's discard pile", removed: "out of the game" };
const ENCOUNTER_MOVE: Readonly<Record<string, string>> = { deckTop: "goes on top of the encounter deck", deckBottom: "goes to the bottom of the encounter deck", shuffle: "is shuffled into the encounter deck", discard: "goes to the encounter discard pile", staging: "goes to the staging area (it is not revealed)", engaged: "is put into play engaged with the acting player (it is not revealed; it has engaged that player)", activeLocation: "becomes the active location", victory: "goes to the victory display", removed: "is removed from the game" };
const MOST: Readonly<Record<string, string>> = { resources: "resource tokens", nonObjectiveAttachments: "attachments that are not objectives", damage: "damage" };
const plural = (noun: string, count: unknown): string => (count === 1 ? noun : noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`);
const DELAY_UNTIL: Readonly<Record<string, string>> = {
  endOfPhase: "at the end of this phase",
  endOfRound: "at the end of the round",
  questSucceeded: "if the players quest successfully this phase (never, if they do not)",
  questFailed: "if the players quest unsuccessfully this phase (never, if they do not)",
  endOfAttack: "when the attack ends",
  startOfGame: "once the opening hands are done, before the first round",
  beginningOfTravel: "when the next travel phase begins",
};
const CHOOSE_CARDS_WHO: Readonly<Record<string, string>> = { eachSeat: "each player in turn", firstPlayer: "the first player", onePlayer: "each player in turn (the offer ends once one has taken it)" };
const CHOOSE_CARDS_TO: Readonly<Record<string, string>> = { pool: "into the Campaign Pool", hand: "into their hand", hero: "attached to a hero", player: "for a player (shuffled into their deck)" };
const PICK_ENCOUNTER_FROM = (i: Obj): string =>
  i.from === "deck" ? (typeof i.top === "number" ? `among the top ${i.top} cards of the encounter deck` : "in the encounter deck") : i.from === "deckAndDiscard" ? "in the encounter deck or its discard pile" : i.from === "looked" ? "among the cards the effect looked at" : "among the enemies and locations in play";

// What bounds an Each that lets the actor choose: how many cards, the total printed cost they may add up to, and the cards the engine has already recorded.
function eachLimits(i: Obj, ctx: Ctx): string {
  const total = i.totalCost === undefined ? "" : `their printed costs adding up to at most ${amount(i.totalCost, ctx)}`;
  const upTo = i.upTo === undefined ? "" : `up to ${i.upTo === "any" ? "any number" : amount(i.upTo, ctx)} chosen`;
  const bound = [upTo, total].filter((part) => part !== "").join(", ");
  const taken = Array.isArray(i.taken) ? ` (the engine has recorded ${i.taken.length} chosen so far)` : "";
  return `${bound === "" ? "" : ` (${bound})`}${taken}`;
}

// The Each verb in three cases: with an empty `rest` the chosen ones get the steps; with a `rest` the chosen ones are kept (and get the second list when `instructions` has steps) and the others get `rest`; with no `rest` every match gets the steps.
function eachText(i: Obj, ctx: Ctx): string {
  const rest = i.rest;
  const hasSteps = Array.isArray(i.instructions) && i.instructions.length > 0;
  const choose = () => `the actor must choose ${amount(i.upTo, ctx)} of the ${pick(i.pick, ctx)}`;
  if (Array.isArray(rest) && rest.length === 0 && hasSteps) return `${choose()} (all of them when no more match; nothing is asked then); for each chosen one:`;
  if (Array.isArray(rest)) return `${choose()} to keep (all stay with no more than that many; nothing is asked then); for each of the others${hasSteps ? " (the chosen ones get the steps in the second list)" : ""}:`;
  return `for each ${pick(i.pick, ctx)}${eachLimits(i, ctx)}:`;
}

const FLIP_GOLLUM = {
  smeagol: "flip Gollum to Sméagol: discard his damage; he enters play exhausted, controlled by the first player (not the discard pile or the victory display)",
  gollum: "flip Sméagol to Gollum: discard his damage; he enters play ready, engaged with the first player (nothing if Sméagol is not in play)",
} as const;

export const TEMPLATES: Readonly<Record<string, Template>> = {
  ...FAMILY_TEMPLATES, ...ESCAPE_TEMPLATES, ...BURGLE_TEMPLATES, ...AMBUSH_TEMPLATES, ...ANGMAR_TEMPLATES, ...LONG_DARK_TEMPLATES, ...STONE_TEMPLATES,
  ...GUARDIAN_TEMPLATES, ...ATTACH_TEMPLATES, ...STAT_TEMPLATES,
  ...SMAUG_TEMPLATES, ...ERECH_TEMPLATES, ...FOG_TEMPLATES, ...RUINS_TEMPLATES, ...SIEGE_TEMPLATES, ...GULDUR_TEMPLATES, ...DREADNAUGHT_TEMPLATES, ...INVESTIGATION_TEMPLATES, ...WIZARDS_QUEST_TEMPLATES, ...POISON_TEMPLATES, ...WESTERN_LANDS_TEMPLATES, ...SACK_TEMPLATES,
  PlayOnlyIf: (i, ctx) => ({ text: `(constant on a card in hand, read when it would be played) it can only be played while ${renderCondition(i.condition, ctx)}`, read: ["condition"] }),
  Pick: (i, ctx) => ({ text: `choose ${pick(i.pick, ctx)}`, read: ["pick"] }),
  // The mount-doom family (src/catalog/families/mount-doom.ts).
  FortitudeTest: (i, ctx) => {
    const extraCards = i.extraCards === undefined ? "" : `, plus ${amount(i.extraCards, ctx)} more cards`;
    const extraEyes = isObj(i.extraEyes) ? `, plus ${str(i.extraEyes.amount)} icons if ${renderCondition(i.extraEyes.when, ctx)} as the test is made` : "";
    return {
      text: `${who(i.who ?? "actor")} makes a Fortitude test: exhausts any number of ready heroes to commit them, discards the top X cards of the encounter deck (X the tens digit of their threat${extraCards}), counts the Sauron's Eye icons on them${extraEyes}, the players take actions, and the committed heroes' total Willpower must be greater than the icons to pass (equal or fewer fails)`,
      read: ["who", "extraCards", "extraEyes"],
    };
  },
  IgnoreFortitudeEyes: () => ({ text: "the card just chosen (discarded for the Fortitude test in progress) adds no Sauron's Eye icons to that test", read: [] }),
  FirstTreacheryImmuneSurge: () => ({ text: "while this card is in play, the first treachery the encounter deck reveals each quest phase is immune to player card effects until it leaves play and gains surge (marked as it is revealed, before its When Revealed effects)", read: [] }),
  PlaceTokensOnCampaignCard: (i, ctx) => ({ text: `place ${amount(i.amount, ctx)} resource tokens on the campaign card (kept in the game)`, read: ["amount"] }),
  PlaceProgressOn: (i, ctx) => ({ text: `place ${amount(i.amount, ctx)} progress on ${cardRef(i.target)}`, read: ["amount", "target"] }),
  RemoveProgressFrom: (i, ctx) => ({ text: `remove ${amount(i.amount, ctx)} progress from ${i.target ? cardRef(i.target) : `"${str(i.named)}"`}`, read: ["amount", "named", "target"] }),
  DealShadow: (i, ctx) => {
    if (ctx.timing === "shadow" || ctx.attacking === true) return { text: i.additional === true ? "the attacking enemy is dealt an additional shadow card, which resolves beside the one it has" : "the attacking enemy is dealt a shadow card", read: ["additional"] };
    // Outside an attack (neither a Shadow effect nor a record on the attacks trigger) the card goes to the enemy the record is on (no attack needed), and stays until that enemy's next attack.
    return { text: `this enemy (the card the record is on, wherever it is in play) is dealt ${i.additional === true ? "an additional shadow card, beside any it has" : "a shadow card (nothing when it has one)"}; the card stays on it until its next attack`, read: ["additional"] };
  },
  CannotPlay: (i, ctx) => ({ text: `${i.anyPlayer === true ? "no player" : "its controller"} can play, or put into play, a ${pick(i.pick, ctx)}`, read: ["pick", "anyPlayer"] }),
  UncancelableWhenRevealed: (i) => ({ text: `while this card is in play (under its condition), the When Revealed effects of ${typeof i.trait === "string" ? `${i.trait} cards` : i.cardType === "treachery" ? "treachery cards" : i.firstRevealedEachRound === true ? "the first treachery revealed each round" : "cards"} cannot be canceled${i.doomed != null ? `, and that treachery gains doomed ${str(i.doomed)} as it is revealed` : ""}${i.surge === true ? ", and that treachery gains surge as it is revealed" : ""}`, read: ["trait", "cardType", "firstRevealedEachRound", "doomed", "surge"] }),
  DamageOncePerRound: (i) => ({ text: `deal ${str(i.amount)} damage to ${cardRef(i.target ?? "subject")} unless a card with this card's title has dealt it damage this round (it is marked for the round once the damage is dealt)`, read: ["amount", "target"] }),
  PlaceResourceTokens: (i, ctx) => ({ text: `place ${amount(i.amount, ctx)} resource tokens on ${i.code === undefined ? cardRef(i.on) : `the card in play with code ${str(i.code)} (when it is not in play, on the card that holds redirectResources, else nowhere)`}`, read: ["amount", "on", "code"] }),
  AddResources: (i, ctx) => ({ text: `add ${amount(i.amount, ctx)} resources to ${cardRef(i.to ?? "host")}`, read: ["amount", "to"] }),
  DealDamage: () => ({ text: "deal damage", read: [] }),
  DamageCard: (i, ctx) => ({ text: `deal ${amount(i.amount, ctx)} damage to ${cardRef(i.target ?? "picked")}${i.uncancelable === true ? " (no ability that cancels damage can cancel it; moving it to another card still can)" : ""}`, read: ["amount", "target", "uncancelable"] }),
  Heal: (i, ctx) => ({ text: `heal ${i.all === true ? "all damage" : `${amount(i.amount, ctx)} damage`} from ${cardRef(i.target ?? "picked")}${i.athelas === true ? " (counts as an Athelas heal, which Noxious Supplies does not reduce)" : ""}`, read: ["amount", "all", "target", "athelas"] }),
  Exhaust: (i) => ({ text: `exhaust ${target(i.target)}${typeof i.who === "string" ? ` (controlled by ${who(i.who)})` : ""}`, read: ["target", "who"] }),
  Ready: (i) => ({ text: `ready ${typeof i.target === "string" && i.target === "allCharacters" ? "every character" : cardRef(i.target ?? "self")}`, read: ["target"] }),
  Discard: (i) => ({ text: `discard ${target(i.target)}${i.counted === true ? " (a card discarded out of play counts for the effect's noneDiscarded condition: the part after \"then\" resolves only if the discard did)" : ""}`, read: ["target", "counted"] }),
  Destroy: (i) => ({ text: `${target(i.target)} is destroyed (not discarded: rr.destroy)`, read: ["target"] }),
  DiscardFromHand: (i, ctx) => ({ text: `${ctx.engagedSeat === true ? "the player the enemy engaged discards" : "discard"} ${amount(i.amount, ctx)} card${ctx.engagedSeat === true && i.amount === 1 ? "" : "s"} from ${ctx.engagedSeat === true ? "their " : ""}hand${handLeft(i.amount)}`, read: ["amount"] }),
  Draw: (i, ctx) => {
    // "Draws cards until he has N in his hand": the amount is N less the hand, and a hand of N or more draws nothing.
    const upTo = i.amount === undefined ? null : topUpTo(i.amount);
    const counted = i.amount === undefined ? "1" : amount(i.amount, ctx);
    const text = upTo != null ? `${who(i.who ?? "actor")} draws cards until their hand holds ${upTo} (nothing when it already holds ${upTo} or more)` : `${who(i.who ?? "actor")} draws ${counted} card(s)`;
    return { text: `${text}${typeof i.perHero === "string" ? ` for each ${i.perHero} hero` : ""}${i.from === "bottom" ? " from the bottom of the deck" : ""}`, read: ["who", "amount", "perHero", "from"] };
  },
  RaiseThreat: (i, ctx) => ({ text: `raise threat by ${i.amount === undefined ? "1" : amount(i.amount, ctx)} (${who(i.who ?? "actor")})${isObj(i.perCommitted) ? ` for each ${typeof i.perCommitted.exceptSphere === "string" ? `non-${i.perCommitted.exceptSphere} ` : ""}${str(i.perCommitted.type)} committed to the quest` : ""}`, read: ["amount", "who", "perCommitted"] }),
  LowerThreat: (i, ctx) => ({ text: `lower threat by ${amount(i.amount, ctx)} (${who(i.who)})`, read: ["amount", "who"] }),
  ReturnToStaging: (i, ctx) => {
    const found = isObj(i.target) ? i.target : null;
    if (found?.kind === "engagedEnemies") return { text: `return ${found.pick === "choose" ? "one enemy" : "every enemy"}${typeof found.trait === "string" ? ` with the trait ${found.trait}` : ""}${typeof found.keyword === "string" ? ` with the ${found.keyword} keyword` : ""} engaged with ${found.who === "actor" ? "the acting player" : "a player"}${found.pick === "choose" ? " (that player picks which)" : ""} to the staging area`, read: ["target"] };
    if (found?.kind === "self" && ctx.attacker === true) return { text: "return the attacking enemy (the card whose shadow this is the attacker of) to the staging area", read: ["target"] };
    return { text: `return ${target(i.target)} to the staging area`, read: ["target"] };
  },
  PlaceFacedownUnder: (i) => ({
    text: `${i.afterAttack === true ? "once the attack in progress has ended, " : ""}place ${cardRef(i.target ?? "picked")} facedown under ${i.host === "self" ? "this card" : `the card with code ${str(i.code)} in play`} (out of play there; its attachments are discarded, its tokens go${i.host === "self" ? "; a player card stays its owner's" : ""})`,
    read: ["code", "target", "afterAttack", "host"],
  }),
  AttachToDial: (i) => ({
    text: typeof i.code === "string" ? `the acting player attaches a set-aside copy of the card with code ${str(i.code)} to their threat dial (nothing when the dial holds one already, Limit 1 per threat dial, or none is set aside)` : i.firstPlayer === true ? `this card attaches itself to the first player's threat dial (whoever reveals it${i.unlimited === true ? "; a dial that holds a copy takes another" : ""})` : "this card attaches itself to the acting player's threat dial (nothing when the dial holds a copy already)",
    read: ["code", "firstPlayer", "unlimited"],
  }),
  DetachFromDial: (i) => ({
    text: typeof i.code === "string" ? `the copy of the card with code ${str(i.code)} on the acting player's threat dial is detached and set aside, out of play` : "this card is detached from the acting player's threat dial and set aside, out of play",
    read: ["code"],
  }),
  EngageLastPlayer: () => ({ text: "the source enemy engages the last player", read: [] }),
  AttachSetAside: (i) => ({ text: `the set-aside copy of the card with code ${str(i.code)} is attached to the last picked hero${i.removeWhenLeaving === true ? "; if it would leave play it is removed from the game" : ""}${i.claimed === true ? "; an objective card is claimed by it (it returns to the staging area when it is detached)" : ""}`, read: ["code", "removeWhenLeaving", "claimed"] }),
  RemoveSetAside: (i) => ({ text: `every set-aside copy of the card with code ${str(i.code)} is removed from the game`, read: ["code"] }),
  DiscardHand: (i) => ({ text: `${i.who === "eventSeat" ? "the player the event is about" : "the acting player"} discards all the cards in their hand`, read: ["who"] }),
  FreeRingBearer: () => ({ text: "(rule marker) the first player gains control of the Ring-bearer a card guards as soon as that card is out of play: it returns among their heroes where it was, as it was held", read: [] }),
  AttachToHeroWith: (i) => ({ text: `a copy of the card with code ${str(i.code)}, from the supply, is attached to the hero that has the card with code ${str(i.with)} attached (nothing with no such hero)`, read: ["code", "with"] }),
  SetAsideBoon: (i) => ({
    text: `each player chooses a boon with the trait ${str(i.trait)}, other than the card with code ${str(i.except)}, from the campaign pool cards dealt to them and sets it aside, out of play, leaving it out of their deck this game (nothing for a player with none)`,
    read: ["trait", "except"],
  }),
  GuardWithSetAside: (i) => ({
    text: `each set-aside ${str(i.kind)} is attached faceup to the card with code ${str(i.host)} in play as a guarded objective, held for its owner and returning to their hand when that card leaves play (it stays set aside while that card is not in play)`,
    read: ["host", "kind"],
  }),
  MoveAttachment: (i) => ({ text: `the card with code ${str(i.code)} in play moves, with what is on it, to ${i.to === "ringBearer" ? "the Ring-bearer" : "the last picked hero"} (one card moves; it never leaves play)`, read: ["code", "to"] }),
  ReturnFromVictory: (i) => ({ text: `the card with code ${str(i.code)} in the victory display returns to the staging area as the card with code ${str(i.into)}, faceup, ready, controlled by no one and with no damage`, read: ["code", "into"] }),
  ResolveAttackAgainst: () => ({ text: "the attack in progress is resolved against the last picked enemy instead of the defenders: that enemy takes the damage after its Defense", read: [] }),
  SetPursuit: (i) => ({ text: `set the pursuit value to ${str(i.value)}`, read: ["value"] }),
  RaisePursuit: (i, ctx) => ({ text: `increase the pursuit value by ${amount(i.amount, ctx)}`, read: ["amount"] }),
  LowerPursuit: (i, ctx) => ({ text: `reduce the pursuit value by ${amount(i.amount, ctx)} (never below 0)`, read: ["amount"] }),
  Time: (i) => (i.perPlayer === true
    ? { text: `Time ${str(i.amount)} for each player: when this card is revealed, ${str(i.amount)} times the players still in the game resource tokens (time counters) are put on it, counted once, and one comes off at the end of each refresh phase`, read: ["amount", "perPlayer"] }
    : { text: `Time ${str(i.amount)}: when this card is revealed, ${str(i.amount)} resource tokens (time counters) are put on it, and one comes off at the end of each refresh phase`, read: ["amount"] }),
  RemoveTimeCounters: (i) => {
    if (i.target == null) return { text: "one time counter comes off each card in play with Time X (the end of the refresh phase, after its Forced effects); a card whose last counter goes hears it", read: ["target", "amount", "perPlayer"] };
    const counters = `${str(i.amount ?? 1)} time counter${i.amount === 1 || i.amount == null ? "" : "s"}${i.perPlayer === true ? " for each player still in the game" : ""}`;
    const who = i.target === "picked" ? "the last picked card (an enemy with Time X; a card with no Time loses none)" : "each enemy in play with Time X";
    return { text: `${counters} come off ${who}, one at a time, stopping when none is left; a card whose last counter goes hears it once`, read: ["target", "amount", "perPlayer"] };
  },
  HoldUnder: (i) => ({ text: `the card with code ${str(i.code)} that a player controls lies facedown under this card, still in play, controlled by no one, with what is attached to it; when this card is defeated it returns under the first player, exhausted`, read: ["code"] }),
  DiscardHeld: () => ({ text: "the card held under this card is discarded from where it lies, and leaves play", read: [] }),
  PlaceHandUnderSelf: () => ({ text: "the acting player places every card in their hand facedown under this card (out of play, still theirs)", read: [] }),
  ChooseCurrentQuest: (i) => ({ text: i.until === "endOfRound" ? "the first player chooses a quest card other than the current quest (the main quest card, a quest stage in play together, or a side quest in the staging area) to be the current quest until the end of the round" : "the first player chooses a quest card other than the current quest (the main quest card, or an encounter side quest in the staging area) to be the current quest until the end of the phase", read: ["until"] }),
  AttachNewTo: (i) => ({ text: `a copy of the card with code ${str(i.code)} from the supply is put into play attached to the card titled "${str(i.to)}"`, read: ["code", "to"] }),
  TradeDamageForResources: (i) => ({ text: `starting with the first player, each player may place ${str(i.damage)} damage on the card with code ${str(i.code)} to add ${str(i.resources)} resource to each of their heroes' pools`, read: ["code", "damage", "resources"] }),
  AddSetAsideToStaging: (i) => ({ text: `${i.all === true ? "every" : "one"} ${i.outOfPlay === true ? "out-of-play" : "set-aside"} card ${typeof i.code === "string" ? `with code ${i.code}` : `with the trait ${str(i.trait)}`} joins the staging area (it is not revealed)`, read: ["code", "trait", "all", "outOfPlay"] }),
  PlayFromHand: (i, ctx) => ({
    text: `the acting player plays ${i.picked === true ? `each card picked so far (a ${pick(i.pick, ctx)}) that is in its owner's hand` : `a ${pick(i.pick, ctx)} from their hand`} as part of the effect${i.free === true ? ", at no cost (no payment at all)" : ""}${typeof i.reduce === "number" ? `, its cost reduced by ${i.reduce}${typeof i.min === "number" ? ` (not below ${i.min})` : ""}` : ""}${i.noMatch === true ? ", needing no resource match" : ""}${i.onSelf === true ? ", an attachment played on this card" : ""}`,
    read: ["pick", "picked", "free", "reduce", "min", "noMatch", "onSelf"],
  }),
  AttachesTo: (i, ctx) => {
    const host = isObj(i.host) ? i.host : null;
    const kinds: Readonly<Record<string, string>> = { hero: "hero", character: "character", activeLocation: "active location", ringBearer: "Ring-bearer", quest: "quest card in play" };
    const named = host ? `${typeof host.sphere === "string" ? `${host.sphere} ` : ""}${typeof host.trait === "string" ? `${host.trait} ` : ""}${kinds[str(host.kind)] ?? str(host.kind)}${typeof host.name === "string" ? ` named "${host.name}"` : ""}` : null;
    const where = Array.isArray(i.hosts) ? `a card that is ${joinOr(i.hosts.map((one) => `a ${pick(one, ctx)}`))}` : named ? `a ${named}` : "any character";
    return { text: `this attachment may be attached to ${where}${i.limitPerHost === true ? " (limit 1 of it per host)" : ""}`, read: ["host", "hosts", "limitPerHost"] };
  },
  Safe: () => ({ text: "(rule marker) this card has the Safe keyword: when the players travel to it all engaged enemies return to the staging area, and while it is the active location treacheries' When Revealed effects are ignored, encounter side quests' text boxes are blank and enemies make no engagement checks (its other lines say each)", read: [] }),
  StageRandomGuardedPair: () => ({ text: "of the set-aside encounter side quests one, and of the set-aside objective-locations one, are picked at random (the game's seed) and revealed and added to the staging area, the side quest attached to the location as its guard", read: [] }),
  RevealCard: (i) => ({ text: `${i.card === undefined ? "the picked card" : cardRef(i.card)} is revealed by the acting player as an encounter card, wherever it lies: Surge and Doomed, When Revealed effects and the Responses to a reveal resolve, and it ends where its type puts it (nothing with no card picked)`, read: ["card"] }),
  ReleaseGuards: (i) => ({ text: `the encounter cards that guard ${i.target === undefined ? "the picked card" : cardRef(i.target)} stay in the staging area and no longer guard it`, read: ["target"] }),
  RevealSetAsideForTokens: (i) => ({ text: `if this card holds at least ${str(i.tokens)} resource tokens and a copy of the card with code ${str(i.code)} is set aside: ${str(i.tokens)} tokens come off this card and that copy is revealed as an encounter card (nothing otherwise)`, read: ["code", "tokens"] }),
  EarnEncounterCopies: (i) => ({ text: `one copy of the card${Array.isArray(i.codes) && i.codes.length > 1 ? "s" : ""} with code ${Array.isArray(i.codes) ? joinAnd(i.codes.map(str)) : "?"} joins the Campaign Pool for each copy lying in the encounter deck or the encounter discard pile (a copy set aside, in the staging area or attached does not count)`, read: ["codes"] }),
  ShuffleSetAsideIntoEncounterDeck: (i) => ({ text: `${i.all === true ? "every" : "one"} set-aside copy of the card with code ${str(i.code)}${i.own === true ? " (the acting player's own)" : ""} is shuffled into the encounter deck (nothing with none set aside)`, read: ["code", "own", "all"] }),
  AddStageProgress: (i, ctx) => ({ text: `${typeof i.amount === "number" ? `${i.amount} progress is` : `progress equal to ${amount(i.amount, ctx)} is`} placed on the main quest stage (a quest effect: a full stage advances)`, read: ["amount"] }),
  AddToVictory: (i) => ({ text: `${i.target === undefined ? "the picked card" : cardRef(i.target)} is added to the victory display`, read: ["target"] }),
  HeroesGainResources: (i, ctx) => ({ text: `each hero ${i.who === "picked" ? "the picked player controls" : "the acting player controls"} gains ${amount(i.amount, ctx)} resource(s)${i.unspent === true ? " if it spent none this round" : ""}`, read: ["amount", "who", "unspent"] }),
  MakeActive: (i) => ({ text: i.random === true ? `a location of the staging area chosen at random (with the game's seed) becomes the active location without traveling (the active location goes back to the staging area, keeping its tokens); a Forced effect "after it becomes the active location" resolves` : `${i.target === undefined ? "the picked card" : cardRef(i.target)} (a location in the staging area) becomes the active location without traveling (another active location goes back to the staging area); a Forced effect "after it becomes the active location" resolves`, read: ["target", "random"] }),
  ControlledBy: (i) => ({ text: `${cardRef(i.card)} is controlled by ${i.who === "lastPlayer" ? "the last player" : i.who === "firstPlayer" ? "the first player" : str(i.who)} while this holds${i.intoPlay === true ? " (a card in the staging area joins that player's play area, faceup and ready)" : ""}${i.follows === true ? ", and passes to each new first player when the token moves" : ""}`, read: ["who", "card", "intoPlay", "follows"] }),
  ShuffleIntoDeck: (i) => ({ text: `${i.each === true ? "every" : "one"} ${typeof i.trait === "string" ? `${i.trait} ` : ""}${typeof i.type === "string" ? i.type : "card"}${typeof i.code === "string" ? ` with code ${i.code}` : ""} in the encounter discard pile${i.who === "firstPlayer" ? " (chosen by the first player)" : ""} goes back into the encounter deck, which is shuffled (nothing with none there)`, read: ["code", "trait", "type", "each", "who"] }),
  CancelEffect: () => ({ text: "the effect being resolved is canceled: nothing after this resolves", read: [] }),
  SetAsideFromDeck: (i) => ({ text: `the copy of the card with code ${str(i.code)} in the encounter deck is set aside, out of play`, read: ["code"] }),
  RemoveCodeFromGame: (i) => ({ text: `the card in play with code ${str(i.code)} is removed from the game, wherever it is (in the staging area or attached)`, read: ["code"] }),
  RemoveFromGame: (i) => ({ text: `${i.self === true ? "this card" : i.card === undefined ? "the last picked card" : cardRef(i.card)} is removed from the game`, read: ["self", "card"] }),
  SetAside: (i) => ({ text: `a copy of the card with code ${str(i.code)} is set aside, out of play`, read: ["code"] }),
  PlaceToken: (i, ctx) => ({ text: `${i.amount === undefined ? "1" : amount(i.amount, ctx)} resource token(s) are placed on this card`, read: ["amount"] }),
  PickHighestThreat: () => ({ text: "the player with the highest threat becomes the picked player (the first player chooses among a tie)", read: [] }),
  SwitchActor: (i) => ({ text: `the effect goes on with ${i.to === "picked" ? "the picked player" : str(i.to)} as the acting player`, read: ["to"] }),
  DiscardUntil: (i) => ({ text: `cards are discarded from the top of the encounter deck until ${typeof i.type === "string" ? withArticle(i.type === "encounter-side-quest" ? "side quest" : i.type) : Array.isArray(i.types) ? withArticle(i.types.map(str).join(" or ")) : "a card"}${typeof i.trait === "string" ? ` with the trait ${i.trait}` : ""} is discarded, or the deck is empty${i.reshuffle === true ? " (a deck that runs out has the encounter discard pile shuffled into it first, when it holds one)" : ""}; that card becomes the picked card`, read: ["type", "types", "trait", "reshuffle"] }),
  GuardObjective: (i) => ({ text: `the Guarded keyword: ${i.target === undefined ? "this objective" : cardRef(i.target)} in the staging area is guarded by ${Array.isArray(i.types) ? `the first encounter ${i.types.map(str).join(" or ")} discarded from the deck, added to the staging area` : "the next encounter card of the deck that is not an objective, revealed and attached to it"}`, read: ["target", "types"] }),
  AttachGuard: (i) => ({
    text: `${i.guard === undefined ? "this card" : cardRef(i.guard)} becomes the guard of ${i.to === undefined ? "the picked objective" : cardRef(i.to)}, attached to it in the staging area${i.replaceGuards === true ? " (the objective's own guards are detached first and stay in the staging area)" : ""}${i.stayEngaged === true ? " (an engaged guard stays engaged)" : ""}${i.detach === true ? " (an objective a character holds is detached first, into the staging area faceup and unclaimed)" : ""}`,
    read: ["guard", "to", "replaceGuards", "stayEngaged", "detach"],
  }),
  FirstTraitSurge: (i) => ({ text: `the first ${str(i.trait)} ${i.type === "enemy" ? "enemy card" : i.type === "any" ? "card (of any type)" : "treachery card"} revealed each round gains surge${i.doomed != null ? ` and doomed ${str(i.doomed)}` : ""}`, read: ["trait", "type", "doomed"] }),
  RevealedGainDoomed: (i) => ({ text: `until the end of the ${i.until === "endOfRound" ? "round" : i.until === "endOfPhase" ? "phase" : str(i.until)}, each card revealed gains doomed ${str(i.amount)}${i.instead != null ? ` (doomed ${str((i.instead as Obj).amount)} while the current stage is stage ${str((i.instead as Obj).stage)})` : ""}, recalculated as each is revealed`, read: ["amount", "instead", "until"] }),
  DiscardFromDeck: (i, ctx) => ({
    text: `the top ${amount(i.amount, ctx)} card(s) of the acting player's deck${i.shuffle === true ? " (shuffled first)" : ""} go to their discard pile${i.count === undefined ? "" : `; X becomes how many of them are a ${pick(i.count, ctx)}${i.costAtLeast === undefined ? "" : ` with a printed cost of at least ${amount(i.costAtLeast, ctx)}`}`}`,
    read: ["amount", "shuffle", "count", "costAtLeast"],
  }),
  MoveCard: (i) => ({ text: `${i.card === undefined ? "the picked card" : cardRef(i.card)}${Array.isArray(i.from) ? ` (only from ${joinAnd(i.from.map(str))})` : ""} goes ${MOVE_CARD_TO[str(i.to)] ?? `to ${str(i.to)}`}`, read: ["card", "from", "to"] }),
  PickDiscardTop: (i) => ({ text: `the topmost ${Array.isArray(i.types) ? i.types.map(str).join(" or ") : "?"}${typeof i.trait === "string" ? ` with the trait ${i.trait}` : ""} in the encounter discard pile (the last put there) is picked (nothing with none)`, read: ["types", "trait"] }),
  MoveEncounterCard: (i) => ({ text: `${i.card === undefined ? "the picked card" : i.card === "deckTop" ? "the top card of the encounter deck" : i.card === "discardTop" ? "the top card of the encounter discard pile" : cardRef(i.card)} ${ENCOUNTER_MOVE[str(i.to)] ?? `goes to ${str(i.to)}`}`, read: ["card", "to"] }),
  GainSurge: () => ({ text: "this card gains surge (one more encounter card is revealed when it has been resolved)", read: [] }),
  CountsAs: (i) => ({ text: i.trait === undefined ? `this card counts as an ${str(i.cardType)} while it is attached` : `this card counts as a ${str(i.trait)} ${str(i.cardType)} while it is attached`, read: ["cardType", "trait"] }),
  IncreaseCost: (i, ctx) => ({ text: `while this card is in play, each card a player plays (${i.fromHand === true ? "from its owner's hand only" : "from any zone"}) that is a ${pick(i.pick, ctx)} costs ${str(i.amount)} more (every player's; several such cards stack)`, read: ["amount", "pick", "fromHand"] }),
  SetX: (i) => ({ text: `the effect's X is set to ${str(i.value)}`, read: ["value"] }),
  DiscardTopOfDeck: () => ({ text: "the acting player discards the top card of their deck; its printed cost (0 with none or an X cost) is added to the effect's X", read: [] }),
  DiscardResources: (i, ctx) => ({ text: `${i.all === true ? "all the resources" : `${i.amount === undefined ? "1" : amount(i.amount, ctx)} resource(s)`} come off the resource pool of ${cardRef(i.target ?? "picked")} (discarded, not spent)`, read: ["amount", "all", "target"] }),
  ReturnToStage: (i) => ({ text: `the players return to stage ${str(i.stage)} of the quest deck (side B: the stage comes back as if just beginning, with no progress; the progress on the active location and every other card stay; no When Revealed or Setup resolves again)`, read: ["stage"] }),
  RemoveProgressEach: (i, ctx) => ({ text: `remove up to ${amount(i.amount, ctx)} progress from each ${pick(i.pick, ctx)} (the number of tokens removed in all is the effect's X)`, read: ["amount", "pick"] }),
  RemoveAllProgress: (i, ctx) => ({ text: `remove all the progress from ${i.pick !== undefined ? `each ${pick(i.pick, ctx)}` : cardRef(i.target ?? "picked")}`, read: ["target", "pick"] }),
  UndefendedDamageTo: (i, ctx) => ({ text: `the damage of this attack, if undefended, must go on a ${pick(i.pick, ctx)}${i.character === true ? " in play, whoever controls it" : " the defending player controls"}, if able (${i.character === true ? "" : "the player names the hero among them; "}a defended attack still damages its defender)`, read: ["pick", "character"] }),
  LookAtEncounterTop: () => ({ text: "the acting player looks at the top card of the encounter deck in a look window (it is not revealed and stays on the deck)", read: [] }),
  LookAtTop: (i, ctx) => ({ text: `${who("actor")} looks at the top ${i.count === undefined ? "1" : amount(i.count, ctx)} card(s) of ${i.deck === "own" ? "their own deck" : i.deck === "picked" ? "the picked player's deck" : "the encounter deck"} (a card with a Forced effect for being looked at acts at once and is not one of them)`, read: ["count", "deck"] }),
  DiscardOtherLooked: () => ({ text: "the cards looked at, but the picked one, go to the encounter discard pile faceup; the picked card is then the top card of the encounter deck", read: [] }),
  RaiseStagingThreat: (i, ctx) => ({ text: i.live === "scoutEnemiesInPlay" ? `the total Threat in the staging area is raised, live, by 1 for each Scout enemy in play ${STAT_UNTIL[str(i.until)] ?? ""}` : i.live === "alliesInDiscard" ? `the total Threat in the staging area is raised, live, by the allies in a discard pile ${STAT_UNTIL[str(i.until)] ?? ""}` : `the total Threat in the staging area is ${amount(i.amount, ctx)} higher ${STAT_UNTIL[str(i.until)] ?? str(i.until)}`, read: ["amount", "until", "live"] }),
  PutSetAsideInPlay: (i) => ({ text: `the set-aside card titled "${str(i.name)}" is put into play under ${typeof i.withCard === "string" ? `the control of the player who controls the card titled "${i.withCard}"` : i.to === "lastPlayer" ? "the last player" : i.to === "anyPlayer" ? "a player the first player chooses" : i.to === "actor" ? "the acting player" : "the first player"}`, read: ["name", "to", "withCard"] }),
  AttachRandomBurden: (i) => ({ text: `one of the burdens ${Array.isArray(i.codes) ? joinAnd(i.codes.map((code) => `code ${str(code)}`)) : "?"} not yet in the game is picked at random (the game's seed) and attached to ${i.to === undefined ? "the card the event is about" : cardRef(i.to)}, though it cannot have attachments (nothing when none is loaded)`, read: ["codes", "to"] }),
  MoveToHero: (i) => ({ text: `this burden moves to the hero (any player's) that holds the most ${MOST[str(i.most)] ?? str(i.most)}; the hero it is on counts, and the first player chooses among heroes that tie`, read: ["most"] }),
  AttachSelfToNamed: (i) => ({ text: `this card is attached to the card in play titled "${str(i.name)}"${i.outOfPlay === true ? " (or one set aside, out of play)" : ""}; with none it is removed from the game`, read: ["name", "outOfPlay"] }),
  MoveDamageTo: (i) => ({ text: `${i.amount === undefined ? "all the damage" : `up to ${str(i.amount)} damage`} on ${cardRef(i.from)} moves to ${cardRef(i.to)} (placed, not dealt; it can destroy a character at its limit; nothing with the target out of play)`, read: ["from", "to", "amount"] }),
  EndPhase: () => ({ text: "the phase in progress ends once this effect has finished (what is left of it is skipped: in the quest phase the characters stay exhausted and uncommitted and the quest is not resolved; in the combat phase no attack is made); its end-of-phase Forced effects resolve as it ends", read: [] }),
  PlaceLoggedDamageOn: (i) => ({ text: `the card with code ${str(i.code)} in play gets the damage the Campaign Log noted for Protect the Innocent (none when it noted none)`, read: ["code"] }),
  ChooseBoon: (i) => ({ text: `starting with the first player, each player may choose 1 of the boons still set aside (${Array.isArray(i.codes) ? joinAnd(i.codes.map((code) => `code ${str(code)}`)) : "?"}) and attach it to a hero they control; a boon taken is not offered again`, read: ["codes"] }),
  RemoveResourceTokens: (i, ctx) => ({ text: `up to ${amount(i.amount, ctx)} resource token(s) come off ${i.on === "picked" ? "the picked card" : i.on === "subject" ? "the card the event is about" : i.on === "self" ? "this card" : `the card with code ${str(i.code)} in play`}`, read: ["code", "on", "amount"] }),
  SearchMove: (i, ctx) => ({
    text: `${i.each === true ? "every" : "the acting player finds one"} ${i.nonUnique === true ? "non-unique " : ""}${typeof i.trait === "string" ? `${i.trait} ` : Array.isArray(i.traits) ? `${i.traits.map(str).join(" or ")} ` : ""}${typeof i.type === "string" ? i.type : Array.isArray(i.types) ? i.types.map(str).join(" or ") : "card"}${searchLimits(i)}${i.safe === true ? " with the safe keyword" : ""}${typeof i.code === "string" ? ` with code ${i.code}` : ""} ${i.discardOnly === true ? "in the encounter discard pile (the deck is not searched)" : `in the encounter deck${i.deckOnly === true || typeof i.top === "number" ? "" : " or its discard pile"}`}${i.victory === true ? " or the victory display" : ""} and ${i.to === "engaged" ? (i.engagedSeat === "picked" ? "puts it into play engaged with the picked player" : "puts it into play engaged with them") : i.to === "engagedFirstPlayer" ? "puts it into play engaged with the first player" : i.to === "stormcallerArea" ? "adds it to the Stormcaller's area" : "adds it to the staging area"} (it is not revealed)${i.different === true ? "; its title must differ from every card an earlier search of this effect found" : ""}${i.remember === true ? "; it is the picked card afterward" : ""}${typeof i.require === "string" ? `; while the card with code ${i.require} is there to be found, the search must take it (${i.requireFor === "picked" ? "the search of the player the first player named" : "the first search of the effect that can"})` : ""}${searchPolicy(i)}`,
    read: ["trait", "traits", "type", "safe", "code", "to", "engagedSeat", "different", "each", "deckOnly", "discardOnly", "victory", "remember", "nonUnique", "require", "requireFor", "maxCost", "maxCostMulti", "types", "top", "byChallenge"],
  }),
  AssignDamage: (i, ctx) => ({ text: `${i.who === "eachSeat" ? "each player" : "the acting player"} assigns ${amount(i.amount, ctx)} damage ${i.single === true ? `to 1 of the ${pick(i.pick, ctx)}, all of it` : `among the ${pick(i.pick, ctx)}, one at a time`}`, read: ["amount", "pick", "who", "single"] }),
  ExhaustEach: (i, ctx) => ({ text: `exhaust each ${pick(i.pick, ctx)}`, read: ["pick"] }),
  RemoveFromQuest: () => ({ text: "the last picked character is removed from the quest (it stays exhausted)", read: [] }),
  AttachToQuest: (i) => ({ text: i.main === true ? "this card is attached to the main quest card (never a side quest) and leaves with it" : "this card is attached to the current quest card (the side quest that is the current quest, else the main quest card) and leaves with it", read: ["main"] }),
  ShufflePile: (i) => ({ text: `shuffle the ${str(i.pile)} deck`, read: ["pile"] }),
  AddFromPile: (i, ctx) => ({
    text: i.reveal === true
      ? `${who(i.who ?? "actor")} reveals the top card of the ${str(i.pile)} deck and resolves its staging, into the ${i.to === "engaged" ? "engaged area" : "staging area"}, as if it was just revealed from the encounter deck (nothing with the deck empty)`
      : `for ${who(i.who ?? "actor")}, the top ${i.count === undefined ? "" : `${amount(i.count, ctx)} `}card(s) of the ${str(i.pile)} deck go to ${i.to === "engaged" ? "the engaged area" : "the staging area"}${i.attachSource === true ? ", attached to this card" : ""}`,
    read: ["pile", "to", "count", "who", "attachSource", "reveal"],
  }),
  ShufflePileIntoEncounterDeck: (i) => ({ text: `shuffle the ${str(i.pile)} deck into the encounter deck`, read: ["pile"] }),
  StageSetAside: (i) => {
    const which = typeof i.code === "string" ? `with code ${i.code}` : `titled "${str(i.name)}"`;
    const how = i.reveal === true ? "is revealed (its keywords and When Revealed effects resolve) and added to the staging area" : "joins the staging area (not revealed)";
    return { text: `the set-aside card ${which} ${how}${i.remember === true ? "; it becomes the picked card" : ""}`, read: ["code", "name", "remember", "reveal"] };
  },
  ResolveWhenRevealed: (i) => ({ text: i.reveal === true ? `${i.card === undefined ? "the picked card" : cardRef(i.card)} is revealed in full (its keywords and When Revealed effects)` : `the When Revealed effects of ${i.card === undefined ? "the picked card" : cardRef(i.card)} resolve as if it had just been revealed`, read: ["card", "reveal"] }),
  RevealMore: (i) => ({ text: `reveal ${str(i.amount)} additional encounter card(s)${i.perPlayer === true ? " for each player" : ""} in the staging step this phase (the extra reveals go to the players in turn after the one each player makes, so the first player makes the first of them; while the stages are separate, to the player whose stage holds the effect)`, read: ["amount", "perPlayer"] }),
  FlipInPlace: (i) => ({ text: `the card with code ${str(i.code)} in play is flipped to the card with code ${str(i.into)}, where it lies, with its tokens and attachments${i.attachTo === "picked" ? ", and moves to the last picked hero" : ""}${i.entersPlay === true ? "; the new side enters play" : ""}`, read: ["code", "into", "attachTo", "entersPlay"] }),
  AddToPool: (i) => ({ text: `the card with code ${str(i.code)} is added to the Campaign Pool${i.eachPlayer === true ? " (a copy for each player)" : ""}`, read: ["code", "eachPlayer"] }),
  ShuffleIntoEncounterDeck: (i) => ({ text: `a card with code ${str(i.code)} from the box joins the encounter deck, which is shuffled`, read: ["code"] }),
  AddToStaging: (i) => ({ text: `the card with code ${str(i.code)} is added to the staging area (the copy a Setup search found, else one the Setup deals)`, read: ["code"] }),
  RecordDamageOn: (i) => ({ text: `note the damage on the card${Array.isArray(i.codes) && i.codes.length > 1 ? "s" : ""} with code ${Array.isArray(i.codes) ? joinAnd(i.codes.map(str)) : "?"} in the Campaign Log (replacing the previous number)`, read: ["codes"] }),
  EarnAttached: (i) => ({ text: `each copy of ${Array.isArray(i.codes) ? joinAnd(i.codes.map((code) => `code ${str(code)}`)) : "?"} attached to a hero in play joins the Campaign Pool attached to that hero`, read: ["codes"] }),
  RemoveFromCampaignPool: () => ({ text: "this card is removed from the Campaign Pool", read: [] }),
  CancelDamage: (i, ctx) => ({ text: i.all === true ? "cancel all of the damage just dealt" : `cancel up to ${i.amount === undefined ? "1" : amount(i.amount, ctx)} point(s) of the damage just dealt${i.target === undefined ? "" : ` to ${cardRef(i.target)}`}`, read: ["amount", "all", "target"] }),
  ChooseX: (i, ctx) => ({ text: `the acting player chooses X, from ${i.min === undefined ? "1" : str(i.min)} to ${chooseXMost(i.max, ctx)}`, read: ["min", "max"] }),
  PayFromHero: (i) => ({ text: `a resource from the pool of the hero named ${str(i.name)} may pay for this card, even when its player does not control that hero`, read: ["name"] }),
  MoveDamage: (i, ctx) => ({ text: `move ${i.all === true ? "all" : amount(i.amount, ctx)} damage from the card picked before the last to the last picked card`, read: ["amount", "all"] }),
  TakeLoggedCaptives: (i) => ({ text: `each seat the Campaign Log names a Captive for has that hero lie faceup under the card with code ${str(i.under)}`, read: ["under"] }),
  MakeCaptive: (i) => ({ text: `the picked hero becomes a Captive: it lies faceup under the card with code ${str(i.under)}, in play and controlled by no one`, read: ["under"] }),
  HoldCaptive: () => ({ text: "the picked Captive is attached to this card", read: [] }),
  ReturnCaptive: (i) => ({ text: `the Captive this card holds lies faceup under the card with code ${str(i.under)} again`, read: ["under"] }),
  DamageHeldCaptive: (i, ctx) => ({ text: `deal ${amount(i.amount, ctx)} damage to the Captive this card holds`, read: ["amount"] }),
  DiscardRandomFromHand: (i, ctx) => ({
    text: `${i.who === "eachSeat" ? "each player" : i.who === "firstPlayer" ? "the first player" : "the acting player"} discards ${i.amount === undefined ? "1" : amount(i.amount, ctx)} random card(s) from hand${i.remember === true ? " (the last card discarded becomes the picked card)" : ""}${i.raiseByCost === true ? "; the discarding player's threat is raised by the discarded card's printed cost (0 for a card with no printed cost or an X cost)" : ""}${i.raiseStagingByCost === true ? "; until the end of the phase the total Threat in the staging area is raised by the total printed cost of the cards discarded" : ""}`,
    read: ["amount", "who", "remember", "raiseStagingByCost", "raiseByCost"],
  }),
  SearchReveal: (i) => ({
    text: `the ${i.who === "firstPlayer" ? "first player" : "acting player"} searches the encounter deck${i.deckOnly === true ? " (not its discard pile)" : " and discard pile"} for ${typeof i.code === "string" ? `the card with code ${i.code}, a ` : ""}${typeof i.trait === "string" ? `a ${i.trait} ` : Array.isArray(i.traits) ? `a ${i.traits.map(str).join(" or ")} ` : "a "}${typeof i.type === "string" ? i.type : "card"}, reveals it and ${i.to === "engaged" ? "puts it into play engaged with them" : "adds it to the staging area"}${i.cost === true ? " (a Travel cost: payable only when a card is found)" : ""}`,
    read: ["trait", "traits", "type", "who", "to", "cost", "code", "deckOnly"],
  }),
  EndQuestPhase: (i) => ({ text: i.own === true ? "end the acting player's own quest phase (no more cards are revealed for him, his characters stop being committed and his quest is not resolved; the other players finish theirs)" : "end the quest phase at once (no quest resolution)", read: ["own"] }),
  ImmediateAttack: (i, ctx) => ({
    text: `${i.afterThis === true ? "the attacking enemy makes an additional attack against the defending player once this attack has ended" : i.target === "subject" ? "the enemy the event is about, engaged with a player, attacks that player now" : ctx.attacker !== true ? "this enemy attacks now" : ctx.engagedNext === true ? "the attacking enemy makes an immediate attack against the player it just engaged" : "the attacking enemy attacks again, the player it is engaged with (the defending player; an additional attack)"}${i.shadow === false ? (i.keepShadows === true ? ", dealt no new shadow card (the shadow cards it holds all resolve)" : ", dealt no shadow card") : i.afterThis === true ? ", dealt a new shadow card" : ", dealt a new shadow card after its old ones are discarded"}${typeof i.blankBonus === "number" ? `; when the shadow card dealt for it has no shadow effect the enemy gets +${i.blankBonus} Attack for this attack` : ""}`,
    read: ["shadow", "afterThis", "keepShadows", "blankBonus", "target"],
  }),
  ConsiderUndefended: (i) => ({ text: `${i.removeDefenders === true ? "remove all defending characters from combat; " : ""}this attack is considered undefended`, read: ["removeDefenders"] }),
  DiscardShadowOf: (i) => ({ text: `discard ${i.all === true ? "each shadow card" : "a shadow card"} dealt to ${cardRef(i.target ?? "picked")}`, read: ["target", "all"] }),
  FlipTwoSided: (i) => ({ text: `the card with code ${str(i.front)} or ${str(i.back)} in play is flipped to show the other of the two, where it lies, with its damage, tokens, shadow cards and attachments`, read: ["front", "back"] }),
  DealShadowInPlay: (i) => ({
    text: i.target === undefined ? `each ${typeof i.trait === "string" ? `${i.trait} ` : ""}enemy in play (in the staging area or engaged) is dealt 1 shadow card from the encounter deck (in a Travel line this is a cost: the players cannot travel unless the encounter deck holds a card for each of them)` : `${cardRef(i.target)} is dealt 1 shadow card from the encounter deck, wherever it is`,
    read: ["target", "trait"],
  }),
  SetStat: (i) => ({ text: `${i.target === "host" ? "the card this one is attached to" : "this card"}: stat ${str(i.stat)} is set to ${str(i.value)}, overriding every other modifier of it`, read: ["stat", "value", "target"] }),
  DestroyHighestCostAlly: () => ({ text: "the ally with the highest printed cost among every player's allies in play (no printed cost or X counts 0; the first player chooses among ties) is destroyed, and is the picked card in its owner's discard pile", read: [] }),
  DiscardOtherInPlay: () => ({ text: "the other card of the event (the card this one was attached to) is discarded if it is still in play", read: [] }),
  MakeSetAsideActive: (i) => ({ text: `the set-aside card with code ${str(i.code)} becomes the active location (not traveling: no Travel effect, nothing hears "traveled"); a location already active returns to the staging area, unless a second active location slot is free`, read: ["code"] }),
  PlaceProgressInStaging: (i) => ({ text: i.divided === true ? "the first player divides the progress left as they choose among the locations in the staging area, choosing a location and then how much of it goes on that location (no more than it still needs), again and again, until none is left or no location can take any more (they may not keep the rest on the stage)" : "the first player chooses a location in the staging area that can take progress and it takes all it can of the progress left, again and again, until none is left or no location can take any more, or they keep the rest on the stage", read: ["divided", "at"] }),
  RemovePickedFromGame: () => ({ text: "the picked card is removed from the game (neither discarded nor lost from the Campaign Pool)", read: [] }),
  DiscardCopiesFromDeck: (i) => ({
    text: `the acting player searches their deck for ${i.all === true ? "each" : "one"} other card with the title of ${i.of === "picked" ? "the card this effect picked (the one just discarded from the hand)" : "the other card of the event, if it is an ally"} and discards ${i.all === true ? "them" : "it"}${i.shuffle === true ? ", then shuffles the deck" : ""}`,
    read: ["of", "all", "shuffle"],
  }),
  EngageFirstPlayer: (i) => ({ text: `${i.target === "subject" ? "the enemy the event is about" : i.target === "picked" ? "the picked enemy" : "this enemy"}, in the staging area${i.moves === true ? " or engaged with another player (it moves)" : ""}, engages the first player`, read: ["moves", "target"] }),
  TakeControl: (i) => ({ text: `${i.who === "firstPlayer" ? "the first player" : i.who === "actor" ? "the acting player" : str(i.who)} takes control of this card (it enters play under that player, ready; a shadow card stops being its enemy's shadow card)`, read: ["who"] }),
  TravelOrRaiseThreat: (i) => ({ text: `when the players are faced with the option to travel, declining to travel or traveling to a location with another title raises each player's threat by ${str(i.amount)} (traveling to a location with this title costs nothing; copies are charged once)`, read: ["amount"] }),
  LimitHandPlaysPerRound: (i) => ({ text: `each player cannot play or put into play more than ${str(i.max)} card${i.max === 1 ? "" : "s"} from his hand each round (events included; cards from the deck or the discard pile do not count)`, read: ["max"] }),
  LimitPlaysPerRound: (i) => ({ text: `each player cannot play more than ${str(i.max)} card${i.max === 1 ? "" : "s"} each round, in any phase (a card put into play is not played and does not count)`, read: ["max"] }),
  EngageLowestThreat: () => ({ text: "every copy of this enemy, in the staging area or engaged with a player, engages the player with the lowest threat (the first player chooses among tied players)", read: [] }),
  QuestProgress: (i, ctx) => ({ text: i.main ? `add ${amount(i.amount, ctx)} progress to the main quest (the main quest card takes it: the active location takes it first only while the main quest is the current quest)` : `place ${amount(i.amount, ctx)} progress on the current quest (the active location takes it first)`, read: ["amount", "main"] }),
  ShuffleDiscardIntoDeck: () => ({ text: "the acting player shuffles their discard pile into their deck", read: [] }),
  ShuffleSetAsideIntoDeck: (i) => ({ text: `the acting player puts the set-aside card with code ${str(i.code)} into his deck and shuffles the deck (nothing when none is set aside)`, read: ["code"] }),
  RemoveSourceFromGame: () => ({ text: "this card is removed from the game", read: [] }),
  DamageEach: (i, ctx) => ({ text: `deal ${amount(i.amount, ctx)} damage to each ${pick(i.pick, ctx)}`, read: ["amount", "pick"] }),
  PlaceMireToken: (i, ctx) => ({ text: `place ${amount(i.amount, ctx)} mire token(s) (resources) on ${cardRef(i.on)}; a location whose mire tokens then reach its Mire X is discarded by the Mire keyword`, read: ["on", "amount"] }),
  DiscardRandomVictoryLocation: (i) => ({ text: `discard a random ${i.trait === undefined ? "" : `${str(i.trait)} `}location from the victory display to the encounter discard pile (chosen with the game's seed${i.trait === undefined ? "; X becomes its Victory points" : ""})`, read: ["trait"] }),
  ReturnRandomVictoryLocation: () => ({ text: "return a random location from the victory display to the staging area (chosen with the game's seed)", read: [] }),
  ShuffleVictoryIntoEncounterDeck: () => ({ text: "shuffle every location in the victory display into the encounter deck", read: [] }),
  FlipGollum: (i) => ({ text: i.to === "smeagol" ? FLIP_GOLLUM.smeagol : FLIP_GOLLUM.gollum, read: ["to"] }),
  FollowFirstPlayer: () => ({ text: "this enemy moves to the first player's play area and engages them (nothing if it is not engaged, or already engaged with them)", read: [] }),
  GollumAttacks: () => ({ text: "Gollum, if he is in play, makes an immediate attack against the player he is engaged with", read: [] }),
  FlipTimeObjective: (i) => ({ text: `the Time objective is flipped ${i.to === "other" ? "to its other side" : i.to === "day" ? "to Daybreak (Day)" : "to Nightfall (Night)"}; a flip to the side already up changes nothing, and any other flip is heard as "it becomes ${i.to === "day" ? "Day" : i.to === "night" ? "Night" : "Day or Night"}"`, read: ["to"] }),
  RecordStartingThreat: (i) => ({ text: `mark in the Campaign Log that each player's starting threat is ${Number(i.amount) < 0 ? "reduced" : "raised"} by ${Math.abs(Number(i.amount))} (cumulative; written when the scenario is won)`, read: ["amount"] }),
  RecordDetermined: (i) => ({ text: `mark in the Campaign Log, as "determined", each character in play that a copy of the card with code ${str(i.code)} is attached to`, read: ["code"] }),
  GainsDoomed: (i, ctx) => ({ text: `each ${pick(i.pick, ctx)}${i.byEncounterDeck === true ? " the encounter deck reveals" : ""} gains doomed ${amount(i.amount, ctx)} (each player raises their threat by that much more when one is ${i.byEncounterDeck === true ? "revealed" : "played"})`, read: ["amount", "pick", "byEncounterDeck"] }),
  ChangeControl: (i) => ({ text: `control of this card goes to ${i.to === "eventSeat" ? "the player the event happened to" : str(i.to)}`, read: ["to"] }),
  EngageNextPlayer: (i) => ({ text: `${i.target === "subject" ? "the enemy the event is about" : "the attacking enemy"} engages the next player${i.announces === true ? " (a new engagement: the Forced effects that hear an engagement hear it)" : ""}`, read: ["announces", "target"] }),
  DealShadowTo: (i) => ({ text: `${cardRef(i.target)} is dealt a shadow card${i.from === "encounter" ? " from the encounter deck (never the Balrog deck)" : i.from === "raven" ? " from the Raven deck (it goes to the Raven discard pile when discarded)" : ""}`, read: ["target", "from"] }),
  AttachSelfToPicked: (i) => ({ text: `this card attaches to the picked card${i.unlimited === true ? " (any number of copies may be attached to one card)" : " (nowhere if that card carries one of its title already)"}`, read: ["unlimited"] }),
  RemoveAllQuestProgress: (i) => ({ text: i.of === "stage" ? "all progress on this stage (the main quest card) is discarded" : "all progress on the current quest is removed (the encounter side quest that is the current quest while there is one, else the main quest card)", read: ["of"] }),
  PutTopmostFromEncounterDiscard: (i) => ({ text: `the topmost ${str(i.trait)} ${str(i.type)} in the encounter discard pile is put into play engaged with the acting player (not revealed)${i.dealShadow === true ? " and dealt a shadow card" : ""}`, read: ["trait", "type", "dealShadow"] }),
  ShuffleEncounterDeck: () => ({ text: "shuffle the encounter deck", read: [] }),
  FlipCurrentQuest: (i, ctx) => (i.resolve === true ? { text: "the current stage is flipped to side B (at the beginning of the staging step): its side B's When Revealed effects resolve now, the first player acting; a stage already on side B changes nothing; this also makes the stage a stage of a quest deck, which arrives side A and whose side B's text works only once flipped", read: ["resolve"] } : (FAMILY_TEMPLATES.FlipCurrentQuest?.(i, ctx) ?? null)),
  RevealNewStage: (i) => ({ text: i.bottom === true ? "the current stage goes to the bottom of the quest deck with no progress, side A up, and the next stage is revealed side A (not flipped, not a bypass, not defeated); nothing with no other stage in the deck" : "the current stage is shuffled into the quest deck with no progress, side A up, and the top stage of the quest deck is revealed side A (it can be the stage just shuffled in; not flipped, not a bypass, not defeated)", read: ["bottom"] }),
  ChooseStageToFlip: (i) => ({ text: `the acting player looks at the top ${str(i.count)} stage(s) of the quest deck and chooses 1: it becomes the current quest at once, flipped to side B with its When Revealed effects resolving, and the others go to the bottom of the quest deck side A up; the stage this replaces is set aside for the next step to add to the victory display`, read: ["count"] }),
  ShuffleStageFromVictory: (i) => ({ text: `the card with code ${str(i.code)} leaves the victory display for the quest deck, side A up, and the quest deck is shuffled (nothing if it is not in the victory display)`, read: ["code"] }),
  AddShadowToVictory: (i) => ({ text: `the shadow card with code ${str(i.code)} that the attacking enemy holds goes to the victory display`, read: ["code"] }),
  DiscardTopEliminating: (i) => ({ text: `each living player in turn order discards the top card of the encounter deck (not revealed; a deck that ran out is reset); a ${str(i.type)} eliminates the player who discarded it from the game before the next player discards`, read: ["type"] }),
  ShuffleEncounterDiscard: (i) => ({
    text: `shuffle ${typeof i.name === "string" ? `every copy of ${i.name} in ` : typeof i.trait === "string" ? `the ${i.trait} cards of ` : typeof i.type === "string" ? `the ${i.type} cards of ` : ""}the encounter discard pile${i.alsoVictory === true ? " and the victory display (the cards that went back are counted as returned)" : ""} into the encounter deck`,
    read: ["trait", "type", "name", "alsoVictory"],
  }),
  ActAs: (i) => ({ text: `the rest of the effect is carried out by ${i.who === "firstPlayer" ? "the first player" : i.who === "pickedPlayer" ? "the last player picked" : "the acting player"}`, read: ["who"] }),
  ArrangeEncounter: () => ({ text: "the acting player puts the cards this effect looked at or returned, still on top of the encounter deck, back in the order they choose", read: [] }),
  TakeControlOfSetAside: (i) => ({ text: `the set-aside card with code ${str(i.code)} enters play under the first player's control, ready`, read: ["code"] }),
  CommitToQuest: (i) => ({ text: `${i.target == null ? "the picked card" : cardRef(i.target)} is committed to the quest without exhausting${i.stat === "attack" ? ", questing with its Attack" : ""} (it counts as committing, so a "when a character commits" effect hears it; a character that cannot quest stays out)`, read: ["target", "stat"] }),
  RevealTopEnemies: (i, ctx) => ({ text: `reveal the top ${amount(i.count, ctx)} cards of the encounter deck one at a time: each enemy is revealed in full (its When Revealed, Surge, Doomed and the Forced effects of a reveal) and added to the staging area, every other card is discarded unresolved (the discard pile is shuffled back when the deck runs out)`, read: ["count"] }),
  DiscardEncounterTop: (i, ctx) => ({ text: `discard ${amount(i.count, ctx)} card(s) from the top of the encounter deck${i.reset === true ? " (a deck that runs out in the quest phase is reset from the discard pile and the discard goes on)" : ""}`, read: ["count", "reset"] }),
  StageLooked: (i) => ({ text: `${i.own === true ? "the acting player adds" : "each player in turn adds"} one ${str(i.trait)} ${str(i.type)} among the cards this effect discarded (still in the encounter discard pile) to the staging area, ${i.own === true ? "choosing among those their own discard looked at" : "choosing among them"}; not revealed`, read: ["trait", "type", "own", "seat"] }),
  RemoveSideQuestsFromGame: (i) => ({ text: `each card in the staging area titled ${quoted(Array.isArray(i.names) ? i.names : [])} (an encounter side quest, quest side up) is removed from the game, not added to the victory display; its attachments are discarded`, read: ["names"] }),
  FlipWhenDefeated: (i) => ({ text: `when this side quest is defeated it is not added to the victory display: it flips over into the objective with code ${str(i.into)} and stays in the staging area, faceup and unclaimed`, read: ["into"] }),
  RemoveProgressAmong: (i, ctx) => ({ text: `the acting player removes ${amount(i.amount, ctx)} progress from among the quest cards in play, one token at a time from the card they choose (all of it when fewer are there)`, read: ["amount", "left"] }),
  RemoveProgressFromQuest: (i, ctx) => ({ text: `remove ${amount(i.amount, ctx)} progress from ${i.each === true ? "each quest card in play (the main quest card, each encounter side quest in the staging area and each player side quest)" : "the main quest"} (all of it when it holds less)`, read: ["amount", "each"] }),
  PlaceProgressOnQuestCard: (i, ctx) => ({ text: `place ${amount(i.amount, ctx)} progress on the picked quest card, directly (the active location does not take it)`, read: ["amount"] }),
  DiscardEach: (i, ctx) => ({ text: `the acting player discards each ${pick(i.pick, ctx)}`, read: ["pick"] }),
  EachExhaustsOne: () => ({ text: "in player order, each player exhausts a ready character they control, choosing it (a player with none exhausts none)", read: ["seat"] }),
  PickEncounter: (i) => ({
    text: `choose ${withArticle(`${typeof i.trait === "string" ? `${i.trait} ` : ""}${typeof i.type === "string" ? i.type : typeof i.notType === "string" ? `card that is not ${withArticle(i.notType)}` : "encounter card"}`)}${i.noVictory === true ? " worth no victory points" : ""}${i.nonUnique === true ? " (non-unique)" : ""} ${PICK_ENCOUNTER_FROM(i)} (none when no card matches)`,
    read: ["from", "top", "type", "trait", "notType", "noVictory", "nonUnique", "maxThreat"],
  }),
  ChooseCards: (i) => ({
    text: `${CHOOSE_CARDS_WHO[str(i.who)] ?? str(i.who)}${i.optional === true ? " may take" : " takes"} ${quoted(Array.isArray(i.codes) ? i.codes : [])} ${CHOOSE_CARDS_TO[str(i.to)] ?? str(i.to)}${typeof i.ifControls === "string" ? `, only a player who controls the claimed objective with code ${i.ifControls}` : ""}${i.anyHero === true ? " (the hero may be any player's, not only the chooser's)" : ""}${i.afterMulligan === true ? " (the card joins the hand once the mulligan is over, so a mulligan cannot shuffle it into the deck)" : ""}${i.unearned === true ? " (dealt there but not earned: the scenario's Resolution decides whether it joins the pool)" : ""}${i.only === true ? " (the first player chooses one of the named cards for the group, and the others do not join the pool)" : ""}${i.leftover === "firstPlayerDeck" ? "; the cards not chosen go into the first player's deck" : ""}`,
    read: ["codes", "who", "to", "optional", "ifControls", "anyHero", "afterMulligan", "unearned", "only", "leftover"],
  }),
  DiscardUntilEnemies: (i) => i.cardType === "location"
    ? { text: `discard cards from the top of the encounter deck until ${str(i.perPlayer)} location(s) for each player in the game${typeof i.less === "number" ? ` less ${i.less}${typeof i.atLeast === "number" ? `, at least ${i.atLeast},` : ""}` : ""} are discarded, or the deck is empty, and add each location discarded to the staging area${i.returnOthers === true ? "; the other cards this effect discarded are shuffled back into the encounter deck, and nothing else of the discard pile" : ""}`, read: ["perPlayer", "to", "cardType", "less", "atLeast", "returnOthers"] }
    : ({ text: `discard from the top of the encounter deck until ${str(i.perPlayer)} ${typeof i.trait === "string" ? `${i.trait} ` : ""}enem${i.perPlayer === 1 ? "y" : "ies"} for each player${typeof i.less === "number" ? ` less ${i.less}${typeof i.atLeast === "number" ? `, at least ${i.atLeast},` : ""}` : ""} ${i.perPlayer === 1 ? "is" : "are"} discarded${i.to === "staging" ? "; add those enemies to the staging area" : i.to === "reveal" ? "; reveal those enemies in full, in the order discarded" : ""}`, read: ["perPlayer", "to", "cardType", "trait", "less", "atLeast"] }),
  RevealEncounter: (i, ctx) => ({ text: i.times === undefined ? `${who(i.who ?? "actor")} reveals an encounter card` : `${who(i.who ?? "actor")} reveals ${amount(i.times, ctx)}${i.lessX === true ? " less the effect's X (at least 1)" : ""} encounter cards, one after the other, each in a staging of its own`, read: ["who", "times", "lessX"] }),
  AdvanceStage: () => ({ text: "advance to the next quest stage", read: [] }),
  // Only the `different` form is worded (a stage 2 that comes up again, 147002:B:2); Roam Across Rhovanion's each-once order prints as JSON.
  AdvanceToRandomStage: (i, ctx) => (i.different === true && Array.isArray(i.codes) ? { text: `advance to a random stage out of ${i.codes.map(String).join(", ")}, chosen with the game's seed and never the one the quest is at (that stage goes back into the quest deck with no progress and no attachments; the stage reached resolves its When Revealed)${i.stageSet === true ? "" : "; the quest advances at once, by this set alone"}`, read: ["codes", "different", "otherwise", "remove", "stageSet"] } : (FAMILY_TEMPLATES.AdvanceToRandomStage?.(i, ctx) ?? null)),
  WinGame: () => ({ text: "the players win the game", read: [] }),
  LoseGame: (i) => ({ text: `the players lose the game${typeof i.reason === "string" ? ` (${i.reason})` : ""}`, read: ["reason"] }),
  StageDiscarded: (i) => ({ text: `add the discarded ${i.trait != null ? `${str(i.trait)} ` : ""}${plural(str(i.type), 2)} to the staging area`, read: ["type", "trait"] }),
  SearchStageCard: (i) => ({ text: `search for the card with code ${str(i.code)} and add it to the staging area`, read: ["code"] }),
  SearchBoonOrTreasureToHand: () => ({ text: "each player may search their deck for a boon or treasure card and add it to their hand", read: [] }),
  RemoveFromEncounterDeckIfLogged: (i) => ({
    text: `if the Campaign Log holds "${str(i.line)}": remove ${str(i.count)} ${i.nonUnique === true ? "non-unique " : ""}${plural(str(i.cardType), i.count)} from the encounter deck${Array.isArray(i.except) ? ` except ${quoted(i.except)}` : ""}`,
    read: ["line", "count", "cardType", "nonUnique", "except"],
  }),
  IgnoreKeyword: (i) => ({ text: `ignore the ${Array.isArray(i.keywords) ? joinAnd(i.keywords.map(str)) : compact(i.keywords)} keyword(s)`, read: ["keywords"] }),
  AttackFromStaging: (i) => ({ text: `${i.target === "self" ? "this card" : i.target === "host" ? "its host" : i.target === "subject" ? "the card the event is about" : "the picked enemy"} attacks ${who(i.who ?? "actor")} now, ${i.orEngaged === true ? "from where it is (the staging area, or engaged with a player; it does not move)" : "from the staging area"}${i.shadows ? `, dealt ${i.shadows} shadow cards` : ", dealt a shadow card"}${i.undefendedToStage === true ? ", undefended damage going to the stage" : ""}${i.excessToStage === true ? ", the damage beyond the defender's remaining hit points going on the main quest card too" : ""}${typeof i.raiseThreatIfDestroys === "number" ? `; once the attack ends the player attacked raises their threat by ${i.raiseThreatIfDestroys} if it destroyed a character` : ""}`, read: ["who", "target", "shadows", "orEngaged", "undefendedToStage", "excessToStage", "raiseThreatIfDestroys"] }),
  DiscardPicked: () => ({ text: "discard the picked card", read: [] }),
  Engage: (i) => ({ text: `engage ${cardRef(i.target ?? "picked")}`, read: ["target"] }),
  PlaceDamageOn: (i) => ({ text: `place ${str(i.amount)} damage token(s) on the card in play with code ${str(i.code)} (placed, not dealt: nothing cancels or reduces them)`, read: ["code", "amount"] }),
  SearchToStaging: (i) => ({ text: `search the encounter ${i.deckOnly === true ? "deck only" : "deck, discard pile and victory display"} for the card with code ${str(i.code)} and add it to the staging area (not revealed; nothing when none is found)`, read: ["code", "deckOnly"] }),
  EngageSeatWith: (i, ctx) => ({ text: `this enemy engages ${i.controls === true ? "the player who controls" : "a player engaged with"} a ${pick(i.pick, ctx)} (the first player chooses among several; nothing when it is already engaged with that player${i.controls === true ? "; an enemy engaged with another player leaves that player" : ""})`, read: ["pick", "controls"] }),
  GrantSurgeToSubject: () => ({ text: "the card just revealed gains surge", read: [] }),
  PlaceDamage: (i, ctx) => ({ text: `place ${amount(i.amount, ctx)} damage token(s) on ${cardRef(i.card ?? "self")} (placed, not dealt: nothing cancels or reduces them)`, read: ["amount", "card"] }),
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
    text: eachText(i, ctx),
    read: ["pick", "upTo", "instructions", "totalCost", "taken", "rest"],
    children: Array.isArray(i.rest) && i.rest.length > 0 ? (i.rest as readonly Obj[]) : Array.isArray(i.instructions) ? (i.instructions as readonly Obj[]) : [],
  }),
  Delay: (i, ctx) => ({
    text: `later, ${i.phase === "Quest" ? "at the end of the quest phase (the next one, when this is not the quest phase)" : (DELAY_UNTIL[str(i.until)] ?? `at ${str(i.until)}`)}${i.subject === "picked" ? ", acting on the card last picked" : ""}${isObj(i.uncancelable) ? ` (cannot be canceled while ${renderCondition(i.uncancelable, ctx)})` : ""}:`,
    read: ["until", "phase", "uncancelable", "subject", "instructions"],
    children: Array.isArray(i.instructions) ? (i.instructions as readonly Obj[]) : [],
  }),
  AfterAttack: () => ({ text: "when the attack in progress ends:", read: ["instructions"], children: [] }),
  Repeat: (i, ctx) => ({ text: `repeat ${amount(i.times, ctx)} times:`, read: ["times", "instructions"], children: Array.isArray(i.instructions) ? (i.instructions as readonly Obj[]) : [] }),
  ForEachPlayer: (i) => ({ text: i.seats === "guardian" ? `for the player guarding Gollum (and, while a card says an effect that targets him targets each other player, for each of them after him, ${str(i.order) === "lastFirst" ? "last player first" : "first player first"}):` : i.seats === "otherThanGuardian" ? `for each player not guarding Gollum, ${str(i.order) === "lastFirst" ? "last player first" : "first player first"}:` : i.seats === "engaged" ? "for the player this enemy is engaged with:" : `for each player${typeof i.limit === "number" ? ` (at most ${i.limit} players)` : ""}, ${str(i.order) === "lastFirst" ? "last player first" : "first player first"}:`, read: ["order", "seats", "limit", "instructions"], children: Array.isArray(i.instructions) ? (i.instructions as readonly Obj[]) : [] }),
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
    // An EngageNextPlayer step makes the attacks after it, in the same list, against the player just engaged.
    let engagedNext = ctx.engagedNext === true;
    childrenOf(value, made).forEach((child, at) => {
      lines.push(...renderInstruction(child, { ...inner, engagedNext }, depth + 1, at > 0));
      if (isObj(child) && child.verb === "EngageNextPlayer") engagedNext = true;
    });
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
