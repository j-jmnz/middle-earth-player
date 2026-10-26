import { describe, expect, it } from "vitest";

import { deckListFiltered, deckListSpheres, emptyDeckListFilter, filterDecks, getDeckListView, setDeckListView } from "./deck-list.ts";

const heroes = new Map([
  ["sam", { name: "Sam Gamgee", sphereCode: "leadership", sphereName: "Leadership" }],
  ["merry", { name: "Merry", sphereCode: "tactics" }],
  ["gandalf", { name: "Gandalf", sphereCode: "neutral" }],
  ["eowyn", { name: "Éowyn", sphereCode: "spirit" }],
]);
const decks = [
  { id: "a", name: "Hobbits", heroes: ["sam", "merry"] },
  { id: "b", name: "Wizards", heroes: ["gandalf", "eowyn"] },
  { id: "c", name: "Empty", heroes: [] },
];
const ready = (deck: { id: string }) => deck.id === "a";

describe("filterDecks", () => {
  it("keeps every deck, in order, with no filter", () => {
    expect(filterDecks(decks, emptyDeckListFilter, heroes, ready).map((deck) => deck.id)).toEqual(["a", "b", "c"]);
    expect(deckListFiltered(emptyDeckListFilter)).toBe(false);
  });

  it("searches the deck name and its heroes' names", () => {
    expect(filterDecks(decks, { ...emptyDeckListFilter, query: "wiz" }, heroes, ready).map((deck) => deck.id)).toEqual(["b"]);
    expect(filterDecks(decks, { ...emptyDeckListFilter, query: " sam " }, heroes, ready).map((deck) => deck.id)).toEqual(["a"]);
  });

  it("narrows by readiness and by a hero's sphere", () => {
    expect(filterDecks(decks, { ...emptyDeckListFilter, status: "ready" }, heroes, ready).map((deck) => deck.id)).toEqual(["a"]);
    expect(filterDecks(decks, { ...emptyDeckListFilter, status: "unready" }, heroes, ready).map((deck) => deck.id)).toEqual(["b", "c"]);
    expect(filterDecks(decks, { ...emptyDeckListFilter, sphere: "spirit" }, heroes, ready).map((deck) => deck.id)).toEqual(["b"]);
    expect(deckListFiltered({ ...emptyDeckListFilter, sphere: "spirit" })).toBe(true);
  });
});

describe("deckListSpheres", () => {
  it("lists the heroes' spheres in the game's order", () => {
    expect(deckListSpheres(decks, heroes).map((sphere) => sphere.code)).toEqual(["leadership", "tactics", "spirit", "neutral"]);
    expect(deckListSpheres(decks, heroes)[0]).toEqual({ code: "leadership", name: "Leadership" });
  });
});

describe("deck list view", () => {
  it("starts on Cards and keeps the choice", () => {
    expect(getDeckListView()).toBe("Cards");
    setDeckListView("List");
    expect(getDeckListView()).toBe("List");
  });
});
