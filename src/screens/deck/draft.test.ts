import { beforeEach, describe, expect, it } from "vitest";

import {
  addDraftCard,
  announceDraftChange,
  changeDraftCount,
  discardDraftChanges,
  draftAddRefused,
  draftCopyCount,
  draftIsDirty,
  editSavedDeck,
  getDeckDraft,
  markDraftSaved,
  removeDraftHero,
  restoreDraft,
  setDeckName,
  setDraftTarget,
  startNewDeck,
  takeDraftCard,
} from "./draft.ts";
import { getToast } from "../kit/toast.ts";

const sam = { code: "141002", name: "Sam Gamgee", typeCode: "hero", deckLimit: 1 };
const gandalf = { code: "01073", name: "Gandalf", typeCode: "ally", deckLimit: 3 };

beforeEach(() => {
  startNewDeck();
});

describe("deck draft", () => {
  it("names a hero already in the deck and does not add a second copy", () => {
    expect(addDraftCard(sam)).toMatchObject({ ok: true, text: "Added Sam Gamgee · hero 1 of 3" });
    expect(addDraftCard(sam)).toEqual({ ok: false, text: "Sam Gamgee: A hero appears once." });
    const draft = getDeckDraft();
    expect(draft.heroes).toEqual(["141002"]);
    expect(draftCopyCount(draft, "141002", "hero")).toBe(1);
  });

  it("refuses a fourth hero and leaves the three", () => {
    for (const code of ["h1", "h2", "h3"]) addDraftCard({ code, name: code, typeCode: "hero", deckLimit: 1 });
    expect(addDraftCard({ code: "h4", name: "Aragorn", typeCode: "hero", deckLimit: 1 })).toEqual({ ok: false, text: "Aragorn: At most three heroes." });
    expect(getDeckDraft().heroes).toEqual(["h1", "h2", "h3"]);
  });

  it("counts copies and says how many of the limit the deck holds", () => {
    expect(addDraftCard(gandalf)).toMatchObject({ ok: true, text: "Added Gandalf · 1 of 3" });
    expect(addDraftCard(gandalf)).toMatchObject({ ok: true, text: "Added Gandalf · 2 of 3" });
    expect(draftCopyCount(getDeckDraft(), "01073", "ally")).toBe(2);
  });

  it("refuses a fourth copy without adding it, and a copy past a lower deck limit", () => {
    for (let n = 0; n < 3; n += 1) addDraftCard(gandalf);
    expect(addDraftCard(gandalf)).toEqual({ ok: false, text: "Gandalf: At most three copies." });
    expect(draftCopyCount(getDeckDraft(), "01073", "ally")).toBe(3);
    addDraftCard({ code: "x", name: "Steward", typeCode: "attachment", deckLimit: 1 });
    expect(addDraftCard({ code: "x", name: "Steward", typeCode: "attachment", deckLimit: 1 })).toEqual({ ok: false, text: "Steward: Deck limit is 1." });
  });

  it("takes out one copy at a time and drops the row at none", () => {
    addDraftCard(gandalf);
    addDraftCard(gandalf);
    expect(takeDraftCard(gandalf)).toMatchObject({ ok: true, text: "Removed a copy of Gandalf · 1 of 3" });
    expect(changeDraftCount("01073", "Gandalf", 3, -1)).toMatchObject({ ok: true, text: "Removed Gandalf" });
    expect(getDeckDraft().cards).toEqual([]);
    expect(takeDraftCard(gandalf)).toEqual({ ok: false, text: "Gandalf: Not in this deck." });
  });

  it("puts the deck back as it was before a change (Undo)", () => {
    addDraftCard(gandalf);
    const change = takeDraftCard(gandalf);
    expect(getDeckDraft().cards).toEqual([]);
    if (!change.ok) throw new Error("expected a change");
    restoreDraft(change.before);
    expect(getDeckDraft().cards).toEqual([{ code: "01073", count: 1 }]);
  });

  it("removes a hero and offers it back", () => {
    addDraftCard(sam);
    const change = removeDraftHero("141002", "Sam Gamgee");
    expect(change).toMatchObject({ ok: true, text: "Removed Sam Gamgee" });
    expect(getDeckDraft().heroes).toEqual([]);
    announceDraftChange(change);
    const toast = getToast();
    expect(toast?.text).toBe("Removed Sam Gamgee");
    toast?.undo?.();
    expect(getDeckDraft().heroes).toEqual(["141002"]);
  });

  it("shows a refusal as a danger toast with no Undo", () => {
    for (let n = 0; n < 3; n += 1) addDraftCard(gandalf);
    announceDraftChange(addDraftCard(gandalf));
    expect(getToast()).toMatchObject({ text: "Gandalf: At most three copies.", tone: "danger", undo: null });
  });

  it("keeps a fourth hero from an import until that hero is removed", () => {
    startNewDeck({ name: "Imported", heroes: ["h0", "h1", "h2", "h3"], droppedNote: "Dropped Elrond." });
    expect(getDeckDraft().heroes).toEqual(["h0", "h1", "h2", "h3"]);
    expect(getDeckDraft().droppedNote).toBe("Dropped Elrond.");
    removeDraftHero("h3");
    expect(getDeckDraft().heroes).toEqual(["h0", "h1", "h2"]);
  });
});

