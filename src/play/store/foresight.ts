// Rules: rr.step-6-4-4, rr.step-6-8-3, rr.hit-points, rr.player-elimination, rr.threat-elimination-level, rr.engagement-check,
// mec109.setting-up-the-game (data/rules/entries.json).
//
// What a choice would do before it is confirmed, read with the engine's own functions on a throwaway copy of the state: the
// damage an attack would place and whether it destroys the card (toughness, indestructible and "cannot take damage"
// included), whether that loses the game (The One Ring leaves play with its bearer; no seat remains) or eliminates a seat,
// and how much more damage the card can take. Nothing here changes the game: the copy is dropped.
import { hindersInCombat } from "../../rules/families/ring-maker/hinder.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { stagingOf } from "../../rules/families/breaking/areas.ts";
import { declaredDefenders, pooledDefense, standingDefenders } from "../../rules/families/defense/defenders.ts";
import { destroyCard, modifiedStat, placeDamage } from "../../rules/core/keywords.ts";
import { engagementCostOf, engagementForecast } from "../../rules/quest/quest.ts";
import type { EngineStep, ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { flagged, inPlay, livingSeats } from "../../rules/core/state.ts";
import { effectsOf } from "../../rules/windows/listen.ts";

import { eliminatesWhenLeaving } from "../readouts/haradrim/staged.ts";
import { lossWaits } from "../readouts/against-the-shadow/amon-din.ts";
import { alcaronHeldWords } from "../words/scenarios/against-the-shadow/amon-din.ts";

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
const NO_SEATS = "No seats remain";

function place(game: ScenarioState, ctx: ReduceContext, cardId: string, amount: number): ScenarioState {
  const steps: EngineStep[] = [];
  return placeDamage(game, cardId, amount, ctx.cards, steps, "combat", ruleCause("rr.step-6-4-4"));
}

// "If X leaves play, the players lose the game" printed as a Forced-style line of its own (Bilbo Baggins, "If Bilbo Baggins leaves play, the players lose the game", 131001:A:3 and 132001:A:3): a record that hears the card leave play and loses the game. The engine applies
// it when the record resolves, after the destruction, so a copy of the state that only destroys the card does not show it. A card in play whose record names the leaving card (Mendor's) counts too.
const HELD = ", held";
const waits = (effect: ReturnType<typeof effectsOf>[number]): boolean => effect.trigger === "leftPlay" && effect.subject === "self" && effect.condition == null && effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === "endingLost");

function leavesPlayLoss(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const leaving = game.cards[cardId];
  const name = leaving ? ctx.cards.get(leaving.code)?.name : undefined;
  if (!leaving || name == null || !inPlay(leaving.zone)) return null;
  const loses = Object.values(game.cards).some((card) => inPlay(card.zone) && effectsOf(ctx, card.code).some((effect) => {
    // Lord Alcaron's own line (06070:A:3) sets the flag the end of the game reads (`endingLost`): the loss itself comes at once, or once Ghulat has left play.
    if (card.id === cardId && waits(effect)) return true;
    if (effect.timing !== "triggered" || effect.trigger !== "leftPlay" || effect.condition != null || !effect.instructions.some((instruction) => instruction.verb === "LoseGame")) return false;
    const subject = effect.subject;
    return subject === "self" ? card.id === cardId : typeof subject === "object" && subject.names?.includes(name) === true;
  }));
  // The loss waits for Ghulat (the game cannot end while he is in play): the dock says so (lossWords).
  const waiting = lossWaits(game) && effectsOf(ctx, leaving.code).some(waits);
  return loses ? `${name} left play${waiting ? HELD : ""}` : null;
}

/** Whether discarding a card from play would lose the game now (a hero who carries Wormsbane, the One Ring's bearer, Bilbo Baggins): the reason, or null. */
export function discardLoss(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const after = destroyCard(game, cardId, ctx.cards, []);
  if (after.lost && !game.lost) return after.lossReason ?? "The game is lost";
  // A card that stayed in play (a destruction that something replaced) leaves no record to hear.
  const left = after.cards[cardId];
  return left == null || !inPlay(left.zone) ? leavesPlayLoss(game, ctx, cardId) : null;
}

