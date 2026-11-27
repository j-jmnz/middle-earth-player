// Rules: rr.step-3-4, rr.step-6-4-3, rr.step-6-8-2, rr.threat-elimination-level, rr.engagement-check, rr.multiple-defenders,
// mec109.hide-tests
// (data/rules/entries.json).
//
// The engine's numbers for the open moment, as the dock shows them beside the choice: attack against defense while an attack
// is going on (an enemy can attack during staging), the Hide numbers, otherwise willpower against threat while questing.
// Every number is read with the engine's own functions on the current state; the picks only say whose numbers to add.
import { attackStrength } from "../../rules/combat/combat.ts";
import { hasSpectral } from "../../rules/families/attack/spectral.ts";
import { DEFENDERS_FRAME, declaredDefenders, pooledDefense, standingDefenders } from "../../rules/families/defense/defenders.ts";
import { hidePassed, hideWillpower } from "../../rules/quest/hide.ts";
import { placedLimit } from "../../rules/families/uncharted/limit.ts";
import { defenseAsDefender, modifiedStat } from "../../rules/core/keywords.ts";
import { questSeat } from "../store/selectors.ts";
import { viewOf } from "../../rules/families/breaking/areas.ts";
import { committedWillpower, failQuest, questPointsOf, questStatOf, stagingThreat } from "../../rules/quest/quest.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { NO_SEATS_REMAIN } from "../../rules/core/eliminate.ts";
import { livingSeats } from "../../rules/core/state.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { topFrame } from "../../rules/windows/windows.ts";

import { damageOutcome, enemiesToFace, lossWords, outcomeWords } from "../store/foresight.ts";
import { defenseQuestResult } from "../words/scenarios/fortress.ts";
import { defenseOutcome, stageHasDefense } from "./fortress.ts";
import { companyProgressWords } from "./company.ts";
import { erechQuestWords } from "./standalone-scenarios/erech.ts";
import { downsHoldWords, downsQuestWords, downsRaise } from "./standalone-scenarios/barrow-downs.ts";
import { forestHoldWords } from "./standalone-scenarios/old-forest.ts";
import { stagingThreatNow } from "./the-hobbit/riddles.ts";
import { lairProgressWords } from "./lair.ts";
import { blackGateQuestEnd } from "./black-gate.ts";
import { fortitudeNumbers } from "./fortitude.ts";
import { mountDoomQuestNote } from "./mount-doom.ts";
import { seatLevel } from "./threat-level.ts";
import { pelennorQuestWords } from "./pelennor.ts";
import { undefendedLocationsReadout } from "./against-the-shadow/osgiliath.ts";
import { bloodDockClause, bloodLossNote, bloodTravel } from "./against-the-shadow/blood.ts";
import { valeShieldReadout, valeTravel } from "./against-the-shadow/vale.ts";
import { questMovesWords, undefendedVillagersReadout } from "./against-the-shadow/amon-din.ts";
import { undefendedRemoves } from "./against-the-shadow/cair-andros.ts";
import { siegeProgressWords } from "./siege.ts";
import { sailingReadout } from "./sea-readout.ts";
import type { Sheet, SheetStat } from "../choice/sheet-types.ts";
import { escapeNumbers } from "../choice/escape-notes.ts";
import { choiceFor, type Choice } from "../choice/table-choice.ts";
import { progressReadout } from "./against-the-shadow/druadan.ts";
import { questStatNow, questStatWord, type QuestStat } from "../phases/quest-stat.ts";

// `join` is the word between two numbers: "against" (willpower against threat), or "then" for the staging threat before and
// after a travel.
export type Readout = { kind: "quest" | "hide" | "fortitude" | "escape" | "attack" | "defense" | "travel" | "sailing"; stats: readonly SheetStat[]; result: string | null; join?: string };

