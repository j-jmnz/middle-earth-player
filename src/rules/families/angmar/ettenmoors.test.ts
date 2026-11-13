// Rules: mec108.objective-locations, mec108.safe, rr.guarded, rr.reveal, rr.setup, rr.active-location, rr.travel, rr.blank (data/rules/entries.json); ledger lines 10064:A:1, 10064:B:1, 10065:A:1, 10068:A:1, 10069:A:3, 10070:A:3, 10071:A:3, 10083:A:1.
// The verbs of Across the Ettenmoors on tables built from data/ by the layout kit: the Setup pair, the Safe keyword's effects, the reveal of a discarded side quest.
import { describe, expect, it } from "vitest";

import { settle } from "../../engine/machine.ts";
import { textBlank } from "../attachments/hold.ts";
import { constantInstructions } from "../../interpret/constant-records.ts";
import { holds } from "../../interpret/conditions.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { codesIn, finish, first, idOf, idsOf, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "across-the-ettenmoors";
const built = (layout: Layout = {}) => tableFromLayout(SCENARIO, layout);
const codesAt = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
const SAFE = ["10068", "10069", "10070", "10071"];
const QUESTS = ["10081", "10082", "10083"];

describe("the Setup of Into the Ettenmoors", () => {
  const layout: Layout = { setAside: [...QUESTS, ...SAFE, "10067"], deck: ["f0", "f3"] };

  it("10064:A:1 stages a random side quest guarding a random safe location, shuffles the rest into the encounter deck and gives the first player Amarthiúl", () => {
    const t = built(layout);
    const run = resolveRecords(t.state, t.ctx, "10064", "setup", idOf(t.state, "10064"));
    const state = run.state;
    const staged = state.staging.map((id) => state.cards[id]);
    const quest = staged.find((card) => QUESTS.includes(card?.code ?? ""));
    const place = staged.find((card) => SAFE.includes(card?.code ?? ""));
    expect(staged).toHaveLength(2);
    // The side quest is the location's guard, attached to it and staged; the location's own Guarded takes no further card.
    expect(quest?.guard).toBe(true);
    expect(quest?.host).toBe(place?.id);
    expect(place?.attachments).toEqual([quest?.id]);
    // The other two side quests and three locations are in the encounter deck with the two cards it held.
    expect(state.encounterDeck).toHaveLength(7);
    expect(codesAt(state, state.encounterDeck).filter((code) => QUESTS.includes(code ?? ""))).toHaveLength(2);
    expect(state.setAside.map((id) => state.cards[id]?.code)).toEqual([]);
    // Amarthiúl is in the first player's area.
    expect(state.cards[idOf(state, "10067")]?.zone).toBe("play");
    expect(state.cards[idOf(state, "10067")]?.controller).toBe(0);
  });

  it("10064:A:1 picks with the game's seed: other seeds stage other pairs", () => {
    const pairs = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const t = built({ ...layout, seed });
      const state = resolveRecords(t.state, t.ctx, "10064", "setup", idOf(t.state, "10064")).state;
      pairs.add(state.staging.map((id) => state.cards[id]?.code).sort().join("+"));
    }
    expect(pairs.size).toBeGreaterThan(1);
  });
});

