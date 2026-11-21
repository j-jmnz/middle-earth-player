// Rules: rr.forced, rr.player-elimination (data/rules/entries.json); docs/brief.md (The Siege of Annúminas, The table); ledger lines 50801:B:2, 50812:A:1, 50812:A:2, 50814:A:2, 50820:A:2.
// The top-bar dial of The Siege of Annúminas: the city strength, with the damage the end of the round brings.
import { describe, expect, it } from "vitest";

import { tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { dialProps } from "../dials.ts";
import { annuminasDials } from "./annuminas.ts";

const ID = "the-siege-of-annuminas";
const nameOfIn = (made: ReturnType<typeof tableFromLayout>) => (code: string) => made.cards.get(code)?.name ?? code;
const dialOf = (layout: Layout) => {
  const made = tableFromLayout(ID, layout);
  return annuminasDials(made.state, made.ctx, nameOfIn(made))[0];
};

describe("the city strength dial", () => {
  it("50812:A:2 counts the tokens on Annúminas, with no ring (the strength counts down to the loss at 0), and does not warn far from 0", () => {
    const dial = dialOf({ stage: "50804", staging: [{ code: "50812", resources: 17 }, "f3"] });
    expect(dial).toMatchObject({ id: "city", testID: "annuminas-city", label: "City", value: 17 });
    expect(dial?.limit).toBeUndefined();
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toBe("Annúminas holds a city strength of 17. At the end of the round Annúminas takes 1 for the enemies in play. At 0 the players lose the game. A player who is eliminated costs it 9.");
    expect(dialProps(dial!).limit).toBeUndefined();
  });

  it("50812:A:1 counts each enemy in play, the engaged ones too, in the damage the round brings", () => {
    const dial = dialOf({ stage: "50804", staging: [{ code: "50812", resources: 17 }, "f3"], engaged: ["f3", "f3"] });
    expect(dial?.note).toContain("takes 3 for the enemies in play");
  });

  it("50814:A:2 adds Battering Ram's X, its resources and the one placed first plus 1", () => {
    const dial = dialOf({ stage: "50805", staging: [{ code: "50812", resources: 17 }, { code: "50814", resources: 2 }] });
    expect(dial?.note).toContain("takes 0 for the enemies in play, 4 from Battering Ram.");
  });

  it("50820:A:2 adds City Wall's 4 damage when the resource placed at the end of the round is its third", () => {
    expect(dialOf({ stage: "50804", staging: [{ code: "50812", resources: 17 }, { code: "50820", resources: 2 }] })?.note).toContain("4 from City Wall");
    expect(dialOf({ stage: "50804", staging: [{ code: "50812", resources: 17 }, { code: "50820", resources: 1 }] })?.note).not.toContain("City Wall");
  });

  it("50812:A:2 warns near 10 or less, and critically when the round's damage is as much as what is left", () => {
    expect(dialOf({ stage: "50804", staging: [{ code: "50812", resources: 10 }] })?.warn).toEqual({ level: "near", words: "Annúminas holds 10. At 0 the players lose the game." });
    expect(dialOf({ stage: "50804", staging: [{ code: "50812", resources: 2 }, "f3", "f3"] })?.warn).toEqual({ level: "critical", words: "The end of the round deals 2 damage to Annúminas, which holds 2: the players lose the game." });
  });

  it("50801:B:2 says a player eliminated costs 9, and a strength raised above 20 reads as it is", () => {
    const dial = dialOf({ stage: "50804", staging: [{ code: "50812", resources: 30 }] });
    expect(dial?.value).toBe(30);
    expect(dial?.note).toContain("A player who is eliminated costs it 9.");
  });

  it("50801:B:2 a tap shows the mode card after Annúminas while it lies beside the quest deck", () => {
    const made = tableFromLayout(ID, { modeCard: true, stage: "50804", staging: [{ code: "50812", resources: 17 }] });
    const [dial] = annuminasDials(made.state, made.ctx, nameOfIn(made));
    const mode = Object.values(made.state.cards).find((card) => card.code === "50801");
    expect(dial?.extra).toEqual([mode?.id]);
    expect(dialOf({ stage: "50804", staging: [{ code: "50812", resources: 17 }] })?.extra).toBeUndefined();
  });

  it("has no dial before Annúminas is in play or in another scenario", () => {
    expect(dialOf({ stage: "50804" })).toBeUndefined();
    const other = tableFromLayout("the-old-forest", { staging: ["f0"] });
    expect(annuminasDials(other.state, other.ctx, nameOfIn(other))).toEqual([]);
  });
});
