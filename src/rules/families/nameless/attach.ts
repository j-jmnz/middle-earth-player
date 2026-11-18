// Rules: rr.attachment-cards, rr.first-player (data/rules/entries.json); ledger lines 04125:A:1, 04125:A:2, 04126:A:1, 04123:A:2, 901704:A:1, 901705:A:1, 901706:A:1, 901708:A:2.
//
// The player cards attached to a Nameless enemy. A card taken from the top of a deck lies faceup on the enemy as an attachment with no title and no game text (`CardInstance.nameless`, zone attached, host the enemy, owner the deck's seat, nobody controls it): its printed
// cost, a hero, an event with an X cost or a card with no printed cost counting 0, is its only active part. It goes to its owner's discard pile when the enemy leaves play (families/play/zones.ts leaveWith).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** Whether the card is a player card lying on an enemy as one of its nameless attachments. */
export function isNamelessCard(state: ScenarioState, id: string): boolean {
  const card = state.cards[id];
  return card?.nameless === true && card.zone === "attached" && card.host != null;
}

/** The cards attached to the enemy from a deck, oldest first. */
export function namelessCards(state: ScenarioState, hostId: string): readonly string[] {
  return (state.cards[hostId]?.attachments ?? []).filter((id) => isNamelessCard(state, id));
}

/** The printed cost of the cards attached to the enemy added up: a card with no printed cost counts 0. */
export function attachedCost(state: ScenarioState, hostId: string, cards: ReadonlyMap<string, PrintedCard>): number {
  return namelessCards(state, hostId).reduce((sum, id) => sum + (printedOf(cards, state.cards[id]?.code ?? "").cost ?? 0), 0);
}

function hostOf(state: ScenarioState, to: Verb<"AttachDeckTop">["to"], focus: Focus): string | null {
  switch (to ?? "self") {
    case "self":
      return focus.sourceId;
    case "picked":
      return lastPicked(state) || null;
    case "attacker":
      return state.pendingAttack?.enemyId ?? null;
    case "subject":
      return topSubject(state);
  }
}

// The card the answered event was about: the running effect frame's subject.
function topSubject(state: ScenarioState): string | null {
  const frame = state.stack.at(-1);
  return frame?.data.kind === "effect" ? (frame.data.subject ?? null) : null;
}

/** AttachDeckTop: see the schema entry. */
export function attachDeckTop(state: ScenarioState, instruction: Verb<"AttachDeckTop">, focus: Focus, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState {
  const hostId = hostOf(state, instruction.to, focus);
  const host = hostId ? state.cards[hostId] : undefined;
  if (!hostId || !host || !inPlay(host.zone) || printedOf(ctx.cards, host.code).type !== "enemy") return state;
  const seat = instruction.deck === "firstPlayer" ? state.firstPlayer : focus.seat;
  let next = state;
  let attached = 0;
  for (;;) {
    const top = next.seats[seat]?.deck[0];
    if (!top) break;
    const wanted = instruction.untilCost != null ? attachedCost(next, hostId, ctx.cards) < instruction.untilCost : attached < (instruction.count ?? 1);
    if (!wanted) break;
    next = attachTo(updateCard(moveCard(next, top, { zone: "attached" }), top, { face: "up", controller: null, owner: seat, nameless: true, exhausted: false }), top, hostId);
    attached += 1;
  }
  return attached > 0 && instruction.extra !== true ? queueEvent(next, { trigger: "attachedFromDeck", seat, subject: hostId }) : next;
}
