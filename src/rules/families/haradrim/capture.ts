// Rules: rr.attachment-cards, rr.in-play-and-out-of-play, rr.engaged (data/rules/entries.json); ledger lines 17027:A:1, 17011:A:1, 17012:A:1, 17013:A:1, 17014:A:1.
//
// The Capture objectives of The Mûmakil. Stage 2A attaches one random set-aside Capture to a Wild Mûmak for each player (`AttachRandomSetAside`): the Capture lies attached to the Mûmak, faceup and controlled by nobody, so it is an objective in play, no player's
// card, and it leaves play with its host (releaseAttachments, src/rules/core/destroy.ts). Its Response is the engaged player's (`answeredBy: hostEngaged`, src/rules/windows/responses.ts): it is not offered while the host is in the staging area.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { engagedSeat } from "../../core/engaged.ts";
import { drawRandomSetAside } from "../../core/set-aside-draw.ts";
import { printedOf } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { attachTo, inPlay, moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { queueEvent } from "../../windows/queue.ts";
import { addToVictory } from "../sidequests/victory.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** AttachRandomSetAside: one set-aside card with the trait, drawn by the game seed (the ids in order, one step of the seed), is attached faceup to the last picked card in play and controlled by nobody. */
export function attachRandomSetAside(state: ScenarioState, instruction: Verb<"AttachRandomSetAside">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const host = state.cards[lastPicked(state)];
  if (!host || !inPlay(host.zone)) return state;
  const drawn = drawRandomSetAside(state, (id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").traits.includes(instruction.trait));
  if (!drawn) return state;
  const lying = updateCard(attachTo(moveCard({ ...state, seedCursor: state.seedCursor + 1 }, drawn, { zone: "attached" }), drawn, host.id), drawn, { face: "up", exhausted: false });
  steps.push({ kind: "attachDrawn", cardId: drawn, hostId: host.id, seat: engagedSeat(state, host.id) });
  return queueEvent(lying, { trigger: "attached", seat: state.firstPlayer, subject: drawn, other: host.id });
}

/** The seat the source's host enemy is engaged with, or null: no host, the host is not an enemy in an engagement area (it is in the staging area or gone). */
export function hostEngagedSeat(state: ScenarioState, sourceId: string | null): number | null {
  const host = sourceId ? state.cards[state.cards[sourceId]?.host ?? ""] : undefined;
  if (!host) return null;
  return engagedSeat(state, host.id);
}

/** AddWithHostToVictory: the source and then its host enemy go to the victory display; the host is taken before the source leaves play, which clears its host. */
export function addWithHostToVictory(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!source) return state;
  const moved = addToVictory(state, source.id, ctx);
  return source.host && moved.cards[source.host] ? addToVictory(moved, source.host, ctx) : moved;
}
