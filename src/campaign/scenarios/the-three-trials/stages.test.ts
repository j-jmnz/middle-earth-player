// Rules: rm.current-trial, rm.setup-the-three-trials, rm.time-x, rr.active-location, rr.quest-advancement, rr.victory, rr.attacks-outside-the-combat-phase, rr.travel, rr.cost (data/rules/entries.json).
// What a spec row cannot show in The Three Trials: the Setup, the progress of Trial of Intuition turned into discards, the last stage that wins only with Hallowed Circle in the victory display, the cost of Hallowed Circle, a Key that leaves play to a zone that is not the discard pile, and the Guardians' attacks and Time effects.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; the filler enemy has 1 Attack.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { opened } from "../../../../test/harness/campaign-kit.ts";
import { idOf, resolveRecords, run, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { trialsStart, trialsWorld } from "../../../../test/scenarios/the-three-trials/game.ts";

const SCENARIO = "the-three-trials";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const KEYS = [{ code: "08043", to: "dh1" }, { code: "08044", to: "dh1" }, { code: "08045", to: "dh1" }] as const;

describe("08035:A:1 the Setup", () => {
  it("08035:A:1 sets the three Guardians, the three Keys, the three Barrows and Hallowed Circle aside, out of play and never in the encounter deck (the first trial then takes three of them into play)", async () => {
    const { ctx } = await trialsWorld();
    const state = opened(trialsStart(1, 1, "Normal"), ctx);
    const ten = ["08040", "08041", "08042", "08043", "08044", "08045", "08046", "08047", "08048", "08049"];
    const codes = (ids: readonly string[]) => ids.map((id) => state.cards[id]?.code ?? "");
    expect(codes(state.encounterDeck).filter((code) => ten.includes(code))).toEqual([]);
    expect(codes(state.setAside).filter((code) => ten.includes(code))).toHaveLength(7);
    expect(Object.values(state.cards).filter((card) => ten.includes(card.code) && card.zone !== "setAside")).toHaveLength(3);
  });
});

describe("08038:B:1 progress turned into discards", () => {
  const stage = { stage: "08038", deck: ["08050", "08050", "08050", "08050", "08050", "08050"], seed: 1 } as const;
  const placed = (layout: Layout, amount: number) => {
    const t = table({ ...stage, ...layout });
    return run(t, t.state, { verb: "PlaceQuestProgress", perPlayer: amount });
  };

  it("08038:B:1 puts the progress on the active location first and discards one encounter card for each progress left over, the stage taking none (it has no quest points)", () => {
    const after = placed({ active: "08046" }, 9);
    expect(after.cards[idOf(after, "08046")]?.progress).toBe(6);
    expect([after.cards[idOf(after, "08038")]?.progress, after.encounterDiscard.length, after.encounterDeck.length]).toEqual([0, 3, 3]);
    expect(after.cards[after.questStage ?? ""]?.code).toBe("08038");
  });

  it("08038:B:1 replaces only the excess: progress the active location takes whole discards nothing", () => {
    const after = placed({ active: "08046" }, 4);
    expect([after.cards[idOf(after, "08046")]?.progress, after.encounterDiscard.length]).toEqual([4, 0]);
  });

  it("08038:B:1 turns all of it into discards with no active location, and a deck that runs out discards what it has", () => {
    const after = placed({}, 9);
    expect([after.encounterDiscard.length, after.encounterDeck.length, after.cards[idOf(after, "08038")]?.progress]).toEqual([6, 0, 0]);
  });

  it("08038:B:1 holds only while Trial of Intuition is the stage in play: Trial of Strength takes no discards", () => {
    const after = placed({ stage: "08036", active: "08046" }, 9);
    expect(after.encounterDiscard.length).toBe(0);
  });
});

describe("08039:B:2 the last stage", () => {
  const crown = (layout: Layout) => {
    const t = table({ stage: "08039", ...layout });
    return run(t, t.state, { verb: "PlaceQuestProgress", perPlayer: 1 });
  };

  it("08039:B:2 is not defeated by its quest point while Hallowed Circle is not in the victory display", () => {
    const after = crown({ staging: ["08049"] });
    expect([after.stageCleared, after.cards[idOf(after, "08039")]?.progress]).toEqual([false, 1]);
  });

  it("08039:B:2 is defeated, and the players win, once Hallowed Circle is in the victory display", () => {
    const after = crown({ victory: ["08049"] });
    expect(after.stageCleared).toBe(true);
  });
});

describe("08049:A:2 Hallowed Circle's travel cost", () => {
  it("08049:A:2 exhausts three ready Keys, not their hero", () => {
    const t = table({ staging: ["08049"], attached: [...KEYS] });
    const { state } = resolveRecords(t.state, t.ctx, "08049", "travel", idOf(t.state, "08049"));
    expect(["08043", "08044", "08045"].map((code) => cardsOf(state, code)[0]?.exhausted)).toEqual([true, true, true]);
    expect(cardsOf(state, "dh1")[0]?.exhausted).toBe(false);
  });
});

describe("08043:A:2 a Key that leaves play to a zone that is not the discard pile", () => {
  it("08043:A:2 stays in the encounter deck when it is shuffled there (a Shadow effect), and does not go to the staging area", () => {
    const t = table({ deck: ["08043", "f0"] });
    const key = idOf(t.state, "08043");
    const { state } = resolveRecords(t.state, t.ctx, "08043", "forced", key);
    expect(state.cards[key]?.zone).toBe("encounterDeck");
  });
});