describe("unsaved changes", () => {
  it("a new deck is dirty once it holds a hero or a card, not for its name alone", () => {
    startNewDeck({ name: "New deck" });
    expect(draftIsDirty(getDeckDraft())).toBe(false);
    setDeckName("Hobbits");
    expect(draftIsDirty(getDeckDraft())).toBe(false);
    addDraftCard(sam);
    expect(draftIsDirty(getDeckDraft())).toBe(true);
  });

  it("a saved deck is dirty after a change and clean once it is back as saved", () => {
    editSavedDeck({ id: "deck-a", name: "Hobbits", heroes: ["141002"], cards: [{ code: "01073", count: 1 }] });
    expect(draftIsDirty(getDeckDraft())).toBe(false);
    const change = addDraftCard(gandalf);
    expect(draftIsDirty(getDeckDraft())).toBe(true);
    if (change.ok) restoreDraft(change.before);
    expect(draftIsDirty(getDeckDraft())).toBe(false);
    setDeckName("Hobbits ");
    expect(draftIsDirty(getDeckDraft())).toBe(false);
    setDeckName("Halflings");
    expect(draftIsDirty(getDeckDraft())).toBe(true);
  });

  it("Save makes the draft the saved deck under its new id", () => {
    addDraftCard(sam);
    markDraftSaved("deck-b", "New deck");
    const draft = getDeckDraft();
    expect(draft.id).toBe("deck-b");
    expect(draft.name).toBe("New deck");
    expect(draftIsDirty(draft)).toBe(false);
  });

  it("Discard puts a saved deck back and empties a new one", () => {
    editSavedDeck({ id: "deck-a", name: "Hobbits", heroes: ["141002"], cards: [] });
    addDraftCard(gandalf);
    discardDraftChanges();
    expect(getDeckDraft()).toMatchObject({ id: "deck-a", heroes: ["141002"], cards: [] });
    startNewDeck();
    addDraftCard(gandalf);
    discardDraftChanges();
    expect(getDeckDraft()).toMatchObject({ id: "new", heroes: [], cards: [] });
  });
});