// "If X leaves play, you are eliminated from the game" (an objective-hero, 16031:A:2): its own record eliminates the seat that controls it once it has left play, which a copy of the state that only destroys the card does not show. The seat, or null for any other card.
function eliminatedWhenLeaving(game: ScenarioState, ctx: ReduceContext, cardId: string): number | null {
  const card = game.cards[cardId];
  if (card?.controller == null) return null;
  return eliminatesWhenLeaving(ctx, card.code) ? card.controller : null;
}

/** What placing `damage` combat damage on a card would do now. */
export function damageOutcome(game: ScenarioState, ctx: ReduceContext, cardId: string, damage: number): DamageOutcome {
  const after = damage > 0 ? place(game, ctx, cardId, damage) : game;
  const card = after.cards[cardId];
  const destroyed = card == null || !inPlay(card.zone);
  const before = new Set(livingSeats(game));
  const gone = destroyed ? eliminatedWhenLeaving(game, ctx, cardId) : null;
  const fell = after.lost ? [] : [...before].filter((seat) => !livingSeats(after).includes(seat));
  const eliminated = gone != null && before.has(gone) && !fell.includes(gone) ? [...fell, gone] : fell;
  // Every seat gone: the scenario ends in defeat (no seats remain), as the engine says it once the record has run.
  const everyoneOut = gone != null && !after.lost && [...before].every((seat) => eliminated.includes(seat));
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
  const loss = after.lost && !game.lost ? (after.lossReason ?? "The game is lost") : everyoneOut ? NO_SEATS : destroyed ? leavesPlayLoss(game, ctx, cardId) : null;
  return { damage, destroyed, loss, eliminated, spare };
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
  if (reason === NO_SEATS) return "the game is lost";
  const held = new RegExp(`^(.*) left play${HELD}$`).exec(reason);
  if (held) return alcaronHeldWords(held[1] ?? "");
  const left = /^(.*) left play$/.exec(reason);
  return left ? `${left[1]} leaves play and the game is lost` : "the game is lost";
}

/**
 * What a card's damage comes to, in words, for the dock: "Sam Gamgee is destroyed", with the loss or the elimination it
 * causes; or, while a shadow card may still add to the attack, how much more it can take ("2 more damage destroys Sam Gamgee").
 */
export function outcomeWords(outcome: DamageOutcome, name: string, shadowNext: boolean): string {
  if (outcome.destroyed) {
    // The seats a destruction eliminates are named first, and the loss follows when no seat is left ("Tamed Mûmak is destroyed: Player 1 is eliminated and the game is lost").
    if (outcome.eliminated.length > 0 && (outcome.loss == null || outcome.loss === NO_SEATS)) {
      const seats = outcome.eliminated.map((seat) => `Player ${seat + 1}`).join(" and ");
      return `${name} is destroyed: ${seats} ${outcome.eliminated.length === 1 ? "is" : "are"} eliminated${outcome.loss ? ` and ${lossWords(outcome.loss)}` : ""}`;
    }
    if (outcome.loss) return `${name} is destroyed: ${lossWords(outcome.loss)}`;
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

/** The enemies a seat will face this round: those engaged with it, and those in staging the checks would engage with it, less those that will make no attack in the combat phase (Hinder, rm.hinder: its flags exist only then, so the records are read). */
export function enemiesToFace(game: ScenarioState, ctx: ReduceContext, seat: number): string[] {
  const engaging = [...engagesAt(game, ctx)].filter(([, to]) => to === seat).map(([id]) => id);
  return [...(game.seats[seat]?.engaged ?? []), ...engaging].filter((id) => !hindersInCombat(ctx, game.cards[id]?.code ?? ""));
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
