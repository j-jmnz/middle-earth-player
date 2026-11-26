// The stat templates: ModifyStat (who holds the stat, what a flag means, how long it lasts) and Restrict (a prohibition read from the record's own fields), with the glosses they share. Beside the other verb modules (verbs.ts).
import { cardRef, renderAmount } from "./amounts.ts";
import { ERECH_STAT_NOTES } from "./families/erech.ts";
import { RIDDLES_STAT_NOTES } from "./families/riddles.ts";
import { ESCAPE_STAT_NOTES } from "./families/escape.ts";
import { BURGLE_STAT_NOTES } from "./families/burgle.ts";
import { FOG_STAT_NOTES } from "./families/fog.ts";
import { POISON_STAT_NOTES } from "./families/poison.ts";
import { FLAG_NOTES } from "./stat-notes.ts";
import { RUINS_STAT_NOTES } from "./families/ruins.ts";
import { INVESTIGATION_STAT_NOTES } from "./families/investigation.ts";
import { guardianRestrict } from "./families/guardian.ts";
import { PELARGIR_STAT_NOTES } from "./families/pelargir.ts";
import { isObj, str, type Ctx, type Obj } from "./kit.ts";
import { longDarkRestrict } from "./families/long-dark.ts";
import { renderPick } from "./picks.ts";
import { SMAUG_STAT_NOTES } from "./families/smaug.ts";

type Made = { text: string; read: readonly string[] };
type Template = (ins: Obj, ctx: Ctx) => Made | null;

const amount = (value: unknown, ctx: Ctx): string => renderAmount(value, ctx, renderPick);
const pick = (value: unknown, ctx: Ctx): string => renderPick(value, ctx);

export const STAT_UNTIL: Readonly<Record<string, string>> = {
  endOfPhase: "until the end of the phase",
  endOfRound: "until the end of the round",
  endOfAttack: "until the end of the attack",
  whileSourceInPlay: "while this card is in play",
  whileSourceActive: "while this card is active",
  whileSourceInVictory: "while this card is in the victory display",
  endOfGame: "until the end of the game",
};

export const untilWords = (until: unknown): string => STAT_UNTIL[str(until)] ?? str(until);

