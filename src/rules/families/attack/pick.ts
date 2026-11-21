// Rules: rr.ranged, rr.qualifiers, rr.discard-pile-and-victory-display (data/rules/entries.json).
//
// The Pick filters the attack family adds (effect-schema-pick.ts): `printedKeyword`, `engagedWith`, `sharesTrait`,
// `onSubject`, `minHitPoints` and `topOfDiscard`. The answered event's subject and other card come from the condition being
// read, else from the running effect.
import type { PickSpec } from "../../../catalog/boundary.ts";

import { hasTrait } from "../../interpret/conditions.ts";
import { traitsOf } from "../misc/traits.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";

// What the filter is read against: the chooser, the source, what the effect picked, and the answered event's cards.
export type AttackPickContext = { seat: number; sourceId: string | null; picked?: readonly string[]; subject?: string | null; other?: string | null };

// The player the effect picked last ("that player"): the latest "seat:N" among its picks.
function pickedSeat(picked: readonly string[]): number | null {
  const entry = [...picked].reverse().find((id) => id.startsWith("seat:"));
  return entry ? Number(entry.slice("seat:".length)) : null;
}

export function attackPickMatches(state: ScenarioState, id: string, spec: PickSpec, at: AttackPickContext, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  if (!instance) return false;
  const printed = printedOf(ctx.cards, instance.code);
  if (spec.printedKeyword && !printed.keywords[spec.printedKeyword]) return false;
  if (spec.minHitPoints != null && (printed.health ?? 0) < spec.minHitPoints) return false;
  if (spec.topOfDiscard && !state.seats.some((seat) => seat.discard.at(-1) === id)) return false;
  if (!spec.engagedWith && spec.sharesTrait !== "other" && !spec.onSubject && !spec.notOther) return true;
  const data = topFrame(state)?.data;
  const frame = data?.kind === "effect" ? data : undefined;
  if (spec.notOther && id === (at.other ?? frame?.other)) return false;
  if (spec.engagedWith === "picked") {
    const seat = pickedSeat(at.picked && at.picked.length > 0 ? at.picked : (frame?.picked ?? []));
    if (seat == null || instance.zone !== "engaged" || instance.controller !== seat) return false;
  }
  if (spec.engagedWith === "host") {
    const host = at.sourceId ? state.cards[state.cards[at.sourceId]?.host ?? ""] : undefined;
    if (host?.controller == null || instance.zone !== "engaged" || instance.controller !== host.controller) return false;
  }
  if (spec.engagedWith === "notYou") {
    const asking = spec.who === "firstPlayer" ? state.firstPlayer : at.seat;
    if (instance.zone === "engaged" && instance.controller === asking) return false;
  }
  if (spec.sharesTrait === "other") {
    const other = at.other ?? frame?.other;
    const traits = other ? traitsOf(state, other, ctx) : [];
    if (!other || other === id || !traits.some((trait) => hasTrait(state, id, trait, ctx))) return false;
  }
  if (spec.onSubject) {
    const subject = at.subject ?? frame?.subject;
    if (!subject || instance.host !== subject) return false;
  }
  return true;
}
