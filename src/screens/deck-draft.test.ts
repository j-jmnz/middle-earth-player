import { beforeEach, describe, expect, it } from "vitest";

import {
  addDraftCard,
  draftCopyCount,
  getDeckDraft,
  removeDraftHero,
  replaceDeckDraft,
  startNewDeck,
} from "./deck-draft.ts";

beforeEach(() => {
  startNewDeck();
});

describe("deck draft", () => {
  it("names a hero already in the deck and does not add a second copy", () => {
    addDraftCard({ code: "141002", name: "Sam Gamgee", typeCode: "hero", deckLimit: 1 });
    addDraftCard({ code: "141002", name: "Sam Gamgee", typeCode: "hero", deckLimit: 1 });
    const draft = getDeckDraft();
    expect(draft.heroes).toEqual(["141002"]);
    expect(draft.heldRefusal).toEqual({
      cardCode: "141002",
      cardName: "Sam Gamgee",
      rule: "A hero appears once.",
    });
    expect(draftCopyCount(draft, "141002", "hero")).toBe(1);
  });

  it("counts copies of a card already in the draft", () => {
    addDraftCard({ code: "01073", name: "Gandalf", typeCode: "ally", deckLimit: 3 });
    addDraftCard({ code: "01073", name: "Gandalf", typeCode: "ally", deckLimit: 3 });
    expect(draftCopyCount(getDeckDraft(), "01073", "ally")).toBe(2);
  });

  it("keeps a fourth hero until that hero is removed", () => {
    replaceDeckDraft({
      id: "new",
      name: "Imported",
      heroes: ["h0", "h1", "h2", "h3"],
      cards: [],
      heldRefusal: null,
      droppedNote: "Dropped Elrond.",
    });
    expect(getDeckDraft().heroes).toEqual(["h0", "h1", "h2", "h3"]);
    expect(getDeckDraft().droppedNote).toBe("Dropped Elrond.");
    removeDraftHero("h3");
    expect(getDeckDraft().heroes).toEqual(["h0", "h1", "h2"]);
  });
});
