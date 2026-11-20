// Rules: rr.forced, rr.victory (data/rules/entries.json); docs/brief.md (Attack on Dol Guldur, The table); ledger lines 50907:A:1, 50931:A:1, 50931:B:1, 50931:B:3.
// The top-bar dial of Attack on Dol Guldur: the city strength, with the tally the end of a stage 3 round takes off.
import { describe, expect, it } from "vitest";

import { tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { dialProps } from "../dials.ts";
import { guldurDials } from "./guldur.ts";

const ID = "attack-on-dol-guldur";
const nameOfIn = (made: ReturnType<typeof tableFromLayout>) => (code: string) => made.cards.get(code)?.name ?? code;
const made = (layout: Layout) => tableFromLayout(ID, layout);
const dialOf = (layout: Layout, tally?: number) => {
  const table = made(layout);
  const state = tally == null ? table.state : { ...table.state, siegeTally: { round: table.state.round, value: tally } };
  return guldurDials(state, nameOfIn(table))[0];
};
const DG = (resources: number) => ({ code: "50907", resources });

describe("the city strength dial", () => {
  it("50931:A:1 counts the tokens on Dol Guldur, with no ring, and does not warn far from 0", () => {
    const dial = dialOf({ stage: "50903", staging: [DG(15)] });
    expect(dial).toMatchObject({ id: "city", testID: "guldur-city", label: "City", value: 15 });
    expect(dial?.limit).toBeUndefined();
    expect(dial?.warn).toBeUndefined();
    expect(dialProps(dial!).limit).toBeUndefined();
  });

  it("50907:A:1 names the round's tally at stage 3 and says nothing comes off before it", () => {
    expect(dialOf({ stage: "50903", staging: [DG(15)] }, 6)?.note).toBe("Dol Guldur holds a city strength of 15. At the end of the round the 6 Siege value of the enemies destroyed and the locations explored this round comes off it. At 0 the Lieutenants lose Indestructible, and with none in play at the end of a round the players win.");
    expect(dialOf({ stage: "50902", staging: [DG(15)] }, 6)?.note).toContain("Until stage 3 nothing comes off it.");
  });

  it("50931:B:1 warns near 5 or less, and critically when the tally is as much as what is left at stage 3", () => {
    expect(dialOf({ stage: "50903", staging: [DG(5)] })?.warn).toEqual({ level: "near", words: "Dol Guldur holds 5. At 0 the Lieutenants lose Indestructible." });
    expect(dialOf({ stage: "50903", staging: [DG(8)] }, 8)?.warn).toEqual({ level: "critical", words: "The end of the round takes 8 off Dol Guldur's city strength: it falls to 0." });
    expect(dialOf({ stage: "50902", staging: [DG(8)] }, 8)?.warn).toBeUndefined();
  });

  it("50931:B:3 a tap shows the mode card after Dol Guldur while it lies beside the quest deck", () => {
    const table = made({ modeCard: true, stage: "50903", staging: [DG(10)] });
    const [dial] = guldurDials(table.state, nameOfIn(table));
    const mode = Object.values(table.state.cards).find((card) => card.code === "50931");
    expect(dial?.extra).toEqual([mode?.id]);
    expect(dialOf({ stage: "50903", staging: [DG(10)] })?.extra).toBeUndefined();
  });

  it("has no dial before Dol Guldur is in play or in another scenario", () => {
    expect(dialOf({ stage: "50903" })).toBeUndefined();
    const other = tableFromLayout("the-old-forest", { staging: ["f0"] });
    expect(guldurDials(other.state, nameOfIn(other))).toEqual([]);
  });
});
