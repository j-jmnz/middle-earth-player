import { useSyncExternalStore } from "react";

import { copyCapRule, formatDeckRefusal } from "../../catalog/deck-save";
import { showToast } from "../kit/toast";

export type DraftCard = {
  code: string;
  count: number;
};

/** What a deck holds: the part Save writes and Undo puts back. */
export type DraftContent = {
  name: string;
  heroes: string[];
  cards: DraftCard[];
  // The side deck: cards kept with the deck but not in it (store.ts, SavedDeck).
  side: DraftCard[];
};

/** Which pile the pool's − and + change: the deck, or its side deck. */
export type DraftPile = "deck" | "side";

export type DeckDraft = DraftContent & {
  // The saved deck's id, or "new" for a deck that is not in user.db yet.
  id: string;
  // The deck as user.db has it, to tell an unsaved change. Null for a new deck.
  saved: DraftContent | null;
  /** Dropped-card sentence from an import, or a pre-built deck's note. Null otherwise. */
  droppedNote: string | null;
  // The pile the pool adds to: the editor sets it when it opens the pool (Add on the side deck's heading opens it on "side").
  target: DraftPile;
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
export type DraftChange = { ok: true; text: string; before: DraftPicks } | { ok: false; text: string };

/** The heroes, cards and side deck: what a tap changes and Undo puts back. A name typed since stays. */
export type DraftPicks = Pick<DraftContent, "heroes" | "cards" | "side">;

function copyCards(cards: readonly DraftCard[]): DraftCard[] {
  return cards.map((card) => ({ code: card.code, count: card.count }));
}

function picks(from: DraftPicks): DraftPicks {
  return { heroes: [...from.heroes], cards: copyCards(from.cards), side: copyCards(from.side) };
}

export const NEW_DECK_ID = "new";

function content(from: Omit<DraftContent, "side"> & { side?: readonly DraftCard[] }): DraftContent {
  return { name: from.name, heroes: [...from.heroes], cards: copyCards(from.cards), side: copyCards(from.side ?? []) };
}

function blankDraft(): DeckDraft {
  return { id: NEW_DECK_ID, name: "", heroes: [], cards: [], side: [], saved: null, droppedNote: null, target: "deck" };
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

// The whole draft, or what `select` takes from it. The selector must return a value that stays the same while that part does not
// change (the `heroes` or `cards` array, the name), so a screen that reads only the cards is not rendered for each key of the name:
// a change replaces only the parts it touches (setDeckName keeps both arrays).
export function useDeckDraft(): DeckDraft;
export function useDeckDraft<T>(select: (draft: DeckDraft) => T): T;
export function useDeckDraft<T>(select?: (draft: DeckDraft) => T): T | DeckDraft {
  return useSyncExternalStore(
    subscribeDeckDraft,
    () => (select ? select(draft) : draft),
    () => (select ? select(draft) : draft),
  );
}

/** Opens a saved deck for editing. */
export function editSavedDeck(deck: { id: string } & Omit<DraftContent, "side"> & { side?: readonly DraftCard[] }, droppedNote: string | null = null): void {
  update({ id: deck.id, ...content(deck), saved: content(deck), droppedNote, target: "deck" });
}

/** Opens a deck that is not saved yet: an empty one under `name`, or an imported or pre-built list. */
export function startNewDeck(start: Partial<DraftContent> & { droppedNote?: string | null } = {}): void {
  update({ ...blankDraft(), ...content({ name: start.name ?? "", heroes: start.heroes ?? [], cards: start.cards ?? [], side: start.side ?? [] }), droppedNote: start.droppedNote ?? null });
}

/** Marks the draft as the deck user.db now holds under `id`. */
export function markDraftSaved(id: string, name: string): void {
  const next = { ...content(draft), name };
  update({ ...draft, ...next, id, saved: content(next) });
}

// The same counts by code. The order cards were added in does not matter.
function sameCards(left: readonly DraftCard[], right: readonly DraftCard[]): boolean {
  if (left.length !== right.length) return false;
  const counts = new Map(right.map((card) => [card.code, card.count]));
  return left.every((card) => counts.get(card.code) === card.count);
}

// The same deck: name, heroes, counts and side deck.
function sameContent(left: DraftContent, right: DraftContent): boolean {
  if (left.name.trim() !== right.name.trim()) return false;
  if (left.heroes.join("\0") !== right.heroes.join("\0")) return false;
  return sameCards(left.cards, right.cards) && sameCards(left.side, right.side);
}

/** Whether leaving would lose something: a change to a saved deck, or a new deck with a hero or a card in it. */
export function draftIsDirty(current: DeckDraft): boolean {
  if (!current.saved) return current.heroes.length > 0 || current.cards.length > 0 || current.side.length > 0;
  return !sameContent(current, current.saved);
}

/** Points the pool's − and + at the deck or at its side deck. */
export function setDraftTarget(target: DraftPile): void {
  if (draft.target !== target) update({ ...draft, target });
}

/** Undo: puts the heroes and cards back as they were before a change. */
export function restoreDraft(before: DraftPicks): void {
  update({ ...draft, ...picks(before) });
}

/** Leaves the saved deck as user.db has it (Discard). */
export function discardDraftChanges(): void {
  update(draft.saved ? { ...draft, ...content(draft.saved) } : blankDraft());
}

export function setDeckName(name: string): void {
  update({ ...draft, name });
}

/** What the pool's − and + change while `target` is chosen: the heroes and cards, or the side deck's cards (no heroes). */
export function targetPicks(current: Pick<DraftContent, "heroes" | "cards" | "side">, target: DraftPile): Pick<DraftPicks, "heroes" | "cards"> {
  return target === "side" ? { heroes: [], cards: current.side } : { heroes: current.heroes, cards: current.cards };
}

export function draftCopyCount(current: Pick<DraftPicks, "heroes" | "cards">, code: string, typeCode: string): number {
  if (typeCode === "hero") return current.heroes.includes(code) ? 1 : 0;
  return current.cards.reduce((sum, card) => sum + (card.code === code ? card.count : 0), 0);
}

// "Gandalf: At most three copies."
function refused(name: string, rule: string): DraftChange {
  return { ok: false, text: formatDeckRefusal({ cardName: name, rule }) };
}

/** A card's title and deck limit, for the other printings in a deck. The screens pass what the catalog says. */
export type CardTitle = { name: string; deckLimit: number | null };
export type TitleLookup = (code: string) => CardTitle | undefined;

/**
 * Copies of a title across its printings, and the lowest deck limit among them: rr.deckbuilding counts by title, as
 * deckSaveRefusal does. `card` is the printing being changed; the lookup names the deck's other codes.
 */
export function titleCopies(current: Pick<DraftPicks, "cards">, card: { code: string; name: string; deckLimit: number | null }, lookup?: TitleLookup): { count: number; deckLimit: number | null } {
  let count = 0;
  let deckLimit = card.deckLimit;
  for (const held of current.cards) {
    const title = held.code === card.code ? card : lookup?.(held.code);
    if (!title || title.name !== card.name) continue;
    count += held.count;
    if (title.deckLimit != null) deckLimit = deckLimit == null ? title.deckLimit : Math.min(deckLimit, title.deckLimit);
  }
  return { count, deckLimit };
}

/** The hero in the deck with this hero's title (any printing), or null. A title appears once among the heroes. */
export function heroWithTitle(current: Pick<DraftPicks, "heroes">, card: { code: string; name: string }, lookup?: TitleLookup): string | null {
  return current.heroes.find((code) => code === card.code || lookup?.(code)?.name === card.name) ?? null;
}

// A side deck holds no hero and no contract: those have their own places in the deck.
function sideRefusal(typeCode: string): string | null {
  if (typeCode === "hero") return "A hero is not a side deck card.";
  if (typeCode === "contract") return "A contract is not a side deck card.";
  return null;
}

/**
 * Whether + on this card would be refused: its title is at its copy limit, or a hero is taken or the slots are full. On the side
 * deck (`target`), the copies are the side deck's and a hero or a contract is refused.
 */
export function draftAddRefused(current: Pick<DraftPicks, "heroes" | "cards">, card: DraftAdd, lookup?: TitleLookup, target: DraftPile = "deck"): boolean {
  if (target === "side" && sideRefusal(card.typeCode)) return true;
  if (card.typeCode === "hero") return heroWithTitle(current, card, lookup) !== null || current.heroes.length >= 3;
  const title = titleCopies(current, card, lookup);
  return copyCapRule(title.count + 1, title.deckLimit) !== null;
}

// "2 of 3": the copies of the title now in the deck against the most the card allows.
function copiesLine(count: number, deckLimit: number | null): string {
  const most = deckLimit != null && deckLimit < 3 ? deckLimit : 3;
  return `${count} of ${most}`;
}

export function removeDraftHero(code: string, name: string = code): DraftChange {
  if (!draft.heroes.includes(code)) return refused(name, "Not a hero in this deck.");
  const before = picks(draft);
  update({ ...draft, heroes: draft.heroes.filter((hero) => hero !== code) });
  return { ok: true, text: `Removed ${name}`, before };
}

/**
 * One copy more or one fewer, in the deck or its side deck (`pile`). A copy past the title's copy limit (rr.deckbuilding) is refused
 * and not added; the side deck's copies are counted on their own.
 */
export function changeDraftCount(code: string, name: string, deckLimit: number | null, delta: -1 | 1, lookup?: TitleLookup, pile: DraftPile = "deck"): DraftChange {
  const held = pile === "side" ? draft.side : draft.cards;
  const current = held.find((card) => card.code === code);
  const count = current?.count ?? 0;
  const before = picks(draft);
  const title = titleCopies({ cards: held }, { code, name, deckLimit }, lookup);
  const where = pile === "side" ? " in the side deck" : "";
  if (delta < 0) {
    if (!current) return refused(name, pile === "side" ? "Not in the side deck." : "Not in this deck.");
    const next = count <= 1 ? held.filter((card) => card.code !== code) : held.map((card) => (
      card.code === code ? { code, count: count - 1 } : card
    ));
    update(pile === "side" ? { ...draft, side: next } : { ...draft, cards: next });
    const left = title.count - 1;
    return { ok: true, text: left === 0 ? `Removed ${name}${pile === "side" ? " from the side deck" : ""}` : `Removed a copy of ${name}${where} · ${copiesLine(left, title.deckLimit)}`, before };
  }
  const rule = copyCapRule(title.count + 1, title.deckLimit);
  if (rule) return refused(name, rule);
  const next = current
    ? held.map((card) => (card.code === code ? { code, count: count + 1 } : card))
    : [...held, { code, count: 1 }];
  update(pile === "side" ? { ...draft, side: next } : { ...draft, cards: next });
  return { ok: true, text: `Added ${name}${pile === "side" ? " to the side deck" : ""} · ${copiesLine(title.count + 1, title.deckLimit)}`, before };
}

/**
 * A hero joins the hero slots (one to three, one of each title, rr.deckbuilding); any other card is one more copy. While the pool adds
 * to the side deck (`target`), the card is a copy there, and a hero or a contract is refused.
 */
export function addDraftCard(card: DraftAdd, lookup?: TitleLookup): DraftChange {
  if (draft.target === "side") {
    const rule = sideRefusal(card.typeCode);
    return rule ? refused(card.name, rule) : changeDraftCount(card.code, card.name, card.deckLimit, 1, lookup, "side");
  }
  if (card.typeCode === "hero") {
    if (heroWithTitle(draft, card, lookup)) return refused(card.name, "A hero appears once.");
    if (draft.heroes.length >= 3) return refused(card.name, "At most three heroes.");
    const before = picks(draft);
    update({ ...draft, heroes: [...draft.heroes, card.code] });
    return { ok: true, text: `Added ${card.name} · hero ${draft.heroes.length} of 3`, before };
  }
  return changeDraftCount(card.code, card.name, card.deckLimit, 1, lookup);
}

/** Says what a tap did at the foot of the screen, with Undo for a change. A refusal is a danger sentence. */
export function announceDraftChange(change: DraftChange): void {
  if (change.ok) showToast(change.text, { undo: () => restoreDraft(change.before) });
  else showToast(change.text, { tone: "danger" });
}

/** One fewer: a hero leaves the slots, any other card loses a copy (from the side deck while the pool adds there). */
export function takeDraftCard(card: DraftAdd, lookup?: TitleLookup): DraftChange {
  if (draft.target === "side") return changeDraftCount(card.code, card.name, card.deckLimit, -1, lookup, "side");
  if (card.typeCode === "hero") return removeDraftHero(card.code, card.name);
  return changeDraftCount(card.code, card.name, card.deckLimit, -1, lookup);
}
