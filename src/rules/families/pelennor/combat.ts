// Rules: rr.engaged, rr.step-6-8b, rr.cancel (data/rules/entries.json); ledger lines 145080:A:1, 145050:A:1, 145048:A:1.
// What the box's flags do to a player attack, and the cancel of a cancel.
import type { PrintedCard } from "../../core/printed.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay } from "../../core/state.ts";
import { minasTirithId } from "./wall.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { queueEvent } from "../../windows/queue.ts";
import { effectsOf } from "../../windows/listen.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

/** "Only the engaged player can declare attackers against The Witch-king" (145080:A:1): any character that does not belong to the seat the enemy is engaged with is barred, ranged or not. */
export function attackerBarredByEngagement(state: ScenarioState, enemyId: string, attackerId: string): string | null {
  if (!flagged(state, enemyId, "attackOnlyByEngaged")) return null;
  const enemy = state.cards[enemyId];
  const attacker = state.cards[attackerId];
  return enemy?.zone === "engaged" && attacker?.controller === enemy.controller ? null : "Only the engaged player can declare attackers against that enemy";
}

/** "Cannot be attacked by more than 1 character at a time" (145050:A:1): a declaration of more than one attacker against the enemy is refused. */
export function attackersAtOnceReason(state: ScenarioState, enemyId: string, count: number): string | null {
  return flagged(state, enemyId, "singleAttacker") && count > 1 ? "That enemy cannot be attacked by more than 1 character at a time" : null;
}

/** Whether the Response that is open answers a treachery revealed from the encounter deck: found from the innermost reveal Response on the stack (the frames cancelAnswered reads), whose frame below holds the revealed card. */
function revealedTreachery(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): boolean {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const frame = state.stack[index];
    if (frame?.data.kind !== "responses") continue;
    if (frame.data.event.trigger !== "encounterRevealed" && frame.data.event.trigger !== "whenRevealedPending") continue;
    const below = state.stack[index - 1];
    const card = below?.cardId ? state.cards[below.cardId] : undefined;
    return card != null && printedOf(cards, card.code).type === "treachery";
  }
  return false;
}

/** The card in play with a Forced record that hears `counterCanceled` (Fire-filled Trench), if any: found through the records of each card in play by its code. */
function counterOf(state: ScenarioState, ctx: ReduceContext): string | undefined {
  return Object.values(state.cards).find((card) => inPlay(card.zone) && effectsOf(ctx, card.code).some((effect) => effect.timing === "forced" && effect.trigger === "counterCanceled"))?.id;
}

/** The cancel of a player event that would cancel the effects of a treachery card just revealed, while a card that hears `counterCanceled` is in play (145048:A:1): the event's effects are canceled instead (its remaining instructions do not run) and that card is told, so its Forced record discards it. Null when the cancel is not one. */
export function counterCancel(state: ScenarioState, ctx: ReduceContext): ScenarioState | null {
  const running = topFrame(state);
  const event = running?.cardId ? state.cards[running.cardId] : undefined;
  if (running?.data.kind !== "effect" || !event || printedOf(ctx.cards, event.code).type !== "event" || !revealedTreachery(state, ctx.cards)) return null;
  const trench = counterOf(state, ctx);
  if (!trench) return null;
  return queueEvent(patchTop(state, { data: { ...running.data, canceled: true } }), { trigger: "counterCanceled", seat: null, cardId: trench });
}
/** The objective an undefended attack of this enemy must damage instead of a hero, while Minas Tirith is in play (145055:A:2); undefined for any other enemy. */
export function undefendedToCity(state: ScenarioState, enemyId: string): string | undefined {
  return flagged(state, enemyId, "undefendedToMinasTirith") ? minasTirithId(state) : undefined;
}
