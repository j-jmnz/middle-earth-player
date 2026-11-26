// Rules: rr.attachment-cards, rr.in-play-and-out-of-play, rr.engaged (data/rules/entries.json); ledger lines 17027:A:1, 17011:A:1, 17012:A:1, 17013:A:1, 17014:A:1.
//
// The Capture objectives of The Mûmakil. Stage 2A attaches one random set-aside Capture to a Wild Mûmak for each player (`AttachRandomSetAside`): the Capture lies attached to the Mûmak, faceup and controlled by nobody, so it is an objective in play, no player's
// card, and it leaves play with its host (releaseAttachments, src/rules/core/destroy.ts). Its Response is the engaged player's: `ActAsEngagedWithHost` runs the rest of the effect for the seat its host is engaged with, and drops it while the host is in the staging area.
import type { Instruction } from "../../../catalog/boundary.ts";

import { nextUint } from "../../core/seed.ts";
import { printedOf } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { attachTo, inPlay, moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { queueEvent } from "../../windows/queue.ts";
import { patchTop } from "../../windows/windows.ts";
import { effectData } from "../deck/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** AttachRandomSetAside: one set-aside card with the trait, drawn by the game seed (the ids in order, one step of the seed), is attached faceup to the last picked card in play and controlled by nobody. */
export function attachRandomSetAside(state: ScenarioState, instruction: Verb<"AttachRandomSetAside">, ctx: ReduceContext): ScenarioState {
  const host = state.cards[lastPicked(state)];
  if (!host || !inPlay(host.zone)) return state;
  const ids = state.setAside.filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").traits.includes(instruction.trait)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const drawn = ids[nextUint(state.seed, state.seedCursor) % Math.max(ids.length, 1)];
  if (!drawn) return state;
  const lying = updateCard(attachTo(moveCard({ ...state, seedCursor: state.seedCursor + 1 }, drawn, { zone: "attached" }), drawn, host.id), drawn, { face: "up", exhausted: false });
  return queueEvent(lying, { trigger: "attached", seat: state.firstPlayer, subject: drawn, other: host.id });
}

/** The seat the source's host enemy is engaged with, or null: no host, the host is not an enemy in an engagement area (it is in the staging area or gone). */
export function hostEngagedSeat(state: ScenarioState, sourceId: string | null): number | null {
  const host = sourceId ? state.cards[state.cards[sourceId]?.host ?? ""] : undefined;
  if (!host) return null;
  const seat = Object.keys(state.seats).map(Number).find((index) => state.seats[index]?.engaged.includes(host.id));
  return seat ?? null;
}

/** ActAsEngagedWithHost: the instructions after it resolve for the seat the source's host is engaged with; with none the rest of the effect is dropped. */
export function actAsEngagedWithHost(state: ScenarioState, focus: Focus): ScenarioState {
  const data = effectData(state);
  if (!data) return state;
  const seat = hostEngagedSeat(state, focus.sourceId);
  if (seat == null || state.seats[seat]?.eliminated) return patchTop(state, { data: { ...data, queue: [] } });
  return patchTop(state, { data: { ...data, queue: data.queue.map((item) => ({ ...item, seat })) } });
}
