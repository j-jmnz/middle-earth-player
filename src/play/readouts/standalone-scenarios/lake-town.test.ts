// Rules: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town); ledger lines 50201:B:1, 50202:B:1, 50203:B:3, 50207:A:1.
// The top-bar dials of The Battle of Lake-town and the Smaug piles of its table: the damage on Lake-town against 50 (it warms near the limit), on stage 3 the Victory points against that damage, and the damage on Smaug against the cap of the stage.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { pileSelector, zoneIds } from "../../store/selectors.ts";
import { isDiscardPile, secondPilesOf } from "../../store/pile-ids.ts";
import { lakeTownDials } from "./lake-town.ts";

const ID = "the-battle-of-lake-town";
const dialsOf = (layout: Layout) => {
  const made = tableFromLayout(ID, layout);
  return lakeTownDials(made.state, made.ctx, (code) => made.cards.get(code)?.name ?? code);
};
const byId = (layout: Layout, id: string) => dialsOf(layout).find((dial) => dial.id === id);

describe("the Lake-town dial", () => {
  it("50207:A:1 counts the damage against the 50 that loses the game, and does not warm far from it", () => {
    const dial = byId({ staging: [{ code: "50207", damage: 12 }] }, "town");
    expect(dial).toMatchObject({ value: 12, limit: 50, warms: true, label: "Lake-town" });
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toBe("Lake-town holds 12 of 50 damage. At 50 the players lose the game.");
  });

  it("50207:A:1 warns within 10 of the limit and turns critical within 3", () => {
    expect(byId({ staging: [{ code: "50207", damage: 40 }] }, "town")?.warn).toEqual({ level: "near", words: "10 more damage and the players lose the game." });
    expect(byId({ staging: [{ code: "50207", damage: 47 }] }, "town")?.warn?.level).toBe("critical");
  });

  it("has no dial in a game without Lake-town", () => {
    expect(dialsOf({ staging: [] })).toEqual([]);
  });
});

describe("the Victory points dial of stage 3", () => {
  it("50203:B:3 shows the points in the display against the damage on Lake-town, and a tie is not enough", () => {
    const dial = byId({ stage: "50203", staging: [{ code: "50207", damage: 9 }], victory: ["50221", "50219"] }, "score");
    expect(dial).toMatchObject({ value: 9, limit: 10, goal: true });
    expect(dial?.note).toContain("9 Victory points in the display against 9 damage on Lake-town");
  });

  it("is only on stage 3", () => {
    expect(byId({ stage: "50201", staging: ["50207"], victory: ["50221"] }, "score")).toBeUndefined();
  });
});

describe("the Smaug dial", () => {
  it("50201:B:1 and 50202:B:1 count his damage against the cap of the stage", () => {
    expect(byId({ stage: "50201", staging: ["50207", { code: "50204", damage: 4 }] }, "smaug")).toMatchObject({ value: 4, limit: 6 });
    expect(byId({ stage: "50202", staging: ["50207", { code: "50204", damage: 4 }] }, "smaug")).toMatchObject({ value: 4, limit: 12 });
  });

  it("50203:B:3 on stage 3 counts it against his hit points, the way out the players move toward", () => {
    expect(byId({ stage: "50203", staging: ["50207", { code: "50204", damage: 4 }] }, "smaug")).toMatchObject({ value: 4, limit: 20, goal: true });
  });

  it("has none with no Smaug in play", () => {
    expect(byId({ staging: ["50207"] }, "smaug")).toBeUndefined();
  });
});

describe("the Smaug deck and its discard pile", () => {
  it("50201:A:1 are the table's second slot once the Smaug deck is dealt, and the discard pile opens its list", () => {
    const made = tableFromLayout(ID, { staging: ["50207"], piles: { smaugDeck: ["50204", "50205"], smaugDiscard: ["50206"] } });
    expect(secondPilesOf(made.state)).toEqual(["smaugDeck", "smaugDiscard"]);
    expect(isDiscardPile("smaugDiscard")).toBe(true);
    expect(pileSelector("smaugDeck", 0)(made.state).ids).toHaveLength(2);
    expect(pileSelector("smaugDiscard", 0)(made.state).ids).toHaveLength(1);
  });

  it("are absent from a game that deals none", () => {
    expect(secondPilesOf(tableFromLayout(ID, { staging: ["50207"] }).state)).toEqual([]);
  });
});

describe("the second active location of Fisherman's Dock", () => {
  it("50223:A:2 draws the table's second active slot, since the scenario declares it", () => {
    const made = tableFromLayout(ID, { staging: ["50207", "50223"] });
    expect(made.state.widgets.secondActiveLocation).toBe(true);
    const dock = idOf(made.state, "50223");
    const second = { ...moveCard(made.state, dock, { zone: "secondActiveLocation" }), secondActiveLocation: dock };
    expect(zoneIds(second, "secondActiveLocation", 0)).toEqual([dock]);
  });
});
