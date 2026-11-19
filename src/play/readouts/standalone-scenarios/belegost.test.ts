// Rules: rr.forced, rr.quest-advancement (data/rules/entries.json); docs/brief.md (The Ruins of Belegost, The table); ledger lines 50603:B:1, 50603:B:2, 50608:A:1, 50615:A:2.
// The top-bar dials of The Ruins of Belegost: the resources on Stalking the Ruins against the 3 that bring Naurlhûg (it warms when the next quest phase brings him, and then says his X) and the resources on stage 2D against the 3 it asks for.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { dialProps } from "../dials.ts";
import { belegostDials } from "./belegost.ts";

const ID = "the-ruins-of-belegost";
const nameOfIn = (made: ReturnType<typeof tableFromLayout>) => (code: string) => made.cards.get(code)?.name ?? code;
const dialsOf = (layout: Layout) => {
  const made = tableFromLayout(ID, layout);
  return belegostDials(made.state, made.ctx, nameOfIn(made));
};
const byId = (layout: Layout, id: string) => dialsOf(layout).find((dial) => dial.id === id);

describe("the Stalking the Ruins dial", () => {
  it("50608:A:1 counts the resources on Stalking the Ruins against the 3 that bring Naurlhûg, and does not warm far from it", () => {
    const dial = byId({ staging: [{ code: "50608", resources: 1 }] }, "stalking");
    expect(dial).toMatchObject({ value: 1, limit: 3, warms: true, label: "Stalking", limitWords: "3 resources bring Naurlhûg into play" });
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toBe("Stalking the Ruins holds 1 of 3 resources. One more is placed at the beginning of each quest phase. At 3 Naurlhûg is added to the staging area, and when the players advance the resources are discarded.");
    expect(dialProps(dial!).limit).toBe(3);
  });

  it("50608:A:1 warns when the next quest phase brings Naurlhûg", () => {
    expect(byId({ staging: [{ code: "50608", resources: 2 }] }, "stalking")?.warn).toEqual({ level: "near", words: "The next quest phase places 1 more resource, and Naurlhûg is added to the staging area." });
  });

  it("50615:A:2 says Naurlhûg's X once he is in play, and stops warning", () => {
    const dial = byId({ staging: [{ code: "50608", resources: 4 }, "50615"] }, "stalking");
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toContain("Naurlhûg is in play: X is 4, and each attack of Naurlhûg assigns 4 damage.");
  });

  it("has no dial before Stalking the Ruins is in play or in another scenario", () => {
    expect(byId({}, "stalking")).toBeUndefined();
    const other = tableFromLayout("the-old-forest", { staging: ["f0"] });
    expect(belegostDials(other.state, other.ctx, nameOfIn(other))).toEqual([]);
  });
});

describe("the dial of stage 2D", () => {
  it("50603:B:1 counts the resources on the stage against the 3 it asks for, a goal dial", () => {
    const made = tableFromLayout(ID, { stage: "50603" });
    const stage = idOf(made.state, "50603");
    const state = updateCard(made.state, stage, { resources: 2 });
    const [dial] = belegostDials(state, made.ctx, nameOfIn(made));
    expect(dial).toMatchObject({ id: "stage", value: 2, limit: 3, goal: true, label: "Resources" });
    expect(dial?.note).toBe("This stage holds 2 of 3 resources. After the active location is explored 1 more is placed. The players cannot advance with fewer than 3, or without 2 Loot objectives.");
  });

  it("50603:B:2 shows no dial on another stage", () => {
    expect(dialsOf({ stage: "50604" })).toEqual([]);
  });
});
