// Rules: dcce.boarding (data/rules/entries.json). Boarding X: when a ship-enemy with the keyword engages a player from the staging area, the top X
// cards of the Corsair deck are revealed and the enemies put into play engaged with that player. It does not resolve when the ship-enemy engages a
// player from another player's play area, the encounter deck or its discard pile. X is the printed value, plus what a card gives ("gains Boarding 1")
// and less what a card takes ("reduce that enemy's Boarding value by 1"), never below 0.
import { ruleCause } from "../cause.ts";
import { pushEffectFrame } from "../effect-frames.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import type { GameEvent, ScenarioState } from "../state.ts";
import { heldAmount, updateCard } from "../state.ts";
import { revealCorsair } from "./sea-corsair.ts";

/** The Boarding value the enemy has now (0 for a card with none). */
export function boardingOf(state: ScenarioState, id: string, ctx: ReduceContext): number {
  const instance = state.cards[id];
  if (!instance) return 0;
  return Math.max(0, (printedOf(ctx.cards, instance.code).keywords.boarding ?? 0) + heldAmount(state, id, "boarding"));
}

// The resources a Raider revealed by the ship's Boarding enters play with ("enters play with 1 resource on it", 11057:A:3).
function boardingResources(state: ScenarioState, id: string): number {
  return Math.max(0, heldAmount(state, id, "boardingResource"));
}

function withBoardingResources(state: ScenarioState, seat: number, before: ReadonlySet<string>, resources: number, ctx: ReduceContext): ScenarioState {
  if (resources <= 0) return state;
  let next = state;
  for (const id of state.seats[seat]?.engaged ?? []) {
    const card = next.cards[id];
    if (!card || before.has(id) || !printedOf(ctx.cards, card.code).traits.includes("Raider")) continue;
    next = updateCard(next, id, { resources: card.resources + resources });
  }
  return next;
}

/** The engagement the event announces, when it is a ship-enemy engaging a player from the staging area: the Boarding keyword resolves, in a frame pushed under the
 * Responses to the engagement ("When a non-unique Ship enemy engages you, ... reduce that enemy's Boarding value by 1", 11175:B:3), so they are used first and the keyword
 * then resolves with the value the enemy has by then. Any other event, and an engagement from anywhere else, changes nothing. */
export function board(state: ScenarioState, event: GameEvent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (event.trigger !== "engaged" || event.fromStaging !== true || event.seat == null || event.subject == null) return state;
  const enemy = state.cards[event.subject];
  if (!enemy || enemy.zone !== "engaged" || printedOf(ctx.cards, enemy.code).ship !== "enemy" || boardingOf(state, event.subject, ctx) <= 0) return state;
  return pushEffectFrame(state, { frame: "forced", sourceId: event.subject, actor: event.seat, peril: false, effectId: `${enemy.code}:boarding`, instructions: [{ verb: "Board" }], cancel: null, blockCancel: null, cause: ruleCause("dcce.boarding") }, steps);
}

/** Board: the keyword resolves for the ship-enemy that engaged the actor from the staging area: the top X cards of the Corsair deck are revealed into play engaged with them. */
export function boardNow(state: ScenarioState, shipId: string | null, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const enemy = shipId ? state.cards[shipId] : undefined;
  if (!shipId || !enemy || enemy.zone !== "engaged" || enemy.controller !== seat) return state;
  const count = boardingOf(state, shipId, ctx);
  if (count <= 0) return state;
  // The engagements this reveal makes are the keyword's own: the step names the ship, so the table tells them as its Boarding and not as engagements of their own.
  const from = steps.length;
  const before = new Set(state.seats[seat]?.engaged ?? []);
  const revealed = withBoardingResources(revealCorsair(state, seat, count, ctx, steps), seat, before, boardingResources(state, shipId), ctx);
  for (let at = from; at < steps.length; at += 1) {
    const step = steps[at];
    if (step?.kind === "engage") steps[at] = { ...step, boarding: shipId };
  }
  return revealed;
}