const TARGET_STAT: Readonly<Record<string, string>> = {
  stagingCards: "every enemy and location in the staging area, now and arriving there later while the effect lasts",
  locationsInPlay: "every location in play (staging area or active) with the trait, now and arriving later while the effect lasts",
  heroes: "every hero in play",
  enemies: "every enemy in play, staged or engaged, now and entering later while the effect lasts",
  allies: "every ally in play, now and entering later",
  characters: "every character in play, now and entering later",
  attacker: "the attacking enemy",
  table: "the table",
  eachSeat: "each player",
  questingCharacters: "every character committed to the quest, now and committing later while the effect lasts",
};
const targetStat = (value: string): string => TARGET_STAT[value] ?? cardRef(value);
// What a stat flag means where the bare name would not say it.
const STAT_NOTE: Readonly<Record<string, string>> = {
  ...ESCAPE_STAT_NOTES,
  ...BURGLE_STAT_NOTES,
  ...SMAUG_STAT_NOTES,
  ...ERECH_STAT_NOTES,
  ...RIDDLES_STAT_NOTES,
  ...FOG_STAT_NOTES,
  ...POISON_STAT_NOTES,
  ...RUINS_STAT_NOTES,
  ...INVESTIGATION_STAT_NOTES,
  ...PELARGIR_STAT_NOTES,
  ...FLAG_NOTES,
  cannotLeaveStaging: " (nothing moves it out of the staging area: not an engagement, a return, a discard or an effect)",
  cannotBeEngaged: " (no player engages it: not optionally, not by an engagement check, not by an effect)",
  blankText: " (its text box is blank: its own effects do not apply, and its keywords do not unless keepsKeywords is also held; its Traits stay)",
  engagedThreatSeat: " (each enemy engaged with that player adds its Threat to the staging area's total, counted live: an enemy that engages later counts too)",
  cannotHaveTreachery: " (no treachery card can be attached to it)",
  alliesCannotAttack: " (allies cannot be declared as attackers against it)",
  cannotBeCurrentQuest: " (in the quest phase it cannot be the current quest: only a side quest the first player chooses is, else there is none)",
  advanceNow: " (once nothing is resolving the quest advances to the next stage at once)",
  gainsDoomed: " (the Doomed X it gains as it is revealed, each player raising their threat by it)",
  gainsSurge: " (it has the Surge keyword as it is revealed)",
  progressSponge: " (while it is in the staging area it takes the first 2 progress each round that would be placed on a quest card; each copy takes 2)",
  returnsUndeadOnRunOut: " (whenever the encounter deck runs out in the quest phase the topmost Undead enemy in the encounter discard pile returns to the staging area before the reset)",
  keepShadowCards: " (unresolved shadow cards are not discarded at the end of the combat phase, so those dealt to enemies that did not attack stay and add up; an enemy that attacks from the staging area keeps the shadow cards it holds and is dealt one more)",
  blankShadowGains: " (a shadow card with no shadow effect of its own gains \"Shadow: Raise defending player's threat by\" this amount when it is flipped)",
  leavesStagingWhenDefeated: " (it cannot leave the staging area, except that damage that destroys it discards it)",
  resolvesHeldShadows: " (the shadow cards it holds as its first attack of the combat phase begins are not discarded first: they resolve with that attack and the card dealt for it)",
  questProgressReduced: " (the progress placed on the current quest is reduced by this amount, after the active location took its share; several holders add)",
  engagedWithAll: " (it stays in the staging area but is considered engaged with each player: it attacks each of them in turn in the combat phase, dealt a shadow card for each attack, and none engages it)",
  attackableByAny: " (any character may be declared as an attacker against it)",
  losesKeywords: " (it loses its Indestructible keyword)",
  engagedThreat: " (while engaged it still adds its Threat to the total Threat in the staging area)",
  passesSorcery: " (when the quest advances each Sorcery card attached to this stage is attached to the next stage instead of being discarded)",
  discardsHost: " (when it leaves play with its host still in play, the host is discarded too; not when it is removed from the game)",
  mustCommit: " (in the quest phase its controller cannot pass the commitment while it is able to commit and has not)",
};

// Which cards the host refuses (restrictions.ts, attachBlocked): every one, but for those the exception names.
function attachBar(i: Obj): string {
  const boon = i.exceptBoon === true ? "a boon (a card the campaign pool holds as one)" : null;
  if (i.exceptTrait === "objective player card") return `no player card that is not an objective can be attached to this card (an encounter card, an objective and a Condition an encounter card makes can${boon ? `, and so can ${boon}` : ""})`;
  const except = [typeof i.exceptTrait === "string" ? `a card with the trait ${i.exceptTrait}` : null, boon].filter((one) => one !== null);
  return `no card can be attached to this card${except.length > 0 ? ` except ${except.join(" or ")}` : ""}`;
}

