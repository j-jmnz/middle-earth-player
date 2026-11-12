// Instructions: one small template per verb. A verb with none prints as compact JSON. `src/catalog/effect-schema-verbs.ts`, `effect-schema.ts` and each family's `VERBS` own the shapes.
// The structural verbs (Choose, Each, Delay, AfterAttack, Repeat, ForEachPlayer) hold instructions of their own and print them indented beneath.
import { cardRef, renderAmount } from "./amounts.ts";
import { renderCondition } from "./conditions.ts";
import { compact, done, isObj, jsonOf, joinAnd, quoted, str, type Ctx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";

type Made = { text: string; read: readonly string[]; children?: readonly Obj[] };
type Template = (ins: Obj, ctx: Ctx) => Made | null;

const amount = (value: unknown, ctx: Ctx): string => renderAmount(value, ctx, renderPick);

// The most ChooseX allows: its one amount, or the least of several (the engine takes the smallest of `max`).
const chooseXMost = (max: unknown, ctx: Ctx): string => (Array.isArray(max) ? (max.length === 1 ? amount(max[0], ctx) : `the least of ${joinAnd(max.map((one) => amount(one, ctx)))}`) : "?");
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
  Time: (i) => ({ text: `Time ${str(i.amount)}: when this card is revealed, ${str(i.amount)} resource tokens (time counters) are put on it, and one comes off at the end of each refresh phase`, read: ["amount"] }),
  RemoveTimeCounters: () => ({ text: "one time counter comes off each card in play with Time X (the end of the refresh phase, after its Forced effects); a card whose last counter goes hears it", read: [] }),
  HoldUnder: (i) => ({ text: `the card with code ${str(i.code)} that a player controls lies facedown under this card, still in play, controlled by no one, with what is attached to it; when this card is defeated it returns under the first player, exhausted`, read: ["code"] }),
  DiscardHeld: () => ({ text: "the card held under this card is discarded from where it lies, and leaves play", read: [] }),
  PlaceHandUnderSelf: () => ({ text: "the acting player places every card in their hand facedown under this card (out of play, still theirs)", read: [] }),
  ChooseCurrentQuest: () => ({ text: "the first player chooses a quest card other than the current quest (the main quest card, or an encounter side quest in the staging area) to be the current quest until the end of the phase", read: [] }),
  AttachNewTo: (i) => ({ text: `a copy of the card with code ${str(i.code)} from the supply is put into play attached to the card titled "${str(i.to)}"`, read: ["code", "to"] }),
  TradeDamageForResources: (i) => ({ text: `starting with the first player, each player may place ${str(i.damage)} damage on the card with code ${str(i.code)} to add ${str(i.resources)} resource to each of their heroes' pools`, read: ["code", "damage", "resources"] }),
  AddSetAsideToStaging: (i) => ({ text: `${i.all === true ? "every" : "one"} set-aside card ${typeof i.code === "string" ? `with code ${i.code}` : `with the trait ${str(i.trait)}`} joins the staging area (it is not revealed)${i.announce === true ? "; it entering play is announced to the cards that hear a card added to the staging area" : ""}`, read: ["code", "trait", "all", "announce"] }),
  FirstTraitSurge: (i) => ({ text: `the first ${str(i.trait)} ${i.type === "enemy" ? "enemy" : "treachery"} card revealed each round gains surge`, read: ["trait", "type"] }),
  DiscardFromDeck: (i, ctx) => ({
    text: `the top ${amount(i.amount, ctx)} card(s) of the acting player's deck${i.shuffle === true ? " (shuffled first)" : ""} go to their discard pile${i.count === undefined ? "" : `; X becomes how many of them are a ${pick(i.count, ctx)}${i.costAtLeast === undefined ? "" : ` with a printed cost of at least ${amount(i.costAtLeast, ctx)}`}`}`,
    read: ["amount", "shuffle", "count", "costAtLeast"],
  }),
  MoveCard: (i) => ({ text: `${i.card === undefined ? "the picked card" : cardRef(i.card)}${Array.isArray(i.from) ? ` (only from ${joinAnd(i.from.map(str))})` : ""} goes ${MOVE_CARD_TO[str(i.to)] ?? `to ${str(i.to)}`}`, read: ["card", "from", "to"] }),
  PickDiscardTop: (i) => ({ text: `the topmost ${Array.isArray(i.types) ? i.types.map(str).join(" or ") : "?"}${typeof i.trait === "string" ? ` with the trait ${i.trait}` : ""} in the encounter discard pile (the last put there) is picked (nothing with none)`, read: ["types", "trait"] }),
  MoveEncounterCard: (i) => ({ text: `${i.card === undefined ? "the picked card" : i.card === "deckTop" ? "the top card of the encounter deck" : i.card === "discardTop" ? "the top card of the encounter discard pile" : cardRef(i.card)} ${ENCOUNTER_MOVE[str(i.to)] ?? `goes to ${str(i.to)}`}`, read: ["card", "to"] }),
  GainSurge: () => ({ text: "this card gains surge (one more encounter card is revealed when it has been resolved)", read: [] }),
  CountsAs: (i) => ({ text: `this card counts as a ${str(i.trait)} ${str(i.cardType)} while it is attached`, read: ["cardType", "trait"] }),
  IncreaseCost: (i, ctx) => ({ text: `while this card is in play, each card a player plays (from any zone) that is a ${pick(i.pick, ctx)} costs ${str(i.amount)} more (every player's; several such cards stack)`, read: ["amount", "pick"] }),
  RaiseStagingThreat: (i, ctx) => ({ text: i.live === "alliesInDiscard" ? `the total Threat in the staging area is raised, live, by the allies in a discard pile ${STAT_UNTIL[str(i.until)] ?? ""}` : `the total Threat in the staging area is ${amount(i.amount, ctx)} higher ${STAT_UNTIL[str(i.until)] ?? str(i.until)}`, read: ["amount", "until", "live"] }),
  PutSetAsideInPlay: (i) => ({ text: `the set-aside card titled "${str(i.name)}" is put into play under ${typeof i.withCard === "string" ? `the control of the player who controls the card titled "${i.withCard}"` : i.to === "lastPlayer" ? "the last player" : i.to === "anyPlayer" ? "a player the first player chooses" : i.to === "actor" ? "the acting player" : "the first player"}`, read: ["name", "to", "withCard"] }),
  AttachRandomBurden: (i) => ({ text: `one of the burdens ${Array.isArray(i.codes) ? joinAnd(i.codes.map((code) => `code ${str(code)}`)) : "?"} not yet in the game is picked at random (the game's seed) and attached to ${i.to === undefined ? "the card the event is about" : cardRef(i.to)}, though it cannot have attachments (nothing when none is loaded)`, read: ["codes", "to"] }),
  MoveToHero: (i) => ({ text: `this burden moves to the hero (any player's) that holds the most ${MOST[str(i.most)] ?? str(i.most)}; the hero it is on counts, and the first player chooses among heroes that tie`, read: ["most"] }),
  AttachSelfToNamed: (i) => ({ text: `this card is attached to the card in play titled "${str(i.name)}"${i.outOfPlay === true ? " (or one set aside, out of play)" : ""}; with none it is removed from the game`, read: ["name", "outOfPlay"] }),
  MoveDamageTo: (i) => ({ text: `${i.amount === undefined ? "all the damage" : `up to ${str(i.amount)} damage`} on ${cardRef(i.from)} moves to ${cardRef(i.to)} (placed, not dealt; it can destroy a character at its limit; nothing with the target out of play)`, read: ["from", "to", "amount"] }),
  EndPhase: () => ({ text: "the phase in progress ends once this effect has finished (what is left of it is skipped: in the quest phase the characters stay exhausted and uncommitted and the quest is not resolved; in the combat phase no attack is made); its end-of-phase Forced effects resolve as it ends", read: [] }),
  PlaceLoggedDamageOn: (i) => ({ text: `the card with code ${str(i.code)} in play gets the damage the Campaign Log noted for Protect the Innocent (none when it noted none)`, read: ["code"] }),
  ChooseBoon: (i) => ({ text: `starting with the first player, each player may choose 1 of the boons still set aside (${Array.isArray(i.codes) ? joinAnd(i.codes.map((code) => `code ${str(code)}`)) : "?"}) and attach it to a hero they control; a boon taken is not offered again`, read: ["codes"] }),
  RemoveResourceTokens: (i, ctx) => ({ text: `up to ${amount(i.amount, ctx)} resource token(s) come off ${i.on === "picked" ? "the picked card" : `the card with code ${str(i.code)} in play`}`, read: ["code", "on", "amount"] }),
  SearchMove: (i, ctx) => ({
    text: `${i.each === true ? "every" : "the acting player finds one"} ${typeof i.trait === "string" ? `${i.trait} ` : ""}${typeof i.type === "string" ? i.type : "card"}${typeof i.code === "string" ? ` with code ${i.code}` : ""} ${i.discardOnly === true ? "in the encounter discard pile (the deck is not searched)" : `in the encounter deck${i.deckOnly === true ? "" : " or its discard pile"}`}${i.victory === true ? " or the victory display" : ""} and ${i.to === "engaged" ? "puts it into play engaged with them" : i.to === "engagedFirstPlayer" ? "puts it into play engaged with the first player" : i.to === "stormcallerArea" ? "adds it to the Stormcaller's area" : "adds it to the staging area"} (it is not revealed)`,
    read: ["trait", "type", "code", "to", "each", "deckOnly", "discardOnly", "victory"],
  }),
  AssignDamage: (i, ctx) => ({ text: `${i.who === "eachSeat" ? "each player" : "the acting player"} assigns ${amount(i.amount, ctx)} damage among the ${pick(i.pick, ctx)}, one at a time`, read: ["amount", "pick", "who"] }),
  ExhaustEach: (i, ctx) => ({ text: `exhaust each ${pick(i.pick, ctx)}`, read: ["pick"] }),
  RemoveFromQuest: () => ({ text: "the last picked character is removed from the quest (it stays exhausted)", read: [] }),
  AttachToQuest: () => ({ text: "this card is attached to the current quest card (the side quest that is the current quest, else the main quest card) and leaves with it", read: [] }),
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
  ResolveWhenRevealed: (i) => ({ text: `the When Revealed effects of ${i.card === undefined ? "the picked card" : cardRef(i.card)} resolve as if it had just been revealed`, read: ["card"] }),
  RevealMore: (i) => ({ text: `reveal ${str(i.amount)} additional encounter card(s) in the staging step this phase`, read: ["amount"] }),
  FlipInPlace: (i) => ({ text: `the card with code ${str(i.code)} in play is flipped to the card with code ${str(i.into)}, where it lies, with its tokens and attachments${i.attachTo === "picked" ? ", and moves to the last picked hero" : ""}${i.entersPlay === true ? "; the new side enters play" : ""}`, read: ["code", "into", "attachTo", "entersPlay"] }),
  AddToPool: (i) => ({ text: `the card with code ${str(i.code)} is added to the Campaign Pool${i.eachPlayer === true ? " (a copy for each player)" : ""}`, read: ["code", "eachPlayer"] }),
  ShuffleIntoEncounterDeck: (i) => ({ text: `a card with code ${str(i.code)} from the box joins the encounter deck, which is shuffled`, read: ["code"] }),
  AddToStaging: (i) => ({ text: `the card with code ${str(i.code)} is added to the staging area (the copy a Setup search found, else one the Setup deals)`, read: ["code"] }),
  RecordDamageOn: (i) => ({ text: `note the damage on the card${Array.isArray(i.codes) && i.codes.length > 1 ? "s" : ""} with code ${Array.isArray(i.codes) ? joinAnd(i.codes.map(str)) : "?"} in the Campaign Log (replacing the previous number)`, read: ["codes"] }),
  EarnAttached: (i) => ({ text: `each copy of ${Array.isArray(i.codes) ? joinAnd(i.codes.map((code) => `code ${str(code)}`)) : "?"} attached to a hero in play joins the Campaign Pool attached to that hero`, read: ["codes"] }),
  RemoveFromCampaignPool: () => ({ text: "this card is removed from the Campaign Pool", read: [] }),
  CancelDamage: (i, ctx) => ({ text: i.all === true ? "cancel all of the damage just dealt" : `cancel up to ${i.amount === undefined ? "1" : amount(i.amount, ctx)} point(s) of the damage just dealt${i.target === undefined ? "" : ` to ${cardRef(i.target)}`}`, read: ["amount", "all", "target"] }),
  ChooseX: (i, ctx) => ({ text: `the acting player chooses X, from ${i.min === undefined ? "1" : str(i.min)} to ${chooseXMost(i.max, ctx)}`, read: ["min", "max"] }),
  MoveDamage: (i, ctx) => ({ text: `move ${i.all === true ? "all" : amount(i.amount, ctx)} damage from the card picked before the last to the last picked card`, read: ["amount", "all"] }),
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
  DiscardUntilEnemies: (i) => i.cardType === "location"
    ? { text: `discard cards from the top of the encounter deck until ${str(i.perPlayer)} location(s) for each player in the game are discarded, or the deck is empty, and add each location discarded to the staging area`, read: ["perPlayer", "to", "cardType"] }
    : ({ text: `discard from the top of the encounter deck until ${str(i.perPlayer)} enem${i.perPlayer === 1 ? "y" : "ies"} for each player ${i.perPlayer === 1 ? "is" : "are"} discarded${i.to === "staging" ? "; add those enemies to the staging area" : ""}`, read: ["perPlayer", "to", "cardType"] }),
  RevealEncounter: (i, ctx) => ({ text: i.times === undefined ? `${who(i.who ?? "actor")} reveals an encounter card` : `${who(i.who ?? "actor")} reveals ${amount(i.times, ctx)} encounter cards, one after the other, each in a staging of its own`, read: ["who", "times"] }),
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
  AttackFromStaging: (i) => ({ text: `${i.target === "self" ? "this card" : i.target === "host" ? "its host" : i.target === "subject" ? "the card the event is about" : "the picked enemy"} attacks ${i.who === "firstPlayer" ? "the first player" : "the acting player"} now, from the staging area${i.shadows ? `, dealt ${i.shadows} shadow cards` : ""}${i.orEngaged === true ? " (or engaged)" : ""}${i.undefendedToStage === true ? ", undefended damage going to the stage" : ""}`, read: ["who", "target", "shadows", "orEngaged", "undefendedToStage"] }),
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
