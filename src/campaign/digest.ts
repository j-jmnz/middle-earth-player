// A 32-bit hash of the table a player sees, kept beside each saved intent (ActiveScenario.checks) so a replay on another engine
// version or other card data can tell, move by move, whether it rebuilds the same table (docs/architecture.md, Persistence).
// It reads a curated view: each card in id order (code, zone, face, exhausted, damage, progress, resources, host, controller,
// committed), each seat's threat, the phase, the round, the quest stage and the open window's kind and seat. It leaves out `undo`,
// caches and the internal queues, so a new state field never changes it; a difference that is not in the view shows at the next
// move that changes the table. Pure.
import type { CardInstance, ScenarioState } from "../rules/core/state.ts";

const PRIME = 16777619;
const BASIS = 2166136261;

function mixNumber(hash: number, value: number): number {
  return Math.imul((hash ^ value) >>> 0, PRIME) >>> 0;
}

// Each character, then a separator, so "ab" + "c" and "a" + "bc" hash apart.
function mixString(hash: number, value: string): number {
  let next = hash;
  for (let index = 0; index < value.length; index += 1) next = mixNumber(next, value.charCodeAt(index));
  return mixNumber(next, 0x1f);
}

function mixCard(hash: number, card: CardInstance): number {
  let next = mixString(hash, card.id);
  next = mixString(next, card.code);
  next = mixString(next, card.zone);
  next = mixString(next, card.face);
  next = mixNumber(next, (card.exhausted ? 1 : 0) | (card.committed ? 2 : 0));
  next = mixNumber(next, card.damage);
  next = mixNumber(next, card.progress);
  next = mixNumber(next, card.resources);
  next = mixString(next, card.host ?? "");
  return mixNumber(next, card.controller == null ? 0xff : card.controller);
}

export function tableDigest(state: ScenarioState): number {
  let hash = BASIS;
  const { cards } = state;
  for (const id of Object.keys(cards).sort()) hash = mixCard(hash, cards[id]!);
  for (const seat of state.seats) hash = mixNumber(hash, seat.threat);
  hash = mixString(hash, state.phase);
  hash = mixNumber(hash, state.round);
  hash = mixString(hash, state.questStage ?? "");
  const { window } = state;
  if (window) {
    hash = mixString(hash, window.kind);
    hash = mixNumber(hash, "seat" in window && window.seat != null ? window.seat : 0xff);
  } else {
    hash = mixNumber(hash, 0xfe);
  }
  return hash;
}
