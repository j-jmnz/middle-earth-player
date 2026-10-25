import { useSyncExternalStore } from "react";

import { copyCapRule } from "../catalog/deck-save";
import { showToast } from "./toast";

export type DraftCard = {
  code: string;
  count: number;
};

/** What a deck holds: the part Save writes and Undo puts back. */
export type DraftContent = {
  name: string;
  heroes: string[];
  cards: DraftCard[];
};

export type DeckDraft = DraftContent & {
  // The saved deck's id, or "new" for a deck that is not in user.db yet.
  id: string;
  // The deck as user.db has it, to tell an unsaved change. Null for a new deck.
  saved: DraftContent | null;
  /** Dropped-card sentence from an import, or a pre-built deck's note. Null otherwise. */
  droppedNote: string | null;
};

export type DraftAdd = {
  code: string;
  name: string;
  typeCode: string;
  deckLimit: number | null;
};

/**
 * What one tap did, in the sentence the screen shows. A change carries the deck as it was, for Undo; a refusal names the
 * card and the rule and changes nothing.
 */
export type DraftChange = { ok: true; text: string; before: DraftContent } | { ok: false; text: string };

export const NEW_DECK_ID = "new";

function content(from: DraftContent): DraftContent {
  return { name: from.name, heroes: [...from.heroes], cards: from.cards.map((card) => ({ code: card.code, count: card.count })) };
}

function blankDraft(): DeckDraft {
  return { id: NEW_DECK_ID, name: "", heroes: [], cards: [], saved: null, droppedNote: null };
}

let draft: DeckDraft = blankDraft();
const listeners = new Set<() => void>();

function update(next: DeckDraft): void {
  draft = next;
  for (const listener of listeners) listener();
}

export function subscribeDeckDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDeckDraft(): DeckDraft {
  return draft;
}

export function useDeckDraft(): DeckDraft {
  return useSyncExternalStore(subscribeDeckDraft, getDeckDraft, getDeckDraft);
}

/** Opens a saved deck for editing. */
export function editSavedDeck(deck: { id: string } & DraftContent, droppedNote: string | null = null): void {
  update({ id: deck.id, ...content(deck), saved: content(deck), droppedNote });
}

/** Opens a deck that is not saved yet: an empty one under `name`, or an imported or pre-built list. */
export function startNewDeck(start: Partial<DraftContent> & { droppedNote?: string | null } = {}): void {
  update({ ...blankDraft(), ...content({ name: start.name ?? "", heroes: start.heroes ?? [], cards: start.cards ?? [] }), droppedNote: start.droppedNote ?? null });
}

/** Marks the draft as the deck user.db now holds under `id`. */
export function markDraftSaved(id: string, name: string): void {
  const next = { ...content(draft), name };
  update({ ...draft, ...next, id, saved: content(next) });
}

function sameContent(left: DraftContent, right: DraftContent): boolean {
  if (left.name.trim() !== right.name.trim()) return false;
  if (left.heroes.join("\0") !== right.heroes.join("\0")) return false;
  if (left.cards.length !== right.cards.length) return false;
  return left.cards.every((card, at) => card.code === right.cards[at]?.code && card.count === right.cards[at]?.count);
}

/** Whether leaving would lose something: a change to a saved deck, or a new deck with a hero or a card in it. */
export function draftIsDirty(current: DeckDraft): boolean {
  if (!current.saved) return current.heroes.length > 0 || current.cards.length > 0;
  return !sameContent(current, current.saved);
}

/** Undo: puts the heroes, cards and name back as they were before a change. */
export function restoreDraft(before: DraftContent): void {
  update({ ...draft, ...content(before) });
}

/** Leaves the saved deck as user.db has it (Discard). */
export function discardDraftChanges(): void {
  update(draft.saved ? { ...draft, ...content(draft.saved) } : blankDraft());
}

export function setDeckName(name: string): void {
  update({ ...draft, name });
}

export function draftCopyCount(current: DraftContent, code: string, typeCode: string): number {
  if (typeCode === "hero") return current.heroes.includes(code) ? 1 : 0;
  return current.cards.reduce((sum, card) => sum + (card.code === code ? card.count : 0), 0);
}

// "Gandalf: At most three copies."
function refused(name: string, rule: string): DraftChange {
  return { ok: false, text: `${name}: ${rule}` };
}

// "2 of 3": the copies now in the deck against the most the card allows.
function copiesLine(count: number, deckLimit: number | null): string {
  const most = deckLimit != null && deckLimit < 3 ? deckLimit : 3;
  return `${count} of ${most}`;
}

export function removeDraftHero(code: string, name: string = code): DraftChange {
  if (!draft.heroes.includes(code)) return refused(name, "Not a hero in this deck.");
  const before = content(draft);
  update({ ...draft, heroes: draft.heroes.filter((hero) => hero !== code) });
  return { ok: true, text: `Removed ${name}`, before };
}

/** One copy more or one fewer. A copy past the copy limit (rr.deckbuilding) is refused and not added. */
export function changeDraftCount(code: string, name: string, deckLimit: number | null, delta: -1 | 1): DraftChange {
  const current = draft.cards.find((card) => card.code === code);
  const count = current?.count ?? 0;
  const before = content(draft);
  if (delta < 0) {
    if (!current) return refused(name, "Not in this deck.");
    const cards = count <= 1 ? draft.cards.filter((card) => card.code !== code) : draft.cards.map((card) => (
      card.code === code ? { code, count: count - 1 } : card
    ));
    update({ ...draft, cards });
    return { ok: true, text: count <= 1 ? `Removed ${name}` : `Removed a copy of ${name} · ${copiesLine(count - 1, deckLimit)}`, before };
  }
  const rule = copyCapRule(count + 1, deckLimit);
  if (rule) return refused(name, rule);
  const cards = current
    ? draft.cards.map((card) => (card.code === code ? { code, count: count + 1 } : card))
    : [...draft.cards, { code, count: 1 }];
  update({ ...draft, cards });
  return { ok: true, text: `Added ${name} · ${copiesLine(count + 1, deckLimit)}`, before };
}

/** A hero joins the hero slots (one to three, rr.deckbuilding); any other card is one more copy. */
export function addDraftCard(card: DraftAdd): DraftChange {
  if (card.typeCode === "hero") {
    if (draft.heroes.includes(card.code)) return refused(card.name, "A hero appears once.");
    if (draft.heroes.length >= 3) return refused(card.name, "At most three heroes.");
    const before = content(draft);
    update({ ...draft, heroes: [...draft.heroes, card.code] });
    return { ok: true, text: `Added ${card.name} · hero ${draft.heroes.length} of 3`, before };
  }
  return changeDraftCount(card.code, card.name, card.deckLimit, 1);
}

/** Says what a tap did at the foot of the screen, with Undo for a change. A refusal is a danger sentence. */
export function announceDraftChange(change: DraftChange): void {
  if (change.ok) showToast(change.text, { undo: () => restoreDraft(change.before) });
  else showToast(change.text, { tone: "danger" });
}

/** One fewer: a hero leaves the slots, any other card loses a copy. */
export function takeDraftCard(card: DraftAdd): DraftChange {
  if (card.typeCode === "hero") return removeDraftHero(card.code, card.name);
  return changeDraftCount(card.code, card.name, card.deckLimit, -1);
}
