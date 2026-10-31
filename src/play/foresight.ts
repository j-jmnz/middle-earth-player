// Rules: rr.step-6-4-4, rr.step-6-8-3, rr.hit-points, rr.player-elimination, rr.threat-elimination-level, rr.engagement-check,
// mec109.setting-up-the-game (data/rules/entries.json).
//
// What a choice would do before it is confirmed, read with the engine's own functions on a throwaway copy of the state: the
// damage an attack would place and whether it destroys the card (toughness, indestructible and "cannot take damage"
// included), whether that loses the game (The One Ring leaves play with its bearer; no seat remains) or eliminates a seat,
// and how much more damage the card can take. Nothing here changes the game: the copy is dropped.
import { ruleCause } from "../rules/cause.ts";
import { stagingOf } from "../rules/families/breaking-areas.ts";
import { declaredDefenders, pooledDefense, standingDefenders } from "../rules/families/defense-defenders.ts";
import { modifiedStat, placeDamage } from "../rules/keywords.ts";
import { engagementCostOf, engagementForecast } from "../rules/quest.ts";
import type { EngineStep, ReduceContext, ScenarioState } from "../rules/reduce.ts";
import { flagged, inPlay, livingSeats } from "../rules/state.ts";

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

/** The damage an enemy's attack would place on a defender now, before the shadow card (rr.step-6-4-4); with others declared, the pooled damage. */
export function defenseDamage(game: ScenarioState, ctx: ReduceContext, enemyId: string, defenderId: string): number {
  const enemy = game.cards[enemyId];
  if (!enemy) return 0;
  // A defender declared alongside others adds its Defense to theirs (Stand Together, rr.multiple-defenders).
  const pooled = [...standingDefenders(game, declaredDefenders(game.pendingAttack)).filter((id) => id !== defenderId), defenderId];
  return Math.max(0, modifiedStat(game, enemy, "attack", ctx.cards) - pooledDefense(game, pooled, ctx.cards));
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
 * causes; or, while a shadow card may still add to the attack, how much more it can take ("2 more damage destroys Sam Gamgee").
 */
export function outcomeWords(outcome: DamageOutcome, name: string, shadowNext: boolean): string {
  if (outcome.destroyed) {
    if (outcome.loss) return `${name} is destroyed: ${lossWords(outcome.loss)}`;
    if (outcome.eliminated.length > 0) return `${name} is destroyed: ${outcome.eliminated.map((seat) => `Player ${seat + 1}`).join(" and ")} is eliminated`;
    return `${name} is destroyed`;
  }
  if (shadowNext && outcome.spare != null) return `${outcome.spare} more damage destroys ${name}`;
  return "";
}

// The engagement checks' forecast for a state, worked out once per state object (the state is never changed in place).
const forecasts = new WeakMap<ScenarioState, ReadonlyMap<string, number>>();

/** Which seat each enemy in staging would engage at the checks at the threats now: the engine's checks run on a copy. */
export function engagesAt(game: ScenarioState, ctx: ReduceContext): ReadonlyMap<string, number> {
  const known = forecasts.get(game);
  if (known) return known;
  const forecast = engagementForecast(game, ctx.cards);
  forecasts.set(game, forecast);
  return forecast;
}

/** The enemies a seat will face this round: those engaged with it, and those in staging the checks would engage with it. */
export function enemiesToFace(game: ScenarioState, ctx: ReduceContext, seat: number): string[] {
  const engaging = [...engagesAt(game, ctx)].filter(([, to]) => to === seat).map(([id]) => id);
  return [...(game.seats[seat]?.engaged ?? []), ...engaging];
}

/**
 * One enemy in staging against a seat's threat, for the threat panel and the dial: its engagement cost, the seat the checks
 * would engage it with (null: it stays), and whether it cannot be engaged at all (141048:A:1).
 */
export type ThreatRow = { id: string; cost: number; engagesSeat: number | null; blocked: boolean };

/** The enemies in staging (with `seat`, once stages are separate, those in that seat's staging area) with an engagement cost, lowest first, and what the checks would do with each now (rr.engagement-check). */
export function threatRows(game: ScenarioState, ctx: ReduceContext, seat?: number): ThreatRow[] {
  const forecast = engagesAt(game, ctx);
  // Once stages are separate a seat reads its own staging area, not the union (mec109.multiple-staging-areas).
  const area = seat == null ? game.staging : stagingOf(game, seat);
  return area
    .flatMap((id): ThreatRow[] => {
      const card = game.cards[id];
      if (!card || card.face === "down" || ctx.cards.get(card.code)?.type !== "enemy") return [];
      const cost = engagementCostOf(game, card, ctx.cards);
      return cost == null ? [] : [{ id, cost, engagesSeat: forecast.get(id) ?? null, blocked: flagged(game, id, "cannotBeEngaged") }];
    })
    .sort((left, right) => left.cost - right.cost);
}

/** What the checks do with a staging enemy, for a seat's threat panel: "Engages", "Engages Player 2", "Stays", "Cannot be engaged". */
export function threatVerdict(row: ThreatRow, seat: number): { word: string; engages: boolean } {
  if (row.blocked) return { word: "Cannot be engaged", engages: false };
  if (row.engagesSeat == null) return { word: "Stays", engages: false };
  return row.engagesSeat === seat ? { word: "Engages", engages: true } : { word: `Engages Player ${row.engagesSeat + 1}`, engages: false };
}