const WILL = (value: number): SheetStat => ({ icon: "willpower", value, word: "Willpower" });
const THREAT = (value: number): SheetStat => ({ icon: "threat", value, word: "Threat" });
const ATTACK = (value: number): SheetStat => ({ icon: "attack", value, word: "Attack" });
const DEFENSE = (value: number): SheetStat => ({ icon: "defense", value, word: "Defense" });
// The quest total's number: the stat the current quest counts (hon.battle, hon.siege), Willpower unless the quest has Battle or Siege.
const QUEST = (stat: QuestStat, value: number): SheetStat => ({ icon: stat, value, word: questStatWord(stat) });

/**
 * The readout the dock draws. While the quest meter shows the numbers (the command column's head is drawn, in the Quest phase), the meter
 * draws the willpower against the threat, so the dock drops its numbers row and keeps the result line: the loss warning and the commit aids ("Threat +3 if nothing changes; threat
 * reaches 50: ...", "Staging reveals 1 card next. Ready after this: 2") are said once, there. Another readout is unchanged.
 */
export function dockReadout(readout: Readout | null, meterShown: boolean): Readout | null {
  if (!readout || !meterShown || readout.kind !== "quest") return readout;
  return readout.result ? { ...readout, stats: [] } : null;
}

/** What a quest resolved now would do: "2 progress", "Threat +1", or neither. */
export function questResult(willpower: number, threat: number): string {
  if (willpower > threat) return `${willpower - threat} progress if nothing changes`;
  if (willpower < threat) return `Threat +${threat - willpower} if nothing changes`;
  return "No progress and no threat if nothing changes";
}

// `placed`: the most a card that limits the damage placed on it takes at a time (Revenant, 11181:A:3).
function damageWords(attack: number, defense: number, placed?: number): string {
  const damage = Math.max(0, attack - defense);
  if (damage === 0) return "No damage";
  return placed != null && placed < damage ? `${placed} damage, the most it takes at a time` : `${damage} damage`;
}

// The card the open sheet has picked, and what the pick means in the enemy's attack: a defender, or the hero an undefended
// attack hits (the sheet Leave undefended opens). With nothing picked, the one hero Leave undefended already names.
function pickedInAttack(game: ScenarioState, sheet: Sheet | null, choice: Choice | null): { id: string; role: "defender" | "hit" } | null {
  if (sheet?.kind !== "pick") return null;
  const leave = sheet.alternative && "intent" in sheet.alternative && sheet.alternative.intent.type === "Undefended" ? sheet.alternative.intent.heroId : undefined;
  if (!choice?.ids[0]) return leave ? { id: leave, role: "hit" } : null;
  const item = sheet.options.find((option) => option.id === choice.ids[0]);
  if (!item || !("intent" in item)) return null;
  if (item.intent.type === "DeclareDefender") return { id: item.id, role: "defender" };
  if (item.intent.type === "Undefended") return { id: item.id, role: "hit" };
  // One more defender, picked in the defense family's declaration frame (Stand Together, families/defense/defenders.ts).
  const data = topFrame(game)?.data;
  if (item.intent.type === "Choose" && data?.kind === "effect" && data.effectId === DEFENDERS_FRAME && game.cards[item.id]) return { id: item.id, role: "defender" };
  return null;
}

// "; Sam Gamgee is destroyed" when the damage would destroy the character, with the loss or elimination it causes (the
// Ring-bearer takes The One Ring with him); while the shadow card is still to come, how much more would destroy it.
function destroyedWords(game: ScenarioState, ctx: ReduceContext, cardId: string, damage: number, cardName: (cardId: string) => string, shadowNext: boolean): string {
  if (!game.cards[cardId]) return "";
  const words = outcomeWords(damageOutcome(game, ctx, cardId, damage), cardName(cardId), shadowNext);
  return words ? `; ${words}` : "";
}

