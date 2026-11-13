// Rules: mec108.side-quests-in-play, mec108.safe, rr.active-location, rr.step-3-3, rr.running-out-of-cards, rr.reveal, rr.blank, mec108.campaign-setup-across-the-ettenmoors, faq.progress-without-advancing (data/rules/entries.json).
// The three quest stages and the campaign card of Across the Ettenmoors on the scenario's own table. Each test starts its title with the line it covers; encounter.test.ts holds the encounter cards.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { encounterCopies } from "../../../rules/families/angmar/ettenmoors.ts";
import { codesIn, idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "across-the-ettenmoors";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "10064", phase: "Quest", ...layout });
const zoneOf = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;

describe("10064:B:1 and 10064:B:2 are the lines of stage 1B", () => {
  it("10064:B:1 discards from the encounter deck until a side quest is discarded, reveals it and adds it to the staging area when no encounter side quest is in play", () => {
    const t = at({ deck: ["f3", "10082", "f0"], discard: [] });
    const run = resolveRecords(t.state, t.ctx, "10064", "forced", t.state.questStage ?? "");
    expect(codesIn(run.state, "staging")).toEqual(["10082"]);
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f3"]);
    expect(run.state.encounterDeck.map((id) => run.state.cards[id]?.code)).toEqual(["f0"]);
  });

  it("10064:B:1 does nothing while an encounter side quest is in play (in the staging area, or a guard attached to a location)", () => {
    const staged = at({ staging: ["10083"], deck: ["f3", "10082"] });
    expect(resolveRecords(staged.state, staged.ctx, "10064", "forced", staged.state.questStage ?? "").state.encounterDeck).toHaveLength(2);
    // The Setup's pair: the side quest guards the location, both in the staging area.
    const setup = at({ setAside: ["10081", "10068"], deck: ["f3", "10082"] });
    const paired = resolveRecords(setup.state, setup.ctx, "10064", "setup", setup.state.questStage ?? "");
    expect(paired.state.cards[idOf(paired.state, "10081")]?.guard).toBe(true);
    const run = resolveRecords(paired.state, setup.ctx, "10064", "forced", paired.state.questStage ?? "");
    expect(run.state.encounterDeck.length).toBeGreaterThanOrEqual(2);
    expect(codesIn(run.state, "encounterDiscard")).toEqual([]);
  });

  it("10064:B:1 runs the encounter deck out with no side quest in it and reveals nothing (the deck resets at the next reveal)", () => {
    const t = at({ deck: ["f3", "f0"] });
    const run = resolveRecords(t.state, t.ctx, "10064", "forced", t.state.questStage ?? "");
    expect(run.state.encounterDeck).toEqual([]);
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f0", "f3"]);
    expect(codesIn(run.state, "staging")).toEqual([]);
  });

  it("10064:B:2 places the printed quest points of a defeated encounter side quest on the stage", () => {
    const t = at({ staging: [{ code: "10081", progress: 8 }] });
    const state = settle(t.state, t.ctx, []);
    expect(zoneOf(state, "10081")).toBe("victory");
    expect(state.cards[state.questStage ?? ""]?.progress).toBe(8);
  });
});

describe("10065:B:1 and 10066:B:1 are the lines of the stages that turn on the safe locations", () => {
  it("10065:B:1 reveals 1 additional encounter card in the quest phase, unless a safe location is the active location", () => {
    const plain = at({ stage: "10065" });
    const run = resolveRecords(plain.state, plain.ctx, "10065", "forced", plain.state.questStage ?? "");
    expect(run.state.modifiers.some((modifier) => modifier.stat === "revealMore" && modifier.amount === 1)).toBe(true);
    const safe = at({ stage: "10065", active: "10068" });
    const quiet = resolveRecords(safe.state, safe.ctx, "10065", "forced", safe.state.questStage ?? "");
    expect(quiet.state.modifiers.some((modifier) => modifier.stat === "revealMore")).toBe(false);
  });

  it("10066:B:1 gives each damaged character -2 Willpower unless a safe location is the active location", () => {
    const willpower = (layout: Layout) => {
      const t = at({ stage: "10066", ...layout });
      const hurt = updateCard(t.state, t.hero, { damage: 1 });
      const synced = syncConstants(settle(hurt, t.ctx, []), t.ctx);
      return [modifiedStat(synced, synced.cards[t.hero]!, "willpower", t.cards), modifiedStat(synced, synced.cards[t.hero2]!, "willpower", t.cards)];
    };
    // The stand-in heroes have 2 Willpower: the damaged one is lowered by 2 (to 0), the other is not.
    expect(willpower({})).toEqual([0, 2]);
    expect(willpower({ active: "10068" })).toEqual([2, 2]);
  });

  it("10066:B:2 wins the game when the stage is defeated", () => {
    const t = at({ stage: "10066", progress: 17 });
    const run = resolveRecords(t.state, t.ctx, "10066", "questResolution", t.state.questStage ?? "");
    expect(run.state.stageCleared).toBe(true);
  });
});

describe("10182:A:2, 10182:A:3 and 10182:B:1 are the campaign card's lines", () => {
  it("10182:A:2 sets all 5 Losing Time treacheries aside, out of play", () => {
    const t = at({ campaign: true });
    const run = resolveRecords(t.state, t.ctx, "10182", "campaignSetup", idOf(t.state, "10182"));
    expect(run.state.setAside.filter((id) => run.state.cards[id]?.code === "10183")).toHaveLength(5);
  });

  it("10182:A:3 places 1 resource at the beginning of the quest phase and, with 3, removes them to reveal a set-aside Losing Time into the encounter discard pile", () => {
    const t = at({ campaign: true, setAside: ["10183", "10183"], deck: ["f0", "f0"] });
    const card = idOf(t.state, "10182");
    const first = resolveRecords(t.state, t.ctx, "10182", "forced", card);
    expect(first.state.cards[card]?.resources).toBe(1);
    expect(first.state.setAside).toHaveLength(2);
    const ready = { ...first.state, cards: { ...first.state.cards, [card]: { ...first.state.cards[card]!, resources: 2 } } };
    const third = resolveRecords(ready, t.ctx, "10182", "forced", card);
    expect(third.state.cards[card]?.resources).toBe(0);
    expect(third.state.setAside).toHaveLength(1);
    // The revealed treachery resolved (each player raised their threat by 3 or exhausted a hero, Surge revealed another card) and ended in the discard pile.
    expect(codesIn(third.state, "encounterDiscard")).toContain("10183");
  });

  it("10182:A:3 keeps the resources when no Losing Time is left set aside", () => {
    const t = at({ campaign: true });
    const card = idOf(t.state, "10182");
    const ready = { ...t.state, cards: { ...t.state.cards, [card]: { ...t.state.cards[card]!, resources: 2 } } };
    const run = resolveRecords(ready, t.ctx, "10182", "forced", card);
    expect(run.state.cards[card]?.resources).toBe(3);
  });

  it("10182:B:1 counts each Losing Time in the encounter deck or discard pile for the Campaign Pool, and none set aside, staged or attached", () => {
    const t = at({ campaign: true, deck: ["10183", "f0"], discard: ["10183"], setAside: ["10183"], staging: ["10183"] });
    expect(encounterCopies(t.state, ["10183"], 4)).toEqual([{ code: "10183", to: "pool", seat: null, hero: null, step: 4 }, { code: "10183", to: "pool", seat: null, hero: null, step: 4 }]);
    expect(flagged(t.state, "table", "noEngagementChecks")).toBe(false);
  });
});
