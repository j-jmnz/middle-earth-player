// Rules: rr.forced, rr.quest-advancement (data/rules/entries.json); docs/brief.md (The Woodland Realm, The table); ledger lines 51103:B:2, 51104:B:3, 51105:B:2, 51108:B:3.
// The top-bar dials of The Woodland Realm: the progress cap of stage 2 and the phase tally of stage 3B.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { dialProps } from "../dials.ts";
import { woodlandDials } from "./woodland.ts";

const made = (layout: Layout) => tableFromLayout("the-woodland-realm", layout);
const table = (stat: "questProgressCap" | "questProgressPlaced" | "questProgressPhase", amount: number): ScenarioState["modifiers"][number] => ({ instanceId: "table", sourceId: "table", stat, amount, until: "endOfRound" });
const dials = (layout: Layout, modifiers: ScenarioState["modifiers"]) => {
  const t = made(layout);
  return woodlandDials({ ...t.state, modifiers: [...t.state.modifiers, ...modifiers] }, (code) => t.cards.get(code)?.name ?? code);
};

describe("the progress cap dial of stage 2", () => {
  it("51103:B:2 appears once the staging step set the cap, counts what this round placed and is a ring toward the cap", () => {
    expect(dials({ stage: "51103" }, [])).toEqual([]);
    const dial = dials({ stage: "51103" }, [table("questProgressCap", 5), table("questProgressPlaced", 1)])[0];
    expect(dial).toMatchObject({ id: "cap", testID: "woodland-cap", label: "Cap", value: 1, limit: 5 });
    expect(dial?.warn).toBeUndefined();
    expect(dialProps(dial!).limit).toBe(5);
  });

  it("51104:B:3 says near at the cap and never before it, as a plain limit that does not warm", () => {
    const left = dials({ stage: "51104" }, [table("questProgressCap", 5), table("questProgressPlaced", 3)])[0];
    expect(left?.warn).toBeUndefined();
    expect(left?.warms).toBeUndefined();
    const full = dials({ stage: "51104" }, [table("questProgressCap", 10), table("questProgressPlaced", 6), table("questProgressPlaced", 4)])[0];
    expect(full).toMatchObject({ value: 10, limit: 10 });
    expect(full?.warn).toEqual({ level: "near", words: "No more progress can be placed on A Chosen Path this round." });
  });

  it("51105:B:2 says the cap is 5, or 10 with Mendor committed, in its note", () => {
    expect(dials({ stage: "51105" }, [table("questProgressCap", 5)])[0]?.note).toBe("0 of the 5 progress that can be placed on A Chosen Path this round. The cap is 5, or 10 when Mendor was committed to the quest.");
  });
});

describe("the phase tally dial of stage 3B", () => {
  it("51108:B:3 counts the progress placed this phase toward 10 as a goal, with no warning", () => {
    const dial = dials({ stage: "51108" }, [table("questProgressPhase", 4), table("questProgressPhase", 2)])[0];
    expect(dial).toMatchObject({ id: "phase", testID: "woodland-phase", label: "Reveal", value: 6, limit: 10, goal: true });
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toContain("6 progress placed on On the Trail this phase.");
  });

  it("has no dial on any other stage or in another scenario", () => {
    expect(dials({ stage: "51107" }, [table("questProgressPhase", 4)])).toEqual([]);
    expect(dials({ stage: "51101" }, [table("questProgressCap", 5)])).toEqual([]);
    const t = made({ stage: "51108" });
    expect(woodlandDials({ ...t.state, scenarioId: "the-wizards-quest" }, (code) => code)).toEqual([]);
  });
});
