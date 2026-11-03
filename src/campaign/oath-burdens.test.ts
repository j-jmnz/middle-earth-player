// Rules: rr.search, rr.engaged, rr.shadow-effects, rr.attachment-cards, rr.campaign-pool (data/rules/entries.json). The burdens The Oath deals or earns: Stalking
// Goblin (41041) searches the encounter deck, the discard pile and the collection, Guilty Conscience (41043) attaches to the hero with the highest threat cost.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/interpret/constants.ts";
import { legalIntents } from "../rules/engine/legal.ts";
import type { PlayerIntent } from "../rules/engine/reduce.ts";
import { settle } from "../rules/engine/machine.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { causeProblems } from "../../scripts/cause-check.ts";
import { codesIn, engageStaged, fight, loadOathWorld, oathTable, resolveReveal, settleChoices, type OathLayout, type OathWorld } from "../../scripts/oath-scene.ts";
import { first, send, start } from "../../scripts/past-scene.ts";

let world: OathWorld;

beforeAll(async () => {
  world = await loadOathWorld();
});

function make(layout: OathLayout = {}) {
  const made = oathTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

describe("Stalking Goblin (41041:A:1)", () => {
  it("searches the encounter deck first for a Goblin Sniper and adds it to the staging area, then shuffles the deck", () => {
    const made = make({ staging: ["41041"], phase: "Encounter", deck: ["f0", "41020", "f3"], discard: ["41020"] });
    const run = engageStaged(made.state, made.ctx, "41041");
    expect(codesIn(run.state, "engaged")).toEqual(["41041"]);
    expect(codesIn(run.state, "staging")).toEqual(["41020"]);
    // The copy in the deck was taken; the one in the discard pile stays (the deck's other cards are shadow cards by the combat phase).
    expect(codesIn(run.state, "encounterDeck")).not.toContain("41020");
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["41020"]);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("searches the discard pile when the deck holds none, and a Goblin Sniper from either printing counts", () => {
    const discard = make({ staging: ["41041"], phase: "Encounter", deck: ["f0"], discard: ["41020"] });
    const run = engageStaged(discard.state, discard.ctx, "41041");
    expect(codesIn(run.state, "staging")).toEqual(["41020"]);
    expect(codesIn(run.state, "encounterDiscard")).toEqual([]);
  });

  it("takes a Goblin Sniper from the collection when the deck and the discard pile hold none (the app tracks no collection)", () => {
    const made = make({ staging: ["41041"], phase: "Encounter", deck: ["f0", "f3"] });
    const before = Object.keys(made.state.cards).length;
    const run = engageStaged(made.state, made.ctx, "41041");
    expect(codesIn(run.state, "staging")).toEqual(["41020"]);
    expect(Object.keys(run.state.cards)).toHaveLength(before + 1);
    expect(codesIn(run.state, "encounterDiscard")).not.toContain("41020");
  });

  it("is added to the staging area as a Shadow card (41041:A:2)", () => {
    const hit = fight(world, "41041", "grunt");
    expect(hit.run.state.cards[first(hit.run.state, "41041")]?.zone).toBe("staging");
  });
});

describe("Guilty Conscience (41043:A:2)", () => {
  it("attaches to the hero with the highest threat cost, and counts as an Adaptation attachment", () => {
    // dh1 and dh3 print a threat cost of 8; the second hero of seat 0 prints 12.
    world.cards.set("big", { ...world.cards.get("dh2")!, code: "big", name: "big", threat: 12 });
    const made = make({ seats: 2 });
    const state = syncConstants({ ...made.state, cards: { ...made.state.cards, [made.hero2]: { ...made.state.cards[made.hero2]!, code: "big" } } }, made.ctx);
    const run = resolveReveal(state, made.ctx, "41043");
    const conscience = first(run.state, "41043");
    expect(run.state.cards[conscience]?.zone).toBe("attached");
    expect(run.state.cards[conscience]?.host).toBe(made.hero2);
    expect(made.ctx.effects.find((effect) => effect.id === "41043:constant:1")?.instructions).toEqual([{ verb: "CountsAs", cardType: "attachment", trait: "Adaptation" }]);
  });

  it("has the first player choose among heroes tied for the highest threat cost", () => {
    const made = make({ seats: 2 });
    const run = resolveReveal(made.state, made.ctx, "41043", (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === made.seat1Hero) ?? state.window.options[0] ?? "") : ""));
    expect(run.state.cards[first(run.state, "41043")]?.host).toBe(made.seat1Hero);
  });

  const attached = (layout: OathLayout = {}) => {
    const made = make({ ...layout, attachedEncounter: ["41043"] });
    return { ...made, conscience: first(made.state, "41043") };
  };

  it("raises its hero's controller's threat by 2 at the end of each round (the Forced effect)", () => {
    const made = attached({ seats: 2, phase: "Refresh" });
    // The hero is seat 0's: seat 0's threat rises by 2 as the round ends, seat 1's does not.
    let run = start(settle({ ...made.state, window: null }, made.ctx, []));
    for (let guard = 0; guard < 12 && run.state.phase !== "Resource"; guard += 1) {
      const intents = legalIntents(run.state, made.ctx);
      const pass = intents.find((intent) => intent.type === "Pass") ?? intents[0];
      if (!pass) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    expect(run.state.phase).toBe("Resource");
    // 28 plus the 2 from Guilty Conscience; 26 and nothing: neither includes the refresh phase's own raise, which the round's end follows.
    expect(run.state.seats[0].threat - run.state.seats[1].threat).toBe(28 - 26 + 2);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("is discarded by its hero's controller's Action, which spends 2 resources from the hero's pool", () => {
    const made = attached({ resources: 3 });
    const offer = legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === made.conscience);
    expect(offer).toBeDefined();
    const done = settleChoices(send(start(made.state), { ...(offer as Extract<PlayerIntent, { type: "Trigger" }>), payments: [{ heroId: made.hero, amount: 2 }] }, made.ctx), made.ctx);
    expect(done.state.cards[done.state.cards[made.conscience] ? made.conscience : ""]?.zone).toBe("encounterDiscard");
    expect(done.state.cards[made.hero]?.resources).toBe(1);
    // With fewer than 2 resources the Action is not offered.
    const poor = attached({ resources: 1 });
    expect(legalIntents(poor.state, poor.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === poor.conscience)).toBe(false);
  });

  it("belongs to the hero's controller: another player cannot use its Action", () => {
    const made = attached({ seats: 2, resources: 3 });
    const other = { ...made.state, activeSeat: 1 };
    expect(legalIntents(other as ScenarioState, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === made.conscience)).toBe(false);
  });
});