describe("the Safe keyword", () => {
  const withActive = (code: string, extra: Layout = {}) => built({ active: code, ...extra });

  it("10068:A:1 is read from the card's constant record (the pick filter safe, the condition safeActive)", () => {
    const t = withActive("10068", { staging: ["10069", "10075"] });
    // An encounter card's effect asks (the objective-locations are immune to player card effects).
    const safe = pickCandidates(t.state, { type: "objective", control: "any", safe: true }, 0, [], idOf(t.state, "10075"), t.ctx);
    expect(safe.map((id) => t.state.cards[id]?.code).sort()).toEqual(["10068", "10069"]);
    expect(holds(t.state, { kind: "safeActive", is: true }, { actor: 0, sourceId: null, returned: 0 }, t.ctx)).toBe(true);
    const none = built({ staging: ["10069"] });
    expect(holds(none.state, { kind: "safeActive", is: true }, { actor: 0, sourceId: null, returned: 0 }, none.ctx)).toBe(false);
    expect(holds(none.state, { kind: "safeActive", is: false }, { actor: 0, sourceId: null, returned: 0 }, none.ctx)).toBe(true);
  });

  it("10068:A:1 while active: no engagement checks, treachery reveals ignored, encounter side quests blank; none of it while the location is only staged", () => {
    const active = withActive("10068", { staging: ["10081", "f0"] });
    expect(flagged(active.state, "table", "noEngagementChecks")).toBe(true);
    expect(flagged(active.state, "table", "treacheryRevealIgnored")).toBe(true);
    expect(textBlank(active.state, idOf(active.state, "10081"), active.ctx.cards)).toBe(true);
    const staged = built({ staging: ["10068", "10081"] });
    expect(flagged(staged.state, "table", "noEngagementChecks")).toBe(false);
    expect(flagged(staged.state, "table", "treacheryRevealIgnored")).toBe(false);
    expect(textBlank(staged.state, idOf(staged.state, "10081"), staged.ctx.cards)).toBe(false);
  });

  it("10068:A:1 ignores the When Revealed of a treachery while active (the treachery is still revealed and discarded)", () => {
    const quiet = withActive("10068", { deck: ["10073"] });
    const run = revealFromTop(quiet.state, quiet.ctx, "10079", []);
    // Arador's Bane (a treachery) asked nothing and searched nothing: it went to the discard pile with no effect.
    expect(run.state.window ?? null).toBeNull();
    expect(run.state.cards[run.id]?.zone).toBe("encounterDiscard");
    expect(codesIn(run.state, "staging")).toEqual([]);
    // With the location only staged its When Revealed runs: the player searches for the Giant and adds it to the staging area.
    const loud = built({ deck: ["10073"], staging: ["10068"] });
    const revealed = finish({ state: revealFromTop(loud.state, loud.ctx, "10079", []).state, steps: [] }, loud.ctx);
    expect(codesIn(revealed.state, "staging")).toContain("10073");
  });

  it("10068:A:1 returns every engaged enemy to the staging area when the players travel to the location (Forced, on the traveled event)", () => {
    const t = built({ phase: "Travel", staging: ["10068"], engaged: ["f3", "f0"] });
    expect(t.state.seats[0]?.engaged).toHaveLength(2);
    const run = resolveRecords(t.state, t.ctx, "10068", "forced", idOf(t.state, "10068"));
    expect(run.state.seats[0]?.engaged ?? []).toEqual([]);
    expect(run.state.staging.map((id) => run.state.cards[id]?.code).sort()).toEqual(["10068", "f0", "f3"].sort());
  });

  it("10069:A:3 heals 1 damage from each character in play and 10071:A:3 adds a resource to each hero", () => {
    const t = built({ staging: ["10069", "10071"], play: [{ code: "ally", damage: 1 }] });
    const hero = t.hero;
    const damaged = { ...t.state, cards: { ...t.state.cards, [hero]: { ...t.state.cards[hero]!, damage: 1 } } };
    const healed = resolveRecords(damaged, t.ctx, "10069", "response", idOf(damaged, "10069"));
    expect(healed.state.cards[hero]?.damage).toBe(0);
    expect(healed.state.cards[idOf(healed.state, "ally")]?.damage).toBe(0);
    const before = t.state.cards[hero]?.resources ?? 0;
    const paid = resolveRecords(t.state, t.ctx, "10071", "response", idOf(t.state, "10071"));
    expect(paid.state.cards[hero]?.resources).toBe(before + 1);
  });

  it("10068:A:1 adds the safe location to the victory display at the end of the quest phase, with its progress", () => {
    const t = built({ active: "10068" });
    const run = resolveRecords(t.state, t.ctx, "10068", "forced", idOf(t.state, "10068"));
    // The Forced record names the end of the phase: the record resolved by hand runs it.
    expect(run.state.cards[idOf(run.state, "10068")]?.zone).toBe("victory");
    expect(run.state.activeLocation).toBeNull();
  });
});

describe("the reveal of a discarded side quest", () => {
  it("10065:A:1 shuffles the discard pile in, discards until a side quest, reveals it and adds it to the staging area", () => {
    const t = built({ stage: "10065", discard: ["f0"], deck: ["f3", "10082", "f0"] });
    const run = resolveRecords(t.state, t.ctx, "10065", "whenRevealed", idOf(t.state, "10065"));
    expect(codesIn(run.state, "staging")).toContain("10082");
    // Whatever was discarded on the way is in the discard pile; the side quest is not.
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).not.toContain("10082");
  });

  it("10065:A:1 with no side quest in the deck runs the deck out and reveals nothing", () => {
    const t = built({ stage: "10065", deck: ["f3", "f0"] });
    const run = resolveRecords(t.state, t.ctx, "10065", "whenRevealed", idOf(t.state, "10065"));
    expect(run.state.encounterDeck).toEqual([]);
    expect(codesIn(run.state, "staging")).toEqual([]);
  });
});

describe("Scavenge for Supplies", () => {
  it("10083:A:1 raises the cost of every player card by 1 while it is in play", () => {
    const t = built({ staging: ["10083"], hand: ["ally"] });
    const records = constantInstructions(t.state, t.ctx).filter((item) => item.instruction.verb === "IncreaseCost");
    expect(records.map((item) => item.source.code)).toEqual(["10083"]);
  });
});
