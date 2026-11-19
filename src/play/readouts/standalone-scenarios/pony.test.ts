// Rules: rr.in-play-and-out-of-play (data/rules/entries.json); docs/brief.md (Murder at the Prancing Pony, reading 23 and The table); ledger lines 50701:A:1, 50702:B:2.
// The Investigation List dial: the names checked off by what the players have seen, and nothing of the hidden Suspect and Hideout or of the unlooked Investigation deck.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { isDiscardPile, opensList, PILE_WORDS, pileSelector, secondPilesOf } from "../../store/selectors.ts";
import { ponyDials } from "./pony.ts";

const ID = "murder-at-the-prancing-pony";
const nameOfIn = (made: ReturnType<typeof tableFromLayout>) => (code: string) => made.cards.get(code)?.name ?? code;

describe("the Investigation List dial", () => {
  it("lists every name unchecked while the Suspects and Hideouts are set aside or in the deck", () => {
    const made = tableFromLayout(ID, { piles: { investigationDeck: ["50709", "50704"] }, setAside: ["50710", "50705"] } as Layout);
    const [dial] = ponyDials(made.state, nameOfIn(made));
    expect(dial).toMatchObject({ id: "list", value: 0, limit: 10, label: "List" });
    expect(dial?.note).toContain("Checked off: none.");
    expect(dial?.note).toContain("Not checked off: Todd the Troll");
  });

  it("checks a name off once a look showed the card, and once it is in play, and no sooner", () => {
    const made = tableFromLayout(ID, { piles: { investigationDeck: ["50709", "50704"] }, staging: ["50711"] });
    const looked = updateCard(made.state, idOf(made.state, "50709"), { seen: true });
    const [dial] = ponyDials(looked, nameOfIn(made));
    expect(dial?.value).toBe(2);
    expect(dial?.note).toMatch(/Checked off: [^.]*Wolf-pelt Jake/);
    expect(dial?.note).not.toMatch(/Checked off: [^.]*Bill Ferny's House/);
  });

  it("leaves a card removed from the game unseen unchecked", () => {
    const made = tableFromLayout(ID, { piles: { investigationDeck: ["50709"] } });
    const gone = updateCard(made.state, idOf(made.state, "50709"), { zone: "removed" });
    expect(ponyDials(gone, nameOfIn(made))[0]?.value).toBe(0);
  });

  it("has no dial in another scenario", () => {
    const other = tableFromLayout("the-old-forest", { staging: ["f0"] });
    expect(ponyDials(other.state, nameOfIn(other))).toEqual([]);
  });
});

describe("the Investigation deck pile", () => {
  it("shows a back and a count, never a card, and opens no list", () => {
    const made = tableFromLayout(ID, { piles: { investigationDeck: ["50709", "50704", "50714"] } });
    expect(secondPilesOf(made.state)).toEqual(["investigationDeck"]);
    expect(isDiscardPile("investigationDeck")).toBe(false);
    expect(opensList("investigationDeck")).toBe(false);
    expect(PILE_WORDS.investigationDeck).toBe("Investigation deck");
    const view = pileSelector("investigationDeck", 0)(made.state);
    expect(view.ids).toHaveLength(3);
    expect(view.top).toBeNull();
  });

  it("is absent before the Setup builds it", () => {
    expect(secondPilesOf(tableFromLayout(ID, {}).state)).toEqual([]);
  });
});
