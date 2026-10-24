// Rules: rr.in-play-and-out-of-play, mec109.immune-to-player-card-effects (data/rules/entries.json).
import type { PickSpec } from "../catalog/boundary.ts";

import { attachmentHostIds } from "./attach.ts";
import { canAttack, characters, legalAttackEnemies } from "./combat.ts";
import { hasTrait } from "./conditions.ts";
import type { ReduceContext } from "./interpret.ts";
import { playerCardEffectCanChoose, uniqueBlocked } from "./keywords.ts";
import { printedOf } from "./printed.ts";
import { stagingLocations } from "./quest.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats } from "./state.ts";

// A Pick names cards or players a player may choose for the instructions after it. The seat is the one making the choice.
// Cards that are immune to player card effects cannot be chosen (mec109.immune-to-player-card-effects). A pick is a
// player card effect: only player cards carry the verb.
export function pickCandidates(
  state: ScenarioState,
  spec: PickSpec,
  seat: number,
  picked: readonly string[],
  sourceId: string | null,
  ctx: ReduceContext,
  // The X an event was played for, for a pick that asks for a printed cost of X.
  x?: number,
): string[] {
  const asking = spec.who === "firstPlayer" ? state.firstPlayer : seat;
  const seats = spec.control === "you" ? [asking] : livingSeats(state);
  if (spec.type === "player") return seats.filter((index) => !state.seats[index]?.eliminated).map((index) => `seat:${index}`);
  if (spec.hostForPicked) {
    const code = state.cards[picked.at(-1) ?? ""]?.code;
    return code ? attachmentHostIds(state, asking, code, ctx) : [];
  }
  const raw: string[] = [];
  const from = spec.from ?? "play";
  if (from === "hand") for (const index of seats) raw.push(...(state.seats[index]?.hand ?? []));
  else if (from === "discard") {
    for (const index of seats) {
      const pile = state.seats[index]?.discard ?? [];
      if (!spec.topmost) raw.push(...pile);
      else {
        // The last card put on a discard pile is its top.
        const top = [...pile].reverse().find((id) => {
          const instance = state.cards[id];
          return instance != null && (!spec.cardType || printedOf(ctx.cards, instance.code).type === spec.cardType);
        });
        if (top) raw.push(top);
      }
    }
  }
  else if (from === "deck") for (const index of seats) raw.push(...(state.seats[index]?.deck ?? []).slice(0, spec.top ?? Number.MAX_SAFE_INTEGER));
  else if (spec.type === "enemy") {
    for (const index of seats) raw.push(...(state.seats[index]?.engaged ?? []));
    if (spec.staging) raw.push(...state.staging);
  } else if (spec.type === "location") {
    raw.push(...stagingLocations(state, ctx.cards), ...[state.activeLocation, state.secondActiveLocation].filter((id): id is string => id != null));
  } else {
    for (const index of seats) raw.push(...characters(state, index, ctx.cards));
  }
  return raw.filter((id) => {
    const instance = state.cards[id];
    if (!instance || id === sourceId || picked.includes(id)) return false;
    const printed = printedOf(ctx.cards, instance.code);
    if (!playerCardEffectCanChoose(printed)) return false;
    if (spec.type !== "card" && !(spec.type === "character" ? printed.type === "hero" || printed.type === "ally" : printed.type === spec.type)) return false;
    if (spec.trait && !hasTrait(state, id, spec.trait, ctx)) return false;
    if (spec.sphere && printed.sphere !== spec.sphere) return false;
    if (spec.cardType && printed.type !== spec.cardType) return false;
    if (spec.intoPlay && uniqueBlocked(state, printed, ctx.cards)) return false;
    if (spec.costIsX && x != null && printed.cost !== x) return false;
    if (spec.maxCost != null && (printed.cost == null || printed.cost > spec.maxCost)) return false;
    if (spec.cost != null && (from === "play" || printed.cost !== spec.cost)) return false;
    if (spec.state === "ready" && instance.exhausted) return false;
    if (spec.state === "exhausted" && !instance.exhausted) return false;
    if (spec.canAttack && !legalAttackEnemies(state, instance.controller ?? seat, id, ctx.cards, true).length) return false;
    if (spec.attackableByPicked) {
      const attacker = picked.at(-1);
      if (!attacker || !canAttack(state, state.cards[attacker]?.controller ?? seat, attacker, id, ctx.cards, true)) return false;
    }
    return true;
  });
}
