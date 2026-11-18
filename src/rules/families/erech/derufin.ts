// Rules: rr.ownership-and-control, rr.staging-area (data/rules/entries.json); docs/brief.md (The Stone of Erech, Derufin); ledger lines 50302:A:1, 50304:A:1. Derufin, a set aside objective ally, is attached to The Stone of Erech while it lies in the staging area (not revealed, controlled by nobody), and the first player
// gains control of him after the players travel to it: he leaves the Stone and joins the first player's play area ready, as an ally, who can commit, attack, defend and take damage.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { attachTo, moveCard, unhost } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** AttachSetAsideToStaged: the set aside card with this code is attached to the card in play with this title, wherever that card lies, controlled by nobody. */
export function attachSetAsideToStaged(state: ScenarioState, instruction: Verb<"AttachSetAsideToStaged">, ctx: ReduceContext): ScenarioState {
  const id = state.setAside.find((other) => state.cards[other]?.code === instruction.code);
  const host = Object.values(state.cards).find((card) => inPlay(card.zone) && printedOf(ctx.cards, card.code).name === instruction.to);
  if (!id || !host) return state;
  const placed = updateCard(attachTo(moveCard(state, id, { zone: "attached" }), id, host.id), id, { face: "up", exhausted: false });
  return queueEvent(placed, { trigger: "attached", seat: state.firstPlayer, subject: id, other: host.id });
}

/** FreeAttachedObjective: the source, attached to a card, leaves it and is controlled by the first player: ready, in his play area. */
export function freeAttachedObjective(state: ScenarioState, sourceId: string | null): ScenarioState {
  const card = sourceId ? state.cards[sourceId] : undefined;
  if (!sourceId || !card || card.zone !== "attached" || card.host == null || state.seats[state.firstPlayer]?.eliminated) return state;
  const freed = moveCard(unhost(state, sourceId), sourceId, { zone: "play", seat: state.firstPlayer });
  return queueEvent(updateCard(freed, sourceId, { face: "up", exhausted: false }), { trigger: "changedControl", seat: state.firstPlayer, cardId: sourceId });
}
