// Rules: dcce.boarding (data/rules/entries.json). Boarding X: when a ship-enemy with the keyword engages a player from the staging area, the top X
// cards of the Corsair deck are revealed and the enemies put into play engaged with that player. It does not resolve when the ship-enemy engages a
// player from another player's play area, the encounter deck or its discard pile. X is the printed value, plus what a card gives ("gains Boarding 1")
// and less what a card takes ("reduce that enemy's Boarding value by 1"), never below 0.
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import type { GameEvent, ScenarioState } from "../state.ts";
import { heldAmount } from "../state.ts";
import { revealCorsair } from "./sea-corsair.ts";

/** The Boarding value the enemy has now (0 for a card with none). */
export function boardingOf(state: ScenarioState, id: string, ctx: ReduceContext): number {
  const instance = state.cards[id];
  if (!instance) return 0;
  return Math.max(0, (printedOf(ctx.cards, instance.code).keywords.boarding ?? 0) + heldAmount(state, id, "boarding"));
}

/** The engagement the event announces, when it is a ship-enemy engaging a player from the staging area: the Boarding keyword resolves. Any other
 * event, and an engagement from anywhere else, changes nothing. */
export function board(state: ScenarioState, event: GameEvent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (event.trigger !== "engaged" || event.fromStaging !== true || event.seat == null || event.subject == null) return state;
  const enemy = state.cards[event.subject];
  if (!enemy || enemy.zone !== "engaged" || printedOf(ctx.cards, enemy.code).ship !== "enemy") return state;
  const count = boardingOf(state, event.subject, ctx);
  if (count <= 0) return state;
  // The engagements this reveal makes are the keyword's own: the step names the ship, so the table tells them as its Boarding and not as engagements of their own.
  const from = steps.length;
  const revealed = revealCorsair(state, event.seat, count, ctx, steps);
  for (let at = from; at < steps.length; at += 1) {
    const step = steps[at];
    if (step?.kind === "engage") steps[at] = { ...step, boarding: event.subject };
  }
  return revealed;
}
