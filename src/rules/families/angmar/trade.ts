// Rules: rr.campaign-setup-checklist, rr.damage, rr.first-player (data/rules/entries.json); ledger line 10156:A:2. The campaign card's Setup: Iârion's Pendant goes on Iârion, and each player may trade damage on Protect the Innocent for resources.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay, updateCard, type ScenarioState } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Focus } from "../index.ts";
import { seatTurn } from "./in-turn.ts";
import { askTradeOrKeep } from "../encounter/trade.ts";

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
 * the resources. The next player is asked once this one has answered; with the card not in play nobody is asked. Run outside an effect frame, which cannot ask, the step fails.
 */
export function tradeDamageForResources(state: ScenarioState, instruction: Verb<"TradeDamageForResources">, focus: Focus, steps: EngineStep[]): ScenarioState {
  const target = Object.values(state.cards).find((card) => card.code === instruction.code && inPlay(card.zone));
  const turn = seatTurn(state, instruction, steps); // first player first
  if (!target || !turn) return state;
  const { seat, cause, goOn } = turn;
  const decided = askTradeOrKeep(state, focus, { instruction: turn.asked, seat, cause }, "Trading damage needs a choice, and no effect is asking", goOn);
  if (decided) return decided;
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
