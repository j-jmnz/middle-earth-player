// Rules: rr.attachment-cards (data/rules/entries.json); ledger lines 132036:A:1, 132036:A:2.
// AttachSelf to a character an event or an attack names, with nobody asked: Dark Bats attaches to the character it damaged (Forced) or to the defending character (Shadow).
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import { attachBlocked } from "../../interpret/restrictions.ts";
import { printedOf } from "../../core/printed.ts";
import { topFrame } from "../../windows/windows.ts";

/** The character an `AttachSelf` to `subject` (the character the answered event is about) or `defender` (the defending character of the attack in progress) names, or null: a card that is no hero or ally in play, an undefended attack, a character that cannot have the card. */
export function eventCharacterHost(state: ScenarioState, kind: "subject" | "defender", sourceId: string | null, ctx: ReduceContext): string | null {
  const data = topFrame(state)?.data;
  const attack = state.pendingAttack;
  const hostId = kind === "defender" ? (attack && !attack.undefended ? attack.defenderId : undefined) : data?.kind === "effect" ? data.subject : undefined;
  const host = hostId ? state.cards[hostId] : undefined;
  const code = sourceId ? state.cards[sourceId]?.code : undefined;
  if (!host || code == null || (host.zone !== "heroes" && host.zone !== "play")) return null;
  const type = printedOf(ctx.cards, host.code).type;
  return (type === "hero" || type === "ally") && !attachBlocked(state, ctx, host.id, code) ? host.id : null;
}

/** The Shadow card's inline attach (the effect frame's other AttachSelf asks through `eventCharacterHost`). */
export function attachToEventCharacter(state: ScenarioState, kind: "subject" | "defender", focus: Focus, ctx: ReduceContext): ScenarioState {
  const host = eventCharacterHost(state, kind, focus.sourceId, ctx);
  return host && focus.sourceId ? attachSelf(state, focus.sourceId, host, ctx) : state;
}
