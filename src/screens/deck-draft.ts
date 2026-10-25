import { useSyncExternalStore } from "react";

import { copyCapRule, type DeckSaveRefusal } from "../catalog/deck-save";

export type DraftCard = {
  code: string;
  count: number;
};

export type DeckDraft = {
  id: string;
  name: string;
  heroes: string[];
  cards: DraftCard[];
  heldRefusal: DeckSaveRefusal | null;
  /** Dropped-card sentence from an import. Null on a deck that was not imported. */
  droppedNote: string | null;
};

export type DraftAdd = {
  code: string;
  name: string;
  typeCode: string;
  deckLimit: number | null;
};

// Hermes has no global `crypto`, so a saved deck's id is the time and a random tail rather than `crypto.randomUUID()`.
// The `deck-` prefix keeps it apart from a starter deck's slug.
export function newDeckId(now: number = Date.now(), random: () => number = Math.random): string {
  return `deck-${now.toString(36)}-${Math.floor(random() * 36 ** 8).toString(36).padStart(8, "0")}`;
}

function blankDraft(id: string): DeckDraft {
  return { id, name: "", heroes: [], cards: [], heldRefusal: null, droppedNote: null };
}

let draft: DeckDraft = blankDraft("new");
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function update(next: DeckDraft): void {
  draft = next;
  emit();
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

export function replaceDeckDraft(next: DeckDraft): void {
  update(next);
}

export function useDeckDraft(): DeckDraft {
  return useSyncExternalStore(subscribeDeckDraft, getDeckDraft, getDeckDraft);
}

export function setDeckName(name: string): void {
  update({ ...draft, name, heldRefusal: null });
}

export function removeDraftHero(code: string): void {
  update({ ...draft, heroes: draft.heroes.filter((hero) => hero !== code), heldRefusal: null });
}

export function changeDraftCount(code: string, name: string, deckLimit: number | null, delta: -1 | 1): void {
  const current = draft.cards.find((card) => card.code === code);
  const count = current?.count ?? 0;
  if (delta < 0) {
    if (!current) return;
    const cards = count <= 1 ? draft.cards.filter((card) => card.code !== code) : draft.cards.map((card) => (
      card.code === code ? { code, count: count - 1 } : card
    ));
    update({ ...draft, cards, heldRefusal: null });
    return;
  }
  const rule = copyCapRule(count + 1, deckLimit);
  if (rule) {
    update({ ...draft, heldRefusal: { cardCode: code, cardName: name, rule } });
    return;
  }
  const cards = current
    ? draft.cards.map((card) => (card.code === code ? { code, count: count + 1 } : card))
    : [...draft.cards, { code, count: 1 }];
  update({ ...draft, cards, heldRefusal: null });
}

export function draftCopyCount(current: DeckDraft, code: string, typeCode: string): number {
  if (typeCode === "hero") return current.heroes.includes(code) ? 1 : 0;
  return current.cards.reduce((sum, card) => sum + (card.code === code ? card.count : 0), 0);
}

export function addDraftCard(card: DraftAdd): void {
  if (card.typeCode === "hero") {
    if (draft.heroes.includes(card.code)) {
      update({
        ...draft,
        heldRefusal: { cardCode: card.code, cardName: card.name, rule: "A hero appears once." },
      });
      return;
    }
    if (draft.heroes.length >= 3) {
      update({
        ...draft,
        heldRefusal: { cardCode: card.code, cardName: card.name, rule: "At most three heroes." },
      });
      return;
    }
    update({ ...draft, heroes: [...draft.heroes, card.code], heldRefusal: null });
    return;
  }
  changeDraftCount(card.code, card.name, card.deckLimit, 1);
}

export function startNewDeck(): void {
  update(blankDraft("new"));
}
