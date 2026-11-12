// Rules: rr.campaign-setup-checklist, rr.damage, rr.first-player (data/rules/entries.json); ledger line 10156:A:2. The campaign card's Setup: Iârion's Pendant goes on Iârion, and each player may trade damage on Protect the Innocent for resources.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay, livingSeats, updateCard, type ScenarioState } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import { queueFront } from "../play/refs.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** AttachNewTo: a copy of the card from the supply goes into play attached to the card in play with the title, under that card's controller. With no such host nothing is attached. */
export function attachNewTo(state: ScenarioState, instruction: Verb<"AttachNewTo">, ctx: ReduceContext): ScenarioState {
  const host = Object.values(state.cards).find((card) => inPlay(card.zone) && card.controller != null && printedOf(ctx.cards, card.code).name === instruction.to);
  if (!host || host.controller == null) return state;
  const spawned = spawn(state, instruction.code, { zone: "play", seat: host.controller });
  return queueEvent(attachTo(spawned.state, spawned.id, host.id), { trigger: "attached", seat: host.controller, subject: spawned.id, other: host.id });
}

/**
 * TradeDamageForResources: starting with the first player, each player decides in turn whether to place `damage` damage on the card with the code in play and add `resources` resource to each hero in their pool; a trade places the tokens (nothing cancels them) and gives
 * the resources. The next player is asked once this one has answered; with the card not in play nobody is asked. Run outside an effect frame, which cannot ask, nobody trades.
 */
export function tradeDamageForResources(state: ScenarioState, instruction: Verb<"TradeDamageForResources">, focus: Focus, steps: EngineStep[]): ScenarioState {
  const target = Object.values(state.cards).find((card) => card.code === instruction.code && inPlay(card.zone));
  const order = [...livingSeats(state)].sort((a, b) => ((a - state.firstPlayer + state.seatCount) % state.seatCount) - ((b - state.firstPlayer + state.seatCount) % state.seatCount));
  const seat = instruction.seat ?? order[0];
  if (!target || seat == null) return state;
  const next = order[order.indexOf(seat) + 1];
  const cause = currentCause(steps, UNATTRIBUTED);
  const goOn = (current: ScenarioState): ScenarioState => (next != null ? queueFront(current, [{ instruction: { ...instruction, seat: next }, seat: next, chosen: null, cause }]) : current);
  if (focus.chosen == null) {
    if (!effectData(state)) return state;
    return askTarget(state, { instruction: { ...instruction, seat }, seat, chosen: null, cause }, ["trade", "keep"]);
  }
  if (focus.chosen !== "trade") return goOn(state);
  steps.push({ kind: "damage", targetId: target.id, amount: instruction.damage, cause });
  let traded = updateCard(state, target.id, { damage: target.damage + instruction.damage });
  for (const heroId of traded.seats[seat]?.heroes ?? []) {
    const hero = traded.cards[heroId];
    if (!hero) continue;
    for (let added = 0; added < instruction.resources; added += 1) steps.push({ kind: "gainResource", seat, heroId, cause });
    traded = updateCard(traded, heroId, { resources: hero.resources + instruction.resources });
  }
  return goOn(traded);
}