export const STAT_TEMPLATES: Readonly<Record<string, Template>> = {
  ModifyStat: (i, ctx) => {
    const lasting = i.until === "endOfPhase" || i.until === "endOfRound" || i.until === "endOfAttack";
    const holders = isObj(i.holders) ? `each ${pick(i.holders, ctx)}${lasting ? " (only the cards that match now: one that arrives later does not get it)" : ""}` : typeof i.target === "string" ? targetStat(i.target) : "this card";
    const per = typeof i.per === "string" ? ` for each ${i.per}` : "";
    const trait = typeof i.trait === "string" ? (i.target === "stagingCards" ? ` (${i.trait} only: an enemy or a location that holds the Trait)` : ` (${i.trait} only)`) : "";
    const sign = i.subtract === true ? "minus " : "";
    const resources = `${i.eachResource === true ? " for each resource on the holder" : ""}${isObj(i.eachAttached) ? ` for each ${pick(i.eachAttached, ctx)} attached to the holder${i.eachAttached.facedownUnder === true ? " (here: each facedown player card under the holder)" : ""}` : ""}`;
    const stacking = i.doesNotStack === true ? " (does not stack: only the oldest copy of this card in play whose condition holds gives it)" : "";
    // The Long Arm of Mordor's stage rule, said as the card prints it: the table flag's gloss alone reads as a stat.
    if (i.stat === "undefendedToStaged") return { text: `the damage of undefended attacks must be dealt to a hero in the staging area if able: the attacked player names which hero takes it, and with none able it goes to the player's own heroes, ${untilWords(i.until)}`, read: ["stat", "amount", "until", "target"] };
    return { text: `${holders}${trait}: stat ${str(i.stat)}${STAT_NOTE[str(i.stat)] ?? ""} ${sign}${amount(i.amount, ctx)}${per}${resources}, ${untilWords(i.until)}${stacking}`, read: ["stat", "amount", "until", "holders", "target", "per", "trait", "subtract", "eachResource", "doesNotStack", "eachAttached"] };
  },
  // A restriction read from the record's own fields; one the template does not word (attach, heroLimit, travelOnly) prints as JSON.
  Restrict: (i, ctx) => {
    // The restriction binds the main quest stage: "this stage" only on a quest card, the stage itself; an encounter side quest is a stage that is defeated too, and the bar holds the main quest stage as well.
    const barred = ctx.cardType === "quest" ? "this stage" : ctx.cardType === "encounter-side-quest" ? "this stage and the main quest stage" : "the main quest stage";
    if (i.what === "advance") return { text: `the players cannot defeat ${barred} while this holds`, read: ["what"] };
    if (i.what === "defend") {
      if (i.anyDefender === true) return { text: "no character can be declared as a defender against this card's attacks (only this card's, not another enemy's)", read: ["what", "anyDefender"] };
      const who = i.allies === true ? "allies" : i.belowSourceHitPoints === true ? "allies with fewer printed hit points than this card" : typeof i.maxWillpower === "number" ? `characters with Willpower ${i.maxWillpower} or less` : "characters";
      return { text: `${who}${typeof i.exceptTrait === "string" ? ` (except those with the trait ${i.exceptTrait})` : ""} cannot be declared as defenders against this card's attacks (only this card's, not another enemy's)`, read: ["what", "allies", "maxWillpower", "belowSourceHitPoints", "exceptTrait"] };
    }
    if (i.what === "attach") return { text: attachBar(i), read: ["what", "exceptTrait", "exceptBoon"] };
    if (i.what === "heroLimit") return { text: "the hero this card is, or is attached to, does not count against the hero limit", read: ["what"] };
    if (i.what === "travelOnly") return { text: "while no location is the active location and the players can travel to this location, they must travel to it: the travel step offers no way to decline it or to go elsewhere", read: ["what"] };
    const guarded = guardianRestrict(i);
    if (guarded) return guarded;
    if (i.what === "commit") return { text: `a player who does not control a ${pick(i.unlessControls, ctx)} cannot commit characters to the quest`, read: ["what", "unlessControls"] };
    const engaged = longDarkRestrict(i);
    if (engaged) return engaged;
    if (i.what === "draw") return { text: `a player who does not control a ${pick(i.unlessControls, ctx)} cannot draw cards through card effects (the framework's draws are not card effects)`, read: ["what", "unlessControls"] };
    if (i.what === "travel" && i.withResources === true) return { text: "the players cannot travel to a location that holds resource tokens while this holds", read: ["what", "withResources"] };
    if (i.what === "travel" && typeof i.exceptTitle === "string") return { text: `the players cannot travel to a location whose title is not ${i.exceptTitle} while this holds (the Trait is no title; another copy of the title may be traveled to)`, read: ["what", "exceptTitle"] };
    if (i.what === "travel" && i.exceptSelf === true) return { text: "the players cannot travel to any location but this one while this card is in play (a Travel Action is not traveling)", read: ["what", "exceptSelf"] };
    if (i.what === "travel") return { text: `the players cannot travel to ${typeof i.location === "string" ? `the location with code ${i.location}${typeof i.guarding === "string" ? ` that guards ${i.guarding}` : ""}` : typeof i.trait === "string" ? `locations with the trait ${i.trait}` : "this location"} while this holds`, read: ["what", "location", "guarding", "trait"] };
    return null;
  },
};
