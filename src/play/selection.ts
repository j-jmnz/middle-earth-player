// Rules: rr.planning-phase, rr.step-3-1, rr.travel, rr.optional-engagement (data/rules/entries.json).
//
// What a dragged card can do. The table never builds every card against every target: it lists which cards can be picked up
// in this window (from legalIntents, computed once per window), and when the player lifts one it asks legalTargets for that
// card only. A drop names a zone id or a card id that list returned; the card moves only when the reducer accepts the
// intent the drop maps to.
import { printedOf } from "../rules/printed.ts";
import { legalTargets, type LegalIntent, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";

import type { DropRect, TableLayout } from "./layout.ts";
import { playRequest, type PayRequest } from "./pay.ts";
import { TABLE_ZONES, type ZoneId } from "./selectors.ts";

export type DropTarget = { kind: "zone"; zone: ZoneId } | { kind: "card"; cardId: string };

export type DropOutcome =
  // Send this intent to the reducer.
  | { kind: "intent"; intent: PlayerIntent }
  // The card needs resources named first: open the pay sheet, then send PlayCard with the payments.
  | { kind: "pay"; request: PayRequest; hostId: string | null }
  // Add or remove the character from the commit the player is building.
  | { kind: "commit"; cardId: string }
  | { kind: "none" };

function has(legal: readonly LegalIntent[], type: LegalIntent["type"]): boolean {
  return legal.some((intent) => intent.type === type);
}

function playable(legal: readonly LegalIntent[], cardId: string): boolean {
  return legal.some((intent) => intent.type === "PlayCard" && intent.cardId === cardId);
}

/** The cards the player can pick up in this window. Computed once per window, not per pixel. */
export function draggableIds(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[]): readonly string[] {
  const ids = new Set<string>();
  for (const intent of legal) if (intent.type === "PlayCard") ids.add(intent.cardId);
  if (game.mode === "questCommit" && has(legal, "Commit")) for (const id of legalTargets(game, { type: "Commit" }, ctx)) ids.add(id);
  if (has(legal, "Travel")) for (const id of legalTargets(game, { type: "Travel" }, ctx)) ids.add(id);
  if (game.window?.kind === "optionalEngage" && has(legal, "Engage")) for (const id of legalTargets(game, { type: "Engage" }, ctx)) ids.add(id);
  return [...ids];
}

/** Where the selected card may be dropped. Asks the reducer's legalTargets for that one card. */
export function dropTargets(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], cardId: string): readonly DropTarget[] {
  const instance = game.cards[cardId];
  if (!instance) return [];
  if (playable(legal, cardId)) {
    const printed = printedOf(ctx.cards, instance.code);
    if (printed.type === "attachment") return legalTargets(game, { type: "PlayCard", cardId }, ctx).map((id) => ({ kind: "card", cardId: id }));
    return [{ kind: "zone", zone: "play" }];
  }
  if (game.mode === "questCommit" && has(legal, "Commit") && legalTargets(game, { type: "Commit" }, ctx).includes(cardId)) return [{ kind: "zone", zone: "questStage" }];
  if (has(legal, "Travel") && legalTargets(game, { type: "Travel" }, ctx).includes(cardId)) return [{ kind: "zone", zone: "activeLocation" }];
  if (game.window?.kind === "optionalEngage" && legalTargets(game, { type: "Engage" }, ctx).includes(cardId)) return [{ kind: "zone", zone: "engaged" }];
  return [];
}

function sameTarget(a: DropTarget, b: DropTarget): boolean {
  return a.kind === "zone" ? b.kind === "zone" && a.zone === b.zone : b.kind === "card" && a.cardId === b.cardId;
}

/** What a drop does. A drop on anything the targets did not list does nothing. */
export function dropOutcome(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], cardId: string, target: DropTarget | null): DropOutcome {
  if (!target) return { kind: "none" };
  const targets = dropTargets(game, ctx, legal, cardId);
  if (!targets.some((candidate) => sameTarget(candidate, target))) return { kind: "none" };
  if (playable(legal, cardId)) {
    const hostId = target.kind === "card" ? target.cardId : null;
    const request = playRequest(game, ctx, cardId);
    if (request) return { kind: "pay", request, hostId };
    return { kind: "intent", intent: hostId ? { type: "PlayCard", cardId, payments: [], hostId } : { type: "PlayCard", cardId, payments: [] } };
  }
  if (target.kind === "zone" && target.zone === "questStage") return { kind: "commit", cardId };
  if (target.kind === "zone" && target.zone === "activeLocation") return { kind: "intent", intent: { type: "Travel", locationId: cardId } };
  if (target.kind === "zone" && target.zone === "engaged") return { kind: "intent", intent: { type: "Engage", enemyId: cardId } };
  return { kind: "none" };
}

/** Adds or removes a character from the commit being built. Only characters the reducer lists can be in it. */
export function toggleCommit(game: ScenarioState, ctx: ReduceContext, pending: readonly string[], cardId: string): readonly string[] {
  if (pending.includes(cardId)) return pending.filter((id) => id !== cardId);
  const legal = legalTargets(game, { type: "Commit" }, ctx);
  return legal.includes(cardId) ? [...pending, cardId] : pending;
}

/** A drop target as one string, so a worklet can carry it: "zone:<id>" or "card:<instance id>". */
export function targetKey(target: DropTarget): string {
  return target.kind === "zone" ? `zone:${target.zone}` : `card:${target.cardId}`;
}

export function targetFromKey(key: string): DropTarget | null {
  if (key.startsWith("zone:")) {
    const zone = key.slice(5);
    return TABLE_ZONES.includes(zone as ZoneId) ? { kind: "zone", zone: zone as ZoneId } : null;
  }
  if (key.startsWith("card:")) return { kind: "card", cardId: key.slice(5) };
  return null;
}

/** The rectangles of the selected card's drop targets: cards first (an attachment's host), then zones. */
export function dropRects(layout: TableLayout, targets: readonly DropTarget[]): DropRect[] {
  const cards: DropRect[] = [];
  const zones: DropRect[] = [];
  for (const target of targets) {
    if (target.kind === "card") {
      const slot = layout.slots.find((candidate) => candidate.id === target.cardId && candidate.kind === "card");
      if (slot) cards.push({ x: slot.x, y: slot.y, w: slot.w, h: slot.h, target: targetKey(target) });
    } else {
      const rect = layout.zones[target.zone];
      if (rect.w > 0 && rect.h > 0) zones.push({ ...rect, target: targetKey(target) });
    }
  }
  return [...cards, ...zones];
}
