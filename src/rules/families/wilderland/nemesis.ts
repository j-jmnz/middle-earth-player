// Rules: rr.hit-points, rr.victory (data/rules/entries.json); ledger lines 18076:A:1, 18076:B:1, 18076:B:2, 18076:B:3.
// The Forest of Great Fear: the enemy with the most hit points of the encounter set that stayed set aside enters the staging area as the nemesis (`CardInstance.nemesis`), until it leaves play.
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { askTarget } from "../../windows/choices.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { gameReads } from "../../core/game-reads.ts";
import { NAMED_PILES, pileOf } from "../../core/piles.ts";
import { printedOf } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import { enemyAttacksFirstPlayer } from "../grapple/cards.ts";
import { markPicked } from "../play/refs.ts";
import type { Focus } from "../index.ts";

/** SearchNemesis: of the enemies still in the Spiders of Mirkwood and Dol Guldur Orcs piles, the one with the most printed hit points (the first player chooses among a tie) enters the staging area, flagged as the nemesis, and is the picked card. */
export function searchNemesis(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const candidates = [...pileOf(state, NAMED_PILES.spiders.deck), ...pileOf(state, NAMED_PILES.orcs.deck)].filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "enemy");
  const hitPoints = (id: string) => printedOf(ctx.cards, state.cards[id]?.code ?? "").health ?? 0;
  const top = Math.max(...candidates.map(hitPoints));
  const tied = candidates.filter((id) => hitPoints(id) === top);
  const chosen = focus.chosen != null && tied.includes(focus.chosen) ? focus.chosen : tied.length === 1 ? tied[0] : undefined;
  if (!chosen) return tied.length > 1 && effectData(state) ? askTarget(state, { instruction: { verb: "SearchNemesis" }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, tied) : state;
  const entered = moveEncounter(state, chosen, "staging", focus.seat, ctx, steps);
  return markPicked(updateCard(entered, chosen, { nemesis: true }), chosen);
}

/** NemesisAttacks: an engaged nemesis returns to the staging area; the nemesis then attacks the first player. Nothing happens with no nemesis in play. */
export function nemesisAttacks(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const nemesis = Object.values(state.cards).find((card) => card.nemesis === true && (card.zone === "staging" || card.zone === "engaged"));
  if (!nemesis) return state;
  const returned = nemesis.zone === "engaged" ? moveEncounter(state, nemesis.id, "staging", focus.seat, ctx, steps) : state;
  return enemyAttacksFirstPlayer(returned, nemesis.id, ctx, steps);
}

/** The settle sweep: a nemesis that left play is nemesis no longer ("until it leaves play"), once the events about its leaving have been heard. */
export function clearNemesis(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (state.stack.length > 0 || !gameReads(state, ctx, '"verb":"SearchNemesis"')) return state;
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (card.nemesis !== true || card.zone === "staging" || card.zone === "engaged") continue;
    if ((state.pendingEvents ?? []).some((event) => event.subject === card.id || event.cardId === card.id)) continue;
    next = updateCard(next, card.id, { nemesis: undefined });
  }
  return next;
}
