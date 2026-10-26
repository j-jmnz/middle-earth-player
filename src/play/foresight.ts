// Rules: rr.step-6-4-4, rr.step-6-8-3, rr.hit-points, rr.player-elimination, rr.threat-elimination-level, rr.engagement-check,
// mec109.setting-up-the-game (data/rules/entries.json).
//
// What a choice would do before it is confirmed, read with the engine's own functions on a throwaway copy of the state: the
// damage an attack would place and whether it destroys the card (toughness, indestructible and "cannot take damage"
// included), whether that loses the game (The One Ring leaves play with its bearer; no seat remains) or eliminates a seat,
// and how much more damage the card can take. Nothing here changes the game: the copy is dropped.
import { ruleCause } from "../rules/cause.ts";
import { defenseAsDefender, modifiedStat, placeDamage } from "../rules/keywords.ts";
import { engagementCostOf } from "../rules/quest.ts";
import type { EngineStep, ReduceContext, ScenarioState } from "../rules/reduce.ts";
import { inPlay, livingSeats } from "../rules/state.ts";

export type DamageOutcome = {
  damage: number;
  destroyed: boolean;
  // Why the game is lost if this damage is placed ("The One Ring left play", "No seats remain"), or null.
  loss: string | null;
  // The seats this damage eliminates without losing the game (two-handed).
  eliminated: readonly number[];
  // The least extra damage that would destroy the card, when it survives (a shadow card's +1); null when nothing would.
  spare: number | null;
};

const MOST = 20;

function place(game: ScenarioState, ctx: ReduceContext, cardId: string, amount: number): ScenarioState {
  const steps: EngineStep[] = [];
  return placeDamage(game, cardId, amount, ctx.cards, steps, "combat", ruleCause("rr.step-6-4-4"));
}

/** What placing `damage` combat damage on a card would do now. */
export function damageOutcome(game: ScenarioState, ctx: ReduceContext, cardId: string, damage: number): DamageOutcome {
  const after = damage > 0 ? place(game, ctx, cardId, damage) : game;
  const card = after.cards[cardId];
  const destroyed = card == null || !inPlay(card.zone);
  const before = new Set(livingSeats(game));
  const eliminated = after.lost ? [] : [...before].filter((seat) => !livingSeats(after).includes(seat));
  let spare: number | null = null;
  if (!destroyed) {
    for (let extra = 1; extra <= MOST; extra += 1) {
      const more = place(game, ctx, cardId, damage + extra).cards[cardId];
      if (!more || !inPlay(more.zone)) {
        spare = extra;
        break;
      }
    }
  }
  return { damage, destroyed, loss: after.lost && !game.lost ? (after.lossReason ?? "The game is lost") : null, eliminated, spare };
}

/** The damage an enemy's attack would place on a defender now, before the shadow card (rr.step-6-4-4). */
export function defenseDamage(game: ScenarioState, ctx: ReduceContext, enemyId: string, defenderId: string): number {
  const enemy = game.cards[enemyId];
  if (!enemy) return 0;
  return Math.max(0, modifiedStat(game, enemy, "attack", ctx.cards) - defenseAsDefender(game, defenderId, ctx.cards));
}

/** The damage an undefended attack would place on a hero now, before the shadow card. */
export function undefendedDamage(game: ScenarioState, ctx: ReduceContext, enemyId: string): number {
  const enemy = game.cards[enemyId];
  return enemy ? modifiedStat(game, enemy, "attack", ctx.cards) : 0;
}

/** The words for a loss reason, as the dock says it: "The One Ring leaves play and the game is lost". */
export function lossWords(reason: string): string {
  if (reason === "No seats remain") return "the game is lost";
  const left = /^(.*) left play$/.exec(reason);
  return left ? `${left[1]} leaves play and the game is lost` : "the game is lost";
}

/**
 * What a card's damage comes to, in words, for the dock: "Sam Gamgee is destroyed", with the loss or the elimination it
 * causes; or, while a shadow card may still add to the attack, how much more it can take ("+2 more destroys Sam Gamgee").
 */
export function outcomeWords(outcome: DamageOutcome, name: string, shadowNext: boolean): string {
  if (outcome.destroyed) {
    if (outcome.loss) return `${name} is destroyed: ${lossWords(outcome.loss)}`;
    if (outcome.eliminated.length > 0) return `${name} is destroyed: ${outcome.eliminated.map((seat) => `Player ${seat + 1}`).join(" and ")} is eliminated`;
    return `${name} is destroyed`;
  }
  if (shadowNext && outcome.spare != null) return `+${outcome.spare} more destroys ${name}`;
  return "";
}

/** The enemies a seat will face this round: those engaged with it, and those in staging its threat engages at the checks. */
export function enemiesToFace(game: ScenarioState, ctx: ReduceContext, seat: number): string[] {
  const threat = game.seats[seat]?.threat ?? 0;
  const engaged = game.seats[seat]?.engaged ?? [];
  const engaging = game.staging.filter((id) => {
    const card = game.cards[id];
    if (!card || ctx.cards.get(card.code)?.type !== "enemy") return false;
    const cost = engagementCostOf(game, card, ctx.cards);
    return cost != null && cost <= threat;
  });
  return [...engaged, ...engaging];
}

/** True when an enemy in staging would engage the seat at the engagement checks at its threat now (rr.engagement-check). */
export function engagesAtThreat(game: ScenarioState, ctx: ReduceContext, enemyId: string, seat: number): boolean {
  const card = game.cards[enemyId];
  if (!card || card.zone !== "staging" || ctx.cards.get(card.code)?.type !== "enemy") return false;
  const cost = engagementCostOf(game, card, ctx.cards);
  return cost != null && cost <= (game.seats[seat]?.threat ?? 0);
}
