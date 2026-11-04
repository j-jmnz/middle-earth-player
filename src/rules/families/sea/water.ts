// Rules: rr.attachment-cards, rr.forced, dcce.ship-objectives (data/rules/entries.json); ledger lines 12132:A:1, 12132:A:2. Taking on Water: "When Revealed: Attach to a Ship objective. (Counts as a Condition attachment with
// the text: Forced: When attached objective exhausts, deal 2 damage to it. Action: Exhaust 3 characters you control to discard Taking on Water.)" and "Shadow: If defending character is a Ship, attach Taking on Water to it."
// AttachToShip attaches the treachery (the Shadow card too, which leaves the enemy's shadow cards as it attaches). Its Forced effect hears `shipExhausted`: the engine exhausts a Ship objective in many places (defending,
// attacking, questing, Sailing, an effect), so a settle sweep notices the Ship objectives that became exhausted since it last looked, in a game whose cards hear the trigger, and announces each one once. Its Action
// is the Ship's controller's, as the Action of an encounter card attached to a card is (player/actions.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import { askTarget } from "../../windows/choices.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { controlledShips } from "./campaign.ts";

type Attach = Extract<Instruction, { verb: "AttachToShip" }>;

// A host exhausted before the card attached did not exhaust "while attached": the sweep is told it is already exhausted.
function attach(state: ScenarioState, id: string, host: string): ScenarioState {
  const attached = updateCard(attachTo(moveCard(state, id, { zone: "attached" }), id, host), id, { face: "up" });
  const sea = attached.sea ?? { heading: null, headingCard: null, routes: {} };
  const seen = sea.exhausted ?? [];
  return attached.cards[host]?.exhausted && !seen.includes(host) ? { ...attached, sea: { ...sea, exhausted: [...seen, host] } } : attached;
}

/** AttachToShip: the source card attaches to a Ship objective: the one defending (`defender`), or one the first player chooses among those the players control. */
export function attachToShip(state: ScenarioState, instruction: Attach, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const source = focus.sourceId;
  if (!source || !state.cards[source]) return state;
  if (instruction.to === "defender") {
    const attack = state.pendingAttack;
    const defender = attack?.defenderId && !attack.undefended ? state.cards[attack.defenderId] : undefined;
    return defender && inPlay(defender.zone) && printedOf(ctx.cards, defender.code).ship === "objective" ? attach(state, source, defender.id) : state;
  }
  const options = controlledShips(state, ctx);
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (chosen) return attach(state, source, chosen);
  if (options.length === 0 || !effectData(state)) return state;
  return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
}

/** The settle sweep: each Ship objective that is exhausted now and was not when the sweep last looked is announced as `shipExhausted`. */
export function announceShipsExhausted(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, '"trigger":"shipExhausted"')) return state;
  const sea = state.sea ?? { heading: null, headingCard: null, routes: {} };
  const now = Object.values(state.cards)
    .filter((card) => card.exhausted && inPlay(card.zone) && printedOf(ctx.cards, card.code).ship === "objective")
    .map((card) => card.id);
  const before = sea.exhausted ?? [];
  const fresh = now.filter((id) => !before.includes(id));
  if (fresh.length === 0 && now.length === before.length) return state;
  let next: ScenarioState = { ...state, sea: { ...sea, exhausted: now } };
  for (const id of fresh) next = queueEvent(next, { trigger: "shipExhausted", seat: next.cards[id]?.controller ?? null, cardId: id });
  return next;
}
