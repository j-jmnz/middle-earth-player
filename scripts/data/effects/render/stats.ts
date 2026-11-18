// The stat templates: ModifyStat (who holds the stat, what a flag means, how long it lasts) and Restrict (a prohibition read from the record's own fields), with the glosses they share. Beside the other verb modules (verbs.ts).
import { cardRef, renderAmount } from "./amounts.ts";
import { ESCAPE_STAT_NOTES } from "./escape.ts";
import { guardianRestrict } from "./guardian.ts";
import { isObj, str, type Ctx, type Obj } from "./kit.ts";
import { longDarkRestrict } from "./long-dark.ts";
import { renderPick } from "./picks.ts";

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
  enemies: "every enemy in play",
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
  questProgressCap: " (no more than this much progress can be placed on the current quest in all; progress that goes to the active location first does not count)",
  cannotLeaveStaging: " (nothing moves it out of the staging area: not an engagement, a return, a discard or an effect)",
  cannotBeEngaged: " (no player engages it: not optionally, not by an engagement check, not by an effect)",
  blankText: " (its text box is blank)",
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

export const STAT_TEMPLATES: Readonly<Record<string, Template>> = {
  ModifyStat: (i, ctx) => {
    const holders = isObj(i.holders) ? `each ${pick(i.holders, ctx)}` : typeof i.target === "string" ? targetStat(i.target) : "this card";
    const per = typeof i.per === "string" ? ` for each ${i.per}` : "";
    const trait = typeof i.trait === "string" ? ` (${i.trait} only)` : "";
    const sign = i.subtract === true ? "minus " : "";
    const resources = i.eachResource === true ? " for each resource on the holder" : "";
    const stacking = i.doesNotStack === true ? " (does not stack: only the oldest copy of this card in play gives it)" : "";
    return { text: `${holders}${trait}: stat ${str(i.stat)}${STAT_NOTE[str(i.stat)] ?? ""} ${sign}${amount(i.amount, ctx)}${per}${resources}, ${untilWords(i.until)}${stacking}`, read: ["stat", "amount", "until", "holders", "target", "per", "trait", "subtract", "eachResource", "doesNotStack"] };
  },
  // A restriction read from the record's own fields; one the template does not word (attach, heroLimit, travelOnly) prints as JSON.
  Restrict: (i, ctx) => {
    if (i.what === "advance") return { text: "the players cannot defeat this stage while this holds", read: ["what"] };
    if (i.what === "defend") {
      const who = i.allies === true ? "allies" : i.belowSourceHitPoints === true ? "allies with fewer printed hit points than this card" : typeof i.maxWillpower === "number" ? `characters with Willpower ${i.maxWillpower} or less` : "characters";
      return { text: `${who}${typeof i.exceptTrait === "string" ? ` (except those with the trait ${i.exceptTrait})` : ""} cannot be declared as defenders against this card's attacks (only this card's, not another enemy's)`, read: ["what", "allies", "maxWillpower", "belowSourceHitPoints", "exceptTrait"] };
    }
    const guarded = guardianRestrict(i);
    if (guarded) return guarded;
    if (i.what === "commit") return { text: `a player who does not control a ${pick(i.unlessControls, ctx)} cannot commit characters to the quest`, read: ["what", "unlessControls"] };
    const engaged = longDarkRestrict(i);
    if (engaged) return engaged;
    if (i.what === "draw") return { text: `a player who does not control a ${pick(i.unlessControls, ctx)} cannot draw cards through card effects (the framework's draws are not card effects)`, read: ["what", "unlessControls"] };
    if (i.what === "travel") return { text: `the players cannot travel to ${typeof i.location === "string" ? `the location with code ${i.location}${typeof i.guarding === "string" ? ` that guards ${i.guarding}` : ""}` : "any location"} while this holds`, read: ["what", "location", "guarding"] };
    return null;
  },
};
