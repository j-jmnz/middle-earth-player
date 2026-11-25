// Rules: ats.villagers, ats.villagers-example, ats.villager-tokens-discarded, rr.replacement-effects, rr.step-6-4-3 (data/rules/entries.json); ledger lines 06066:B:1 to B:3, 06067:B:1, 06068:A:1, 06069:A:1, 06070:A:2, 06073:A:1, 06080:A:1.
// The villager tokens of Encounter at Amon Dîn. A villager token is a resource token on a location, on the quest card or on Rescued Villagers (the card's `resources`); it is not a resource (ats.villagers), so no payment, no Prowl and no hero's pool reads it: they read the
// pools of heroes, and a token lies on a card that is no hero. A discarded token returns to the token bank and is announced (`villagerDiscarded`, with the number discarded in the call as its `amount`, which a Response window's note reads), once for each token; a moved token is announced by nothing (ats.villager-tokens-discarded).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { gameReads } from "../../core/game-reads.ts";
import { flagged, inPlay, updateCard, type CardInstance, type ScenarioState } from "../../core/state.ts";
import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { queueEvent } from "../../windows/queue.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";
import { advanceNow } from "./advance.ts";

type Discard = Extract<Instruction, { verb: "DiscardVillagerTokens" }>;
type Move = Extract<Instruction, { verb: "MoveVillagerTokens" }>;

const RESCUED = "06068";

/** The card in play with this code, or undefined. */
export function cardInPlay(state: ScenarioState, code: string): CardInstance | undefined {
  return Object.values(state.cards).find((card) => card.code === code && inPlay(card.zone));
}

/** The id of the card in play with this code, or null. */
const inPlayWith = (state: ScenarioState, code: string): string | null => cardInPlay(state, code)?.id ?? null;

/** The card a record names: a reference (the source, the active location, the picked card) or the card in play with a code. */
function holder(state: ScenarioState, ref: Discard["from"], focus: Focus): string | null {
  return typeof ref === "string" ? refCard(state, ref, frameScope(state, focus.seat, focus.sourceId)) : inPlayWith(state, ref.code);
}

/** The effect's X grows by `by` (the tokens a verb discarded or moved), or is set to it when `replace`: the effect reads "if no villager token was discarded by this effect" through the condition `x`. */
function noteTokens(state: ScenarioState, by: number, replace: boolean): ScenarioState {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? patchTop(state, { data: { ...data, x: (replace ? 0 : (data.x ?? 0)) + by } }) : state;
}

/** Up to `amount` tokens leave the card for the bank, and each is announced (`villagerDiscarded`, about the card they left): the Forced effect of Dead Villagers and the Response of Lord Alcaron hear it. The tokens of one call are one occurrence. `by`: the enemy whose undefended attack discards them (the event's `other`), for the Response window's note; an effect's own card is the frame the window sits on. */
export function discardTokens(state: ScenarioState, id: string | null, amount: number, steps: EngineStep[], by?: string): { state: ScenarioState; discarded: number } {
  const card = id ? state.cards[id] : undefined;
  const count = card ? Math.min(Math.max(0, amount), card.resources) : 0;
  if (!id || !card || count === 0) return { state, discarded: 0 };
  let next = updateCard(state, id, { resources: card.resources - count });
  const occurrence = `villagers:${id}:${steps.length}:${next.pendingEvents?.length ?? 0}`;
  for (let each = 0; each < count; each += 1) next = queueEvent(next, { trigger: "villagerDiscarded", seat: null, subject: id, amount: count, ...(by ? { other: by } : {}), occurrence });
  return { state: next, discarded: count };
}

/** DiscardVillagerTokens: up to `amount` tokens (fewer when the card holds fewer) are discarded from the card; the effect's X is the number discarded, so "if no villager token is discarded by this effect" reads it. */
export function discardVillagerTokens(state: ScenarioState, instruction: Discard, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const result = discardTokens(state, holder(state, instruction.from, focus), resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx), steps);
  return noteTokens(result.state, result.discarded, true);
}

/** MoveVillagerTokens: up to `amount` tokens (`all` of them) go from one card to another card in play; nothing is discarded, so nothing hears it. The number moved is added to the effect's X (the players of Panicked! add up). */
export function moveVillagerTokens(state: ScenarioState, instruction: Move, focus: Focus, ctx: ReduceContext): ScenarioState {
  const from = holder(state, instruction.from, focus);
  const to = holder(state, instruction.to, focus);
  const source = from ? state.cards[from] : undefined;
  const target = to ? state.cards[to] : undefined;
  if (!source || !target || source.id === target.id || !inPlay(target.zone)) return state;
  const wanted = instruction.all === true ? source.resources : resolveAmount(state, instruction.amount ?? 1, frameScope(state, focus.seat, focus.sourceId), ctx);
  const moved = Math.min(Math.max(0, wanted), source.resources);
  if (moved === 0) return state;
  return noteTokens(updateCard(updateCard(state, source.id, { resources: source.resources - moved }), target.id, { resources: target.resources + moved }), moved, false);
}

/** The current stage holds `advancesWithoutVillagers` and its card holds no villager token: the quest advances at once, as its record says ("If there are no villager tokens on Savagery of the Orcs, advance to the next stage", 06066:B:3). Not during the Setup, and not while an effect (the replacement of the progress, the Responses to a discard) or an attack is open. */
export function advanceWithoutVillagers(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const stage = state.questStage;
  if (state.modifiers.length === 0 || !gameReads(state, ctx, '"advancesWithoutVillagers"')) return state;
  if (state.mode === "mulligan" || state.mode === "afterOpening" || state.lost || state.stageCleared || state.stack.length > 0 || state.pendingAttack || state.pendingStrike || !stage || !flagged(state, stage, "advancesWithoutVillagers")) return state;
  if ((state.cards[stage]?.resources ?? 0) > 0 || (state.pendingEvents?.length ?? 0) > 0 || restricted(state, ctx, "advance").length > 0) return state;
  return advanceNow(state, ctx, steps);
}

/** The `combat.undefended` answer: while the current stage holds `undefendedToVillagers`, the only target of an undefended attack is Rescued Villagers in the staging area, and no hero takes it (06067:B:1). None otherwise. */
export function undefendedVillagers(state: ScenarioState): readonly string[] {
  const stage = state.questStage;
  if (state.modifiers.length === 0 || !stage || !flagged(state, stage, "undefendedToVillagers")) return [];
  const rescued = Object.values(state.cards).find((card) => card.code === RESCUED && card.zone === "staging");
  return rescued ? [rescued.id] : [];
}

/** The `combat.damaged` hook: the damage the undefended attack put on Rescued Villagers is not damage. It is taken off again and as many tokens are discarded from the card instead (fewer tokens than damage: all of them), each one announced; no hero is damaged. */
export function villagersDamaged(before: ScenarioState, after: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!gameReads(after, ctx, '"undefendedToVillagers"')) return after;
  const rescued = Object.values(after.cards).find((card) => card.code === RESCUED && card.zone === "staging");
  const was = rescued ? before.cards[rescued.id] : undefined;
  if (!rescued || !was || rescued.damage <= was.damage) return after;
  const index = steps.findLastIndex((step) => step.kind === "damage" && step.targetId === rescued.id);
  if (index >= 0) steps.splice(index, 1);
  const attacker = before.pendingAttack?.enemyId ?? before.pendingStrike?.enemyId;
  return discardTokens(updateCard(after, rescued.id, { damage: was.damage }), rescued.id, rescued.damage - was.damage, steps, attacker).state;
}