/** The numbers to show beside the open sheet, or null when the moment has none. */
export function readoutFor(game: ScenarioState, ctx: ReduceContext, sheet: Sheet | null, held: Choice | null, cardName: (cardId: string) => string): Readout | null {
  // Once the scenario is won or lost no number is in play: an attack the loss cut short is not shown.
  if (game.lost || game.stageCleared) return null;
  const choice = sheet ? choiceFor(sheet, held) : null;
  // A Sailing test: how many cards the characters picked look at, then the heading the symbols found would make (sea-readout.ts).
  const sailing = sailingReadout(game, ctx, choice?.ids ?? [], { card: cardName, line: () => null });
  if (sailing) return sailing;
  // A Hide test's action window: the willpower committed against the threat of the cards discarded.
  if (sheet?.kind === "trigger" && sheet.hide) {
    const { willpower, threat, x } = sheet.hide;
    return { kind: "hide", stats: [WILL(willpower), THREAT(threat)], result: `Hide ${x}: ${hidePassed(willpower, threat) ? "passed" : "failed"} if nothing changes` };
  }
  // A Fortitude test: the Willpower of the heroes picked (then committed) against the Sauron's Eye icons already added (then counted).
  const fortitude = fortitudeNumbers(game, ctx, sheet?.kind === "multi" && sheet.build.kind === "CommitFortitude" ? (choice?.ids ?? []) : null);
  if (fortitude) return { kind: "fortitude", ...fortitude };
  // An escape test: the stat of the characters committed so far, and the ones picked now, against the cards dealt next.
  const escape = escapeNumbers(game, ctx, sheet?.kind === "multi" && sheet.build.kind === "CommitEscape" ? (choice?.ids ?? []) : null);
  if (escape) return { kind: "escape", ...escape };
  // An enemy attacks: its attack against the defender picked or declared, or all of it on an undefended hero.
  const attack = game.pendingAttack;
  if (attack) {
    const enemy = game.cards[attack.enemyId];
    if (!enemy) return null;
    const strength = modifiedStat(game, enemy, "attack", ctx.cards);
    // A shadow card comes next only when the enemy holds one: Gollum's attack from the riddle area deals none (131074:A:1), nor does an enemy dealt none for want of a card.
    const shadowNext = !attack.shadowResolved && enemy.shadowId != null;
    const shadowNote = shadowNext ? ", shadow card next" : "";
    const picked = pickedInAttack(game, sheet, choice);
    // Several defenders (Stand Together, rr.multiple-defenders): their defense is pooled against the attack, and all the
    // damage goes on the one the defending player chooses.
    const declared = attack.undefended ? [] : standingDefenders(game, declaredDefenders(game.pendingAttack));
    const pooled = picked?.role === "defender" && declared.length > 0 && !declared.includes(picked.id) ? [...declared, picked.id] : declared;
    if (pooled.length > 1) {
      const defense = pooledDefense(game, pooled, ctx.cards);
      return { kind: "defense", stats: [ATTACK(strength), DEFENSE(defense)], result: `${damageWords(strength, defense)} on one defender you choose${shadowNote}` };
    }
    const defenderId = attack.undefended ? undefined : (attack.defenderId ?? (picked?.role === "defender" ? picked.id : undefined));
    if (defenderId && game.cards[defenderId]) {
      const defense = defenseAsDefender(game, defenderId, ctx.cards);
      const destroyed = destroyedWords(game, ctx, defenderId, Math.max(0, strength - defense), cardName, shadowNext);
      return { kind: "defense", stats: [ATTACK(strength), DEFENSE(defense)], result: `${damageWords(strength, defense)}${shadowNote}${destroyed}${destroyed ? `${bloodLossNote(game, defenderId)}${bloodDockClause(game, defenderId)}` : ""}` };
    }
    const hit = attack.heroId ?? (picked?.role === "hit" ? picked.id : undefined);
    // Stage 2B of Encounter at Amon Dîn: the attack discards villager tokens from Rescued Villagers and damages no hero.
    const tokens = hit ? undefendedVillagersReadout(game, hit, strength, shadowNext) : null;
    if (hit && tokens) return { kind: "defense", stats: [ATTACK(strength)], result: tokens };
    if (hit) {
      // The line names the hero or ally it lands on once ("3 damage on Tamed Mûmak"), so what follows says "it": the name twice does not fit the dock's three lines on a short phone.
      const lost = destroyedWords(game, ctx, hit, strength, () => "it", shadowNext);
      return { kind: "defense", stats: [ATTACK(strength)], result: `Undefended: ${strength} damage on ${cardName(hit)}${undefendedRemoves(game, hit, strength)}${shadowNote}${lost}${lost ? bloodDockClause(game, hit) : ""}${undefendedLocationsReadout(game, ctx)}` };
    }
    // The one hero the damage may go on (Gollum's attack from the riddle area, a shadow effect that names the hero) is named before it is picked.
    const only = attack.onlyHeroes?.length === 1 && !attack.undefended ? attack.onlyHeroes[0] : undefined;
    if (only && game.cards[only]) return { kind: "defense", stats: [ATTACK(strength)], result: `Undefended, ${cardName(only)} takes ${strength}${shadowNote}` };
    return { kind: "defense", stats: [ATTACK(strength)], result: attack.undefended ? `Undefended: ${strength} damage${shadowNote}${undefendedLocationsReadout(game, ctx)}` : `Undefended, a hero takes ${strength}${undefendedLocationsReadout(game, ctx)}` };
  }
  // The players attack: the attackers picked (or declared) against the enemy's defense.
  const strike = game.pendingStrike;
  const building = sheet?.kind === "multi" && sheet.build.kind === "attack" ? sheet.build.enemyId : null;
  const enemyId = strike?.enemyId ?? building;
  if (enemyId) {
    const enemy = game.cards[enemyId];
    if (!enemy) return null;
    const attackers = strike?.attackerIds ?? choice?.ids ?? [];
    const total = attackStrength(game, attackers, enemyId, ctx.cards);
    const defense = modifiedStat(game, enemy, "defense", ctx.cards);
    // Whether the attack destroys the enemy (toughness and indestructible are the engine's), or how far short it falls.
    const outcome = attackers.length > 0 && !strike ? damageOutcome(game, ctx, enemyId, Math.max(0, total - defense)) : null;
    const after = outcome ? (outcome.destroyed ? `; ${cardName(enemyId)} is destroyed` : outcome.spare != null ? `; ${outcome.spare} more damage destroys it` : "") : "";
    const placed = placedLimit(game, enemyId, Number.POSITIVE_INFINITY);
    // Against a Spectral enemy the attackers' Willpower is the strength (50312:A:1).
    const spectral = hasSpectral(game, enemyId, ctx.cards);
    const spectralNote = spectral ? "Willpower against a Spectral enemy. " : "";
    // Stage 3 of The Drúadan Forest: the characters attack with Willpower and the damage is progress on the enemy, against its hit points (06044:B:2), never damage and never "destroyed".
    const progress = progressReadout(game, ctx, enemyId, total, defense, cardName(enemyId), strike?.awaiting === "end");
    if (progress != null) return { kind: "attack", stats: [WILL(total), DEFENSE(defense)], result: progress };
    // The Morgul Vale: a Morgul Bodyguard takes the damage meant for a Captain (06148:A:1).
    const shield = valeShieldReadout(game, ctx, enemyId, Math.max(0, total - defense));
    if (shield) return { kind: "attack", stats: [ATTACK(total), DEFENSE(defense)], result: shield };
    return { kind: "attack", stats: [spectral ? WILL(total) : ATTACK(total), DEFENSE(defense)], result: `${spectralNote}${damageWords(total, defense, placed)}${after}` };
  }
  // Travel: the staging threat now and after the picked location leaves staging, and the progress it takes first (rr.travel).
  if (sheet?.kind === "pick" && game.window?.kind === "travel") {
    // Once stages are separate the traveler reads its own staging area (mec109.multiple-staging-areas).
    const area = viewOf(game, questSeat(game));
    const now = stagingThreat(area, ctx.cards);
    const pickedId = choice?.ids[0];
    const location = pickedId ? game.cards[pickedId] : undefined;
    if (!location) return now > 0 ? { kind: "travel", stats: [THREAT(now)], result: "Staging threat now" } : null;
    const after = stagingThreat({ ...area, staging: area.staging.filter((id) => id !== location.id) }, ctx.cards);
    // The Blood of Gondor: the points the location has once it is active, and the hidden cards the travel takes (blood.ts).
    const blood = bloodTravel(game, ctx, location.id);
    // The points it has once it is active: a bonus that applies only while it is in the staging area no longer counts (Ancient Forest, Into Fangorn).
    const active = syncConstants({ ...game, staging: game.staging.filter((id) => id !== location.id), activeLocation: game.separate ? game.activeLocation : location.id, cards: { ...game.cards, [location.id]: { ...location, zone: "activeLocation" } } }, ctx);
    const points = blood ? blood.points : questPointsOf(active, active.cards[location.id] ?? location, ctx.cards);
    const said = valeTravel(game, location.id) ?? (points != null ? `It takes the next ${points} progress before the quest` : null);
    return { kind: "travel", stats: [THREAT(now), THREAT(after)], join: "then", result: blood?.cost ? (said ? `${said}; ${blood.cost}` : blood.cost) : said };
  }
  // The quest, when no attack is going on: committed willpower (and the characters picked to join it) against staging.
  if (game.phase === "Quest" && !game.questResolved && (game.mode === "questCommit" || game.mode === "staging" || game.mode === "resolution")) {
    if (sheet?.kind === "multi" && sheet.build.kind === "CommitHide") {
      const frame = [...game.stack].reverse().find((item) => item.data.kind === "hide");
      const data = frame?.data.kind === "hide" ? frame.data : null;
      const willpower = hideWillpower(game, game.activeSeat, [...(data?.committedIds ?? []), ...(choice?.ids ?? [])], ctx);
      return { kind: "hide", stats: [WILL(willpower)], result: data ? `Hide ${data.x}: against the threat discarded next` : null };
    }
    const picked = sheet?.kind === "window" && sheet.commit ? (choice?.ids ?? []).filter((id) => !game.cards[id]?.committed) : [];
    const added = picked.reduce((sum, id) => {
      const card = game.cards[id];
      return sum + (card ? modifiedStat(game, card, questStatOf(game, id, ctx.cards), ctx.cards) : 0);
    }, 0);
    // The acting seat quests against its own staging area once stages are separate.
    const seat = questSeat(game);
    const willpower = committedWillpower(game, ctx.cards, seat) + added;
    const threat = stagingThreatNow(game, ctx, seat);
    const stat = questStatNow(game, ctx);
    if (game.mode === "questCommit") return { kind: "quest", stats: [QUEST(stat, willpower), THREAT(threat)], result: `${commitWords(game, ctx, picked)}${blackGateQuestEnd(game)}${mountDoomQuestNote(game, ctx)}` };
    // A stage with Defense (mec112.defense): the Threat that beats the Willpower is progress the encounter deck places, so no player's threat rises and no elimination is warned of.
    if (stageHasDefense(game)) return { kind: "quest", stats: [QUEST(stat, willpower), THREAT(threat)], result: defenseQuestResult(willpower, threat, defenseOutcome(game, ctx)) };
    // Stage 3B of The Battle of the Pelennor Fields (Assault) places no progress on the stage and damages Minas Tirith instead of raising threat, and stage 4B deals the progress as damage: neither warns of an elimination.
    const pelennor = pelennorQuestWords(game, ctx, willpower - threat);
    if (pelennor) return { kind: "quest", stats: [QUEST(stat, willpower), THREAT(threat)], result: pelennor };
    // Shelob's Lair holds some progress back (stage 2B's cap, an Underground location on stage 1): the split the engine would place; stage 3B of The Passing of the Grey Company says the progress pays the Stone's travel; stage 1B of The Siege of Gondor says Great Corsair Ship holds it.
    const held = lairProgressWords(game, ctx, willpower - threat) ?? companyProgressWords(game, ctx, willpower - threat) ?? erechQuestWords(game, ctx, willpower - threat) ?? downsQuestWords(game, ctx, willpower - threat);
    // The Siege's words carry their own "if nothing changes" ("4 progress if nothing changes: held while Great Corsair Ship is in play").
    // Stage 1B of Encounter at Amon Dîn moves villager tokens in place of progress.
    const villagers = questMovesWords(game, ctx, willpower - threat, cardName);
    const siege = siegeProgressWords(game, ctx, willpower - threat) ?? (villagers ? `${villagers} if nothing changes` : null);
    // The Old Forest's stage 3B: progress that would fill it, and the card that holds the win.
    // Fog on the Barrow-downs' stage 3B: the progress it takes none of while a Great Barrow is in play, and the defeat it holds until every player is at it with Standing Stones in the victory display.
    const holds = forestHoldWords(game, ctx, willpower - threat) ?? downsHoldWords(game, ctx, willpower - threat);
    return { kind: "quest", stats: [QUEST(stat, willpower), THREAT(threat)], result: `${siege ?? (held ? `${held} if nothing changes` : questResult(willpower, threat))}${holds ? `; ${holds}` : ""}${eliminationWords(game, ctx, threat - willpower, seat)}${blackGateQuestEnd(game)}${mountDoomQuestNote(game, ctx)}` };
  }
  return null;
}

