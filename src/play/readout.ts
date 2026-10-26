// Rules: rr.step-3-4, rr.step-6-4-3, rr.step-6-8-2, rr.threat-elimination-level, rr.engagement-check, mec109.hide-tests
// (data/rules/entries.json).
//
// The engine's numbers for the open moment, as the dock shows them beside the choice: attack against defense while an attack
// is going on (an enemy can attack during staging), the Hide numbers, otherwise willpower against threat while questing.
// Every number is read with the engine's own functions on the current state; the picks only say whose numbers to add.
import { attackStrength } from "../rules/combat.ts";
import { hidePassed, hideWillpower } from "../rules/hide.ts";
import { defenseAsDefender, modifiedStat } from "../rules/keywords.ts";
import { committedWillpower, questPointsOf, stagingThreat } from "../rules/quest.ts";
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";

import { damageOutcome, enemiesToFace, lossWords, outcomeWords } from "./foresight.ts";
import type { Sheet, SheetStat } from "./sheet-types.ts";
import { choiceFor, type Choice } from "./table-choice.ts";

// `join` is the word between two numbers: "against" (willpower against threat), or "then" for the staging threat before and
// after a travel.
export type Readout = { kind: "quest" | "hide" | "attack" | "defense" | "travel"; stats: readonly SheetStat[]; result: string | null; join?: string };

const WILL = (value: number): SheetStat => ({ icon: "willpower", value, word: "Willpower" });
const THREAT = (value: number): SheetStat => ({ icon: "threat", value, word: "Threat" });
const ATTACK = (value: number): SheetStat => ({ icon: "attack", value, word: "Attack" });
const DEFENSE = (value: number): SheetStat => ({ icon: "defense", value, word: "Defense" });

/** What a quest resolved now would do: "2 progress", "Threat +1", or neither. */
export function questResult(willpower: number, threat: number): string {
  if (willpower > threat) return `${willpower - threat} progress if nothing changes`;
  if (willpower < threat) return `Threat +${threat - willpower} if nothing changes`;
  return "No progress and no threat if nothing changes";
}

function damageWords(attack: number, defense: number): string {
  const damage = Math.max(0, attack - defense);
  return damage === 0 ? "No damage" : `${damage} damage`;
}

// The card the open sheet has picked, and what the pick means in the enemy's attack: a defender, or the hero an undefended
// attack hits (the sheet Leave undefended opens). With nothing picked, the one hero Leave undefended already names.
function pickedInAttack(sheet: Sheet | null, choice: Choice | null): { id: string; role: "defender" | "hit" } | null {
  if (sheet?.kind !== "pick") return null;
  const leave = sheet.alternative && "intent" in sheet.alternative && sheet.alternative.intent.type === "Undefended" ? sheet.alternative.intent.heroId : undefined;
  if (!choice?.ids[0]) return leave ? { id: leave, role: "hit" } : null;
  const item = sheet.options.find((option) => option.id === choice.ids[0]);
  if (!item || !("intent" in item)) return null;
  if (item.intent.type === "DeclareDefender") return { id: item.id, role: "defender" };
  if (item.intent.type === "Undefended") return { id: item.id, role: "hit" };
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
  // A Hide test's action window: the willpower committed against the threat of the cards discarded.
  if (sheet?.kind === "trigger" && sheet.hide) {
    const { willpower, threat, x } = sheet.hide;
    return { kind: "hide", stats: [WILL(willpower), THREAT(threat)], result: `Hide ${x}: ${hidePassed(willpower, threat) ? "passed" : "failed"} if nothing changes` };
  }
  // An enemy attacks: its attack against the defender picked or declared, or all of it on an undefended hero.
  const attack = game.pendingAttack;
  if (attack) {
    const enemy = game.cards[attack.enemyId];
    if (!enemy) return null;
    const strength = modifiedStat(game, enemy, "attack", ctx.cards);
    const shadowNote = attack.shadowResolved ? "" : ", shadow card next";
    const picked = pickedInAttack(sheet, choice);
    const defenderId = attack.undefended ? undefined : (attack.defenderId ?? (picked?.role === "defender" ? picked.id : undefined));
    if (defenderId && game.cards[defenderId]) {
      const defense = defenseAsDefender(game, defenderId, ctx.cards);
      const destroyed = destroyedWords(game, ctx, defenderId, Math.max(0, strength - defense), cardName, !attack.shadowResolved);
      return { kind: "defense", stats: [ATTACK(strength), DEFENSE(defense)], result: `${damageWords(strength, defense)}${shadowNote}${destroyed}` };
    }
    const hit = attack.heroId ?? (picked?.role === "hit" ? picked.id : undefined);
    if (hit) return { kind: "defense", stats: [ATTACK(strength)], result: `Undefended: ${strength} damage on ${cardName(hit)}${shadowNote}${destroyedWords(game, ctx, hit, strength, cardName, !attack.shadowResolved)}` };
    return { kind: "defense", stats: [ATTACK(strength)], result: attack.undefended ? `Undefended: ${strength} damage${shadowNote}` : `Undefended, a hero takes ${strength}` };
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
    const after = outcome ? (outcome.destroyed ? `; ${cardName(enemyId)} is destroyed` : outcome.spare != null ? `; ${outcome.spare} more would destroy it` : "") : "";
    return { kind: "attack", stats: [ATTACK(total), DEFENSE(defense)], result: `${damageWords(total, defense)}${after}` };
  }
  // Travel: the staging threat now and after the picked location leaves staging, and the progress it takes first (rr.travel).
  if (sheet?.kind === "pick" && game.window?.kind === "travel") {
    const now = stagingThreat(game, ctx.cards);
    const pickedId = choice?.ids[0];
    const location = pickedId ? game.cards[pickedId] : undefined;
    if (!location) return now > 0 ? { kind: "travel", stats: [THREAT(now)], result: "Staging threat now" } : null;
    const after = stagingThreat({ ...game, staging: game.staging.filter((id) => id !== location.id) }, ctx.cards);
    const points = questPointsOf(game, location, ctx.cards);
    return { kind: "travel", stats: [THREAT(now), THREAT(after)], join: "then", result: points != null ? `It takes the next ${points} progress before the quest` : null };
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
      return sum + (card ? modifiedStat(game, card, "willpower", ctx.cards) : 0);
    }, 0);
    const willpower = committedWillpower(game, ctx.cards) + added;
    const threat = stagingThreat(game, ctx.cards);
    if (game.mode === "questCommit") return { kind: "quest", stats: [WILL(willpower), THREAT(threat)], result: commitWords(game, ctx, picked) };
    return { kind: "quest", stats: [WILL(willpower), THREAT(threat)], result: `${questResult(willpower, threat)}${eliminationWords(game, threat - willpower)}` };
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

// A quest that would fail by `shortfall` and take a seat's threat to 50 (rr.threat-elimination-level): the seat is
// eliminated, and with no seat left the game is lost.
function eliminationWords(game: ScenarioState, shortfall: number): string {
  if (shortfall <= 0) return "";
  const out = game.seats.flatMap((seat, index) => (!seat.eliminated && seat.threat + shortfall >= 50 ? [index] : []));
  if (out.length === 0) return "";
  const living = game.seats.filter((seat) => !seat.eliminated).length;
  if (out.length === living) return `; threat reaches 50: ${lossWords("No seats remain")}`;
  return `; threat reaches 50: ${out.map((seat) => `Player ${seat + 1}`).join(" and ")} is eliminated`;
}
