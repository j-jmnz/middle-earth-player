// The scope a condition is asked in, the card a `matches` condition reads, and the handler table's types (interpret/condition-kinds/*.ts, interpret/conditions.ts).
import type { Condition } from "../../catalog/boundary.ts";
import type { ScenarioState } from "../core/state.ts";
import { hostOf } from "./amounts.ts";
import type { ReduceContext } from "./interpret.ts";

// Who the condition is asked about. `returned` is the count the running effect has returned to staging.
// `phase` overrides the current phase for an end-of-phase event, which fires after the phase has moved on.
// `holderId` is the card a stat is read for, and `against` the enemy it attacks.
export type Scope = {
  actor: number;
  sourceId: string | null;
  returned: number;
  phase?: string;
  holderId?: string;
  against?: string;
  subject?: string;
  explored?: boolean;
  // The event a Forced effect answers was made by a player card's effect (a heal or a ready).
  byPlayerCard?: boolean;
  // The engagement a Forced effect answers was from the staging area (kept only in a game with ships).
  fromStaging?: boolean;
  exhaustedToDefend?: boolean;
  // The seat the event a Response answers happened to.
  eventSeat?: number | null;
  // What the running effect has picked, and the other card the answered event names.
  picked?: readonly string[];
  other?: string;
  // The characters that took part in the player attack the effect answers (enemyAttacked).
  participants?: readonly string[];
  // The running effect's X.
  x?: number;
  // The damage the answered event placed.
  dealt?: number;
  // The damage the attack sent on past its defender (excessToShip).
  excess?: number;
  // The attack an `attackResolved` event answers dealt its enemy a shadow card with no effect, which was discarded when it resolved (18022:A:1).
  shadowBlank?: boolean;
};

// The card a `matches` condition reads.
export function conditionCard(state: ScenarioState, card: Extract<Condition, { kind: "matches" }>["card"], scope: Scope): string | null {
  switch (card) {
    case "self":
      return scope.sourceId;
    case "host":
      return hostOf(state, scope.sourceId);
    case "subject":
      return scope.subject ?? null;
    case "other":
      return scope.other ?? null;
    case "activeLocation":
      return state.activeLocation;
    case "picked":
      return scope.picked?.at(-1) || null;
    case "previous":
      return scope.picked?.at(-2) || null;
    case "attacker":
      return state.pendingAttack?.enemyId ?? state.pendingStrike?.enemyId ?? null;
    case "defender":
      return state.pendingAttack?.defenderId ?? null;
  }
}

export type ConditionKind = Condition["kind"];
// One condition kind's reader. `holds` (interpret/conditions.ts) looks it up in a module-level table, so a kind a family's hook does not answer is read by exactly one handler.
export type ConditionHandler<K extends ConditionKind> = (state: ScenarioState, condition: Extract<Condition, { kind: K }>, scope: Scope, ctx: ReduceContext) => boolean;
export type ConditionHandlers = { [K in ConditionKind]: ConditionHandler<K> };