// While committing: what staging reveals next, and what the commit leaves for combat (the video's "hold back some heroes"):
// the seat's characters still ready after the commit against the enemies it will face this round.
function commitWords(game: ScenarioState, ctx: ReduceContext, picked: readonly string[]): string {
  const seat = game.activeSeat;
  const reveals = game.seatCount > 1 ? "Staging reveals 1 card per player next" : "Staging reveals 1 card next";
  const owner = game.seats[seat];
  if (!owner) return reveals;
  const ready = [...owner.heroes, ...owner.play].filter((id) => {
    const card = game.cards[id];
    const type = card ? ctx.cards.get(card.code)?.type : undefined;
    return card != null && (type === "hero" || type === "ally") && !card.exhausted && !card.committed && !picked.includes(id);
  }).length;
  const enemies = enemiesToFace(game, ctx, seat);
  if (enemies.length === 0) return `${reveals}. Ready after this: ${ready}`;
  const attacks = enemies.map((id) => {
    const enemy = game.cards[id];
    return enemy ? modifiedStat(game, enemy, "attack", ctx.cards) : 0;
  });
  return `${reveals}. Ready after this: ${ready} · Enemies to face: ${enemies.length} (${attacks.join(", ")} attack)`;
}

// A quest that would fail by `shortfall`, as the engine fails it on a copy (failQuest): a seat whose threat reaches 50 is
// eliminated (rr.threat-elimination-level), and with no seat left the game is lost.
function eliminationWords(game: ScenarioState, ctx: ReduceContext, shortfall: number, only?: number): string {
  if (shortfall <= 0) return "";
  const after = failQuest(game, shortfall, [], only == null ? undefined : [only]);
  // The elimination level: 99 while the main quest is Dire (mec113.dire), five less for a seat holding The One Ring; it is the level of the seat that goes out, the first of them when several do.
  const out = livingSeats(game).filter((seat) => !livingSeats(after).includes(seat));
  const level = seatLevel(game, out[0] ?? only ?? livingSeats(game)[0] ?? 0);
  // Fog on the Barrow-downs' stage 3B hears an elimination: the players at it raise their threat by 10, which can end the game (148003:B:2).
  const raise = downsRaise(game, ctx, after, level);
  const raised = raise ? `; ${raise.text}${raise.ends ? `: ${lossWords(NO_SEATS_REMAIN)}` : ""}` : "";
  // Stages are separate: only the seat that quests raises its threat, so only it can be eliminated by this quest (mec109.multiple-staging-areas).
  if (only != null) {
    if (livingSeats(after).includes(only)) return "";
    if (livingSeats(game).length === 1 && after.lost && !game.lost) return `; threat reaches ${level}: ${lossWords(after.lossReason ?? NO_SEATS_REMAIN)}`;
    return `; threat reaches ${level}: Player ${only + 1} is eliminated${raised}`;
  }
  if (after.lost && !game.lost) return `; threat reaches ${level}: ${lossWords(after.lossReason ?? NO_SEATS_REMAIN)}`;
  if (out.length === 0) return "";
  return `; threat reaches ${level}: ${out.map((seat) => `Player ${seat + 1}`).join(" and ")} is eliminated${raised}`;
}
