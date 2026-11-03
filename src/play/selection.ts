// Rules: rr.planning-phase, rr.step-3-1, rr.travel, rr.optional-engagement (data/rules/entries.json).
//
// What a dragged card can do. The table never builds every card against every target: it lists which cards can be picked up
// in this window (from legalIntents, computed once per window), and when the player lifts one it asks legalTargets for that
// card only. A drop names a zone id or a card id that list returned. A drop is a pick, like a tap: it never sends an intent.
// The dock asks to confirm what it picked (table-choice.ts), and the card moves only when the reducer accepts that.
import { askingToCommit } from "../rules/families/sea/sailing-legal.ts";
import { printedOf } from "../rules/core/printed.ts";
import { legalTargets, type LegalIntent, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";

import type { DropRect, TableLayout } from "./layout.ts";
import { TABLE_ZONES, type ZoneId } from "./selectors.ts";

export type DropTarget = { kind: "zone"; zone: ZoneId } | { kind: "card"; cardId: string };

export type DropOutcome =
  // Play this card (on this host): the dock asks for the payment, or to confirm a free card.
  | { kind: "play"; cardId: string; hostId: string | null }
  // Add or remove the character from the commit the player is building.
  | { kind: "commit"; cardId: string }
  // Pick this card in the open sheet: the location to travel to, the enemy to engage.
  | { kind: "choose"; cardId: string }
  | { kind: "none" };

function has(legal: readonly LegalIntent[], type: LegalIntent["type"]): boolean {
  return legal.some((intent) => intent.type === type);
}

function playable(legal: readonly LegalIntent[], cardId: string): boolean {
  return legal.some((intent) => intent.type === "PlayCard" && intent.cardId === cardId);
}

// A character is dragged onto the quest to commit it, except while the first player is asked what to commit to a Sailing test: that Commit is the test's, picked on the table, not the quest's.
function questCommitDrag(game: ScenarioState, legal: readonly LegalIntent[]): boolean {
  return game.mode === "questCommit" && has(legal, "Commit") && !askingToCommit(game);
}

/** The cards the player can pick up in this window. Computed once per window, not per pixel. */
export function draggableIds(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[]): readonly string[] {
  const ids = new Set<string>();
  for (const intent of legal) if (intent.type === "PlayCard") ids.add(intent.cardId);
  if (questCommitDrag(game, legal)) for (const id of legalTargets(game, { type: "Commit" }, ctx)) ids.add(id);
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
    // A Trap or a Guarded card is played into the staging area: the zone is its target (src/rules/families/attachments/play.ts).
    if (printed.type === "attachment") return legalTargets(game, { type: "PlayCard", cardId }, ctx).map((id): DropTarget => (id === "staging" ? { kind: "zone", zone: "staging" } : { kind: "card", cardId: id }));
    return [{ kind: "zone", zone: "play" }];
  }
  if (questCommitDrag(game, legal) && legalTargets(game, { type: "Commit" }, ctx).includes(cardId)) return [{ kind: "zone", zone: "questStage" }];
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
  if (playable(legal, cardId)) return { kind: "play", cardId, hostId: target.kind === "card" ? target.cardId : target.zone === "staging" ? "staging" : null };
  if (target.kind === "zone" && target.zone === "questStage") return { kind: "commit", cardId };
  if (target.kind === "zone" && (target.zone === "activeLocation" || target.zone === "engaged")) return { kind: "choose", cardId };
  return { kind: "none" };
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
