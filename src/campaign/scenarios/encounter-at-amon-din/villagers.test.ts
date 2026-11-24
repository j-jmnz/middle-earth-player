// Rules: ats.villagers, ats.villagers-example, ats.villager-tokens-discarded, rr.explored, rr.victory, rr.travel, rr.cost (data/rules/entries.json).
// Villagers X and the villager tokens (06075:A:1, 06076:A:1, 06077:A:1, 06068:A:1, 06069:A:1, 06066:B:1): the tokens a location holds are not placed twice, are not resources for any player effect (ats.villagers), and go with a location that leaves play. Lord Alcaron and the Ravaging Orcs lines have their own files.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { idOf, legalIntents, send, statOf } from "../../../../test/harness/scene-kit.ts";
import { CODES, damageOn, runSettled, table, villagers } from "../../../../test/scenarios/encounter-at-amon-din/table.ts";

const { savagery, protect, rescued, dead, alcaron, farmhouse, hamlet, secluded } = CODES;
const BOROMIR = "05002";
const ERRAND_RIDER = "05003";

describe("Villagers X is placed once, when the location enters play", () => {
  it("06077:A:1 a location that is travelled to keeps the 2 tokens it was revealed with: no second placing when it becomes active", () => {
    const made = table({ stage: protect, phase: "Travel", staging: [{ code: secluded, resources: 2 }, rescued, dead], deck: ["f0", "f0", "f0"] });
    const traveled = send({ state: made.state, steps: [] }, { type: "Travel", locationId: idOf(made.state, secluded) }, made.ctx).state;
    expect(traveled.cards[idOf(traveled, secluded)]?.zone).toBe("activeLocation");
    expect(villagers(traveled, secluded)).toBe(2);
  });

  it("06075:A:1 the active location of the Setup is given its 4 tokens by the Setup alone: its record for entering play does not place 4 more", () => {
    const made = table({ stage: protect, active: { code: farmhouse, resources: 4 }, staging: [rescued, dead] });
    const done = runSettled(made, made.state, { verb: "DiscardVillagerTokens", from: "activeLocation", amount: 1 });
    expect(villagers(done, farmhouse)).toBe(3);
  });
});

