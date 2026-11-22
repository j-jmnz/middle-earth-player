// The ambush pieces of the encounter family (src/catalog/families/encounter.ts, dwd.ambush): templates for the verbs the keyword and the Road to Rivendell cards add. read-fields-samples.ts holds their samples.
import { cardRef } from "../amounts.ts";
import { isObj, str, type Ctx, type Obj } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

export const AMBUSH_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  AmbushChecks: () => ({ text: "ambush: each player in turn, the first player first, makes an engagement check against this enemy alone; the first player whose threat reaches its engagement cost engages it and the checks end (no check while ambush is ignored)", read: [] }),
  DiscardTopEncounter: (i) => ({
    text: `the acting player discards the top card of the encounter deck${i.ambushCheck === true ? "; an enemy with the ambush keyword so discarded makes one engagement check against that player alone: it engages them from the discard pile when their threat reaches its engagement cost, else it stays in the discard pile" : ""}`,
    read: ["ambushCheck"],
  }),
  FirstEnemyGains: (i) => ({
    text: `the first enemy${i.withKeyword === "ambush" ? " with the ambush keyword" : ""} revealed from the encounter deck each round gains ${str(i.keyword)} (counted from the round's start, whether or not this card is in play)`,
    read: ["keyword", "withKeyword"],
  }),
  ExcessToCard: (i) => ({ text: `the damage this attack deals beyond the remaining hit points of the character it damages is assigned to the card in play titled ${str(i.name)}, wherever it lies (an undefended attack has none)`, read: ["name"] }),
  GuardReturnedBy: (i) => ({
    text: `the card in play with code ${str(i.code)} goes back to the staging area, controlled by no one, guarded by the last picked card${i.returns === "firstPlayer" ? " (which may be the active location); it stays in play with its damage, tokens and attachments and rejoins the first player's play area once nothing guards it" : ""}`,
    read: ["code", "returns"],
  }),
  MakeEngagementChecks: (i) => ({ text: `the players make engagement checks against each enemy in the staging area, outside the encounter phase: in player order each engages the enemy of the highest engagement cost at or below their threat, pass after pass until a pass engages none${isObj(i.lower) ? ` (the enemy titled ${str(i.lower.name)} checks with ${str(i.lower.amount)} less engagement cost)` : ""}`, read: ["lower"] }),
  ImmediateAttackBy: (i) => ({ text: `${i.target === undefined ? "the card the answered event was about" : cardRef(i.target)} (an enemy engaged with the actor) makes an immediate attack against the actor, dealt a shadow card of its own${i.extraShadow === undefined ? "" : `, then ${str(i.extraShadow)} more for this attack`}`, read: ["target", "extraShadow"] }),
  ImmediateAttackEach: (i) => ({ text: `each enemy engaged with a player${typeof i.trait === "string" ? ` with the trait ${i.trait}` : ""}${typeof i.notTrait === "string" ? ` without the trait ${i.notTrait}` : ""}${typeof i.enemy === "string" ? ` titled ${i.enemy}` : ""}${i.own === true ? " (the acting player's)" : ""} makes an immediate attack, each dealt a shadow card of its own`, read: ["trait", "notTrait", "enemy", "own"] }),
  AddSourceToVictory: () => ({ text: "this card is added to the victory display (the players' own, the group's)", read: [] }),
  CancelStrike: () => ({ text: "the player attack in progress deals no damage; its attackers stay exhausted", read: [] }),
  RevealFromDiscard: (i) => ({ text: `the topmost ${str(i.trait)} ${str(i.type)} of the encounter discard pile (the last put there) is revealed by the acting player in full: it enters the staging area and its When Revealed and keywords resolve (a Travel cost cannot be paid with none in the pile)`, read: ["type", "trait"] }),
  DamageEachWithAttachment: (i) => ({ text: `deal ${str(i.amount)} damage to each character (any player's, hero or ally) that has a ${str(i.trait)} attachment; the effect's X becomes how many were damaged (damage that was canceled or prevented leaves a character undamaged)`, read: ["amount", "trait"] }),
  RevealUntilThreat: (i) => ({ text: `the first player reveals cards from the encounter deck one after the other, each resolved in full, until the staging area holds at least ${i.threat === undefined ? "?" : isObj(i.threat) && i.threat.players === true ? `${str(i.threat.times)} times the number of players` : str(i.threat)} Threat or the deck and its discard pile are empty (cards already in the staging area count; a treachery adds none)`, read: ["threat"] }),
  RevealEnemies: (i) => ({ text: `each enemy this effect discarded${Array.isArray(i.ids) ? ` (${i.ids.length} still to reveal)` : ""} is revealed in full, in the order discarded, and added to the staging area`, read: ["ids"] }),
};