describe("copies by title", () => {
  const titles = new Map([
    ["141001", { name: "Frodo Baggins", deckLimit: 1 }],
    ["01001", { name: "Frodo Baggins", deckLimit: 1 }],
    ["01073", { name: "Gandalf", deckLimit: 3 }],
    ["02073", { name: "Gandalf", deckLimit: 3 }],
  ]);
  const lookup = (code: string) => titles.get(code);

  it("refuses a second printing of a hero already in the deck", () => {
    addDraftCard({ code: "141001", name: "Frodo Baggins", typeCode: "hero", deckLimit: 1 }, lookup);
    const other = { code: "01001", name: "Frodo Baggins", typeCode: "hero", deckLimit: 1 };
    expect(draftAddRefused(getDeckDraft(), other, lookup)).toBe(true);
    expect(addDraftCard(other, lookup)).toEqual({ ok: false, text: "Frodo Baggins: A hero appears once." });
    expect(getDeckDraft().heroes).toEqual(["141001"]);
  });

  it("counts copies across printings against the three-copy limit", () => {
    addDraftCard(gandalf, lookup);
    addDraftCard(gandalf, lookup);
    const reprint = { code: "02073", name: "Gandalf", typeCode: "ally", deckLimit: 3 };
    expect(addDraftCard(reprint, lookup)).toMatchObject({ ok: true, text: "Added Gandalf · 3 of 3" });
    expect(draftAddRefused(getDeckDraft(), reprint, lookup)).toBe(true);
    expect(addDraftCard(reprint, lookup)).toEqual({ ok: false, text: "Gandalf: At most three copies." });
    expect(takeDraftCard(gandalf, lookup)).toMatchObject({ ok: true, text: "Removed a copy of Gandalf · 2 of 3" });
  });
});

describe("undo and order", () => {
  it("Undo puts back the cards and keeps a name typed since", () => {
    startNewDeck({ name: "New deck" });
    const change = addDraftCard(gandalf);
    setDeckName("Wizards");
    if (change.ok) restoreDraft(change.before);
    expect(getDeckDraft()).toMatchObject({ name: "Wizards", cards: [] });
  });

  it("a card taken out and put back leaves the deck clean, whatever its place in the list", () => {
    editSavedDeck({ id: "deck-a", name: "Hobbits", heroes: [], cards: [{ code: "01073", count: 1 }, { code: "x", count: 1 }] });
    takeDraftCard(gandalf);
    addDraftCard(gandalf);
    expect(getDeckDraft().cards.map((card) => card.code)).toEqual(["x", "01073"]);
    expect(draftIsDirty(getDeckDraft())).toBe(false);
  });
});

describe("the side deck", () => {
  it("adds to the side deck while the pool targets it, counting its copies on their own, and Undo puts it back", () => {
    addDraftCard(gandalf);
    setDraftTarget("side");
    const change = addDraftCard(gandalf);
    expect(change).toMatchObject({ ok: true, text: "Added Gandalf to the side deck · 1 of 3" });
    expect(getDeckDraft()).toMatchObject({ cards: [{ code: "01073", count: 1 }], side: [{ code: "01073", count: 1 }] });
    expect(draftIsDirty(getDeckDraft())).toBe(true);
    if (change.ok) restoreDraft(change.before);
    expect(getDeckDraft().side).toEqual([]);
  });

  it("refuses a hero or a contract", () => {
    setDraftTarget("side");
    expect(addDraftCard(sam)).toEqual({ ok: false, text: "Sam Gamgee: A hero is not a side deck card." });
    expect(draftAddRefused({ heroes: [], cards: [] }, { code: "22024", name: "The Burglar's Turn", typeCode: "contract", deckLimit: 1 }, undefined, "side")).toBe(true);
  });

  it("takes a copy from the side deck with its stepper and keeps a saved side deck clean", () => {
    editSavedDeck({ id: "d", name: "D", heroes: [], cards: [], side: [{ code: "01073", count: 2 }] });
    expect(draftIsDirty(getDeckDraft())).toBe(false);
    expect(changeDraftCount("01073", "Gandalf", 3, -1, undefined, "side")).toMatchObject({ ok: true, text: "Removed a copy of Gandalf in the side deck · 1 of 3" });
    expect(draftIsDirty(getDeckDraft())).toBe(true);
  });
});