describe("06066:B:1 the villager tokens are not resources (ats.villagers)", () => {
  // Villager tokens lie on Burning Farmhouse (the active location), on Rescued Villagers and on the quest card; every hero's pool is empty.
  const scene = (extra: readonly string[], layout: Parameters<typeof table>[0] = {}) => {
    const made = table({ phase: "Planning", active: { code: farmhouse, resources: 4 }, staging: [{ code: rescued, resources: 3 }, dead], ...layout }, undefined, extra);
    const quest = idOf(made.state, savagery);
    return { made, state: { ...made.state, cards: { ...made.state.cards, [quest]: { ...made.state.cards[quest]!, resources: 5 } } } satisfies ScenarioState };
  };

  it("06066:B:1 a card that costs 1 resource cannot be paid from villager tokens: a hero's pool of 0 pays nothing, whatever the cards hold, and 1 resource in the pool pays it", () => {
    const { made, state } = scene([], { hand: ["ally"] });
    const card = idOf(state, "ally");
    const refused = reduce(state, { type: "PlayCard", cardId: card, payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx);
    expect(refused.ok).toBe(false);
    expect(reduce(state, { type: "PlayCard", cardId: card, payments: [] }, made.ctx).ok).toBe(false);
    const funded = { ...state, cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, resources: 1 } } };
    expect(reduce(funded, { type: "PlayCard", cardId: card, payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx).ok).toBe(true);
    // The tokens stay where they lie: a payment did not touch them.
    expect(villagers(refused.ok ? refused.state : state, farmhouse)).toBe(4);
  });

  it("06066:B:1 Errand-rider (05003, move 1 resource from a hero's pool to another hero) has no source with villager tokens only, and moves nothing from the cards that hold them", () => {
    const { made, state } = scene([ERRAND_RIDER], { play: [ERRAND_RIDER] });
    expect(legalIntents(state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, ERRAND_RIDER))).toBe(false);
    // A hero with 1 resource makes the Action offered; it moves that resource between heroes and leaves the villager tokens where they are.
    const pooled = scene([ERRAND_RIDER], { play: [ERRAND_RIDER] });
    const withResource = { ...pooled.state, cards: { ...pooled.state.cards, [pooled.made.hero]: { ...pooled.state.cards[pooled.made.hero]!, resources: 1 } } };
    const action = legalIntents(withResource, pooled.made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(withResource, ERRAND_RIDER));
    expect(action).toBeDefined();
    const done = send({ state: withResource, steps: [] }, action as never, pooled.made.ctx);
    const settled = done.state.window?.kind === "choose" ? send(done, { type: "Choose", optionId: done.state.window.options[0] ?? "" }, pooled.made.ctx) : done;
    expect(villagers(settled.state, farmhouse)).toBe(4);
    expect(villagers(settled.state, rescued)).toBe(3);
    expect(villagers(settled.state, savagery)).toBe(5);
    expect((settled.state.cards[pooled.made.hero]?.resources ?? 0) + (settled.state.cards[pooled.made.hero2]?.resources ?? 0)).toBe(1);
  });

  it("06066:B:1 Boromir (05002, Gondor allies get +1 Attack while he has a resource in his pool) does not read villager tokens: Lord Alcaron, a Gondor ally, keeps 2 Attack", () => {
    const { made, state } = scene([BOROMIR], { heroes: [BOROMIR], play: [alcaron] });
    expect(statOf(syncConstants(state, made.ctx), made.ctx.cards, alcaron, "attack")).toBe(2);
    const boromir = idOf(state, BOROMIR);
    const pooled = syncConstants({ ...state, cards: { ...state.cards, [boromir]: { ...state.cards[boromir]!, resources: 1 } } }, made.ctx);
    expect(statOf(pooled, made.ctx.cards, alcaron, "attack")).toBe(3);
  });
});

describe("06068:A:1 and 06069:A:1 a location that leaves play", () => {
  it("06068:A:1 a location explored by a card effect from the staging area is explored too: the tokens go to Rescued Villagers and Dead Villagers gets none", () => {
    const made = table({ stage: protect, staging: [{ code: farmhouse, resources: 3 }, rescued, dead] });
    const done = runSettled(made, made.state, { verb: "PlaceProgressOn", amount: 9, target: "self" }, idOf(made.state, farmhouse));
    expect(villagers(done, rescued)).toBe(3);
    expect(damageOn(done, dead)).toBe(0);
  });

  it("06069:A:1 reading (recommended): the villager tokens of a location that leaves play unexplored are lost with it, no damage token is placed; the other reading, discarded with 1 damage token each, is not taken", () => {
    const made = table({ stage: protect, staging: [{ code: hamlet, resources: 3 }, rescued, dead] });
    const done = runSettled(made, made.state, { verb: "Discard", target: { kind: "self" } }, idOf(made.state, hamlet));
    // (Gondorian Hamlet has Victory 1: it goes to the victory display, which is no exploring.)
    expect(done.cards[idOf(done, hamlet)]?.zone).not.toBe("staging");
    expect(villagers(done, rescued)).toBe(0);
    expect(damageOn(done, dead)).toBe(0);
  });

  it("06069:A:1 a villager token that is discarded from a location by a card puts 1 damage token on Dead Villagers for each token (the tokens go back to the bank)", () => {
    const made = table({ stage: protect, active: { code: farmhouse, resources: 3 }, staging: [rescued, dead] });
    const done = runSettled(made, made.state, { verb: "DiscardVillagerTokens", from: "activeLocation", amount: 2 });
    expect(villagers(done, farmhouse)).toBe(1);
    expect(damageOn(done, dead)).toBe(2);
  });
});
