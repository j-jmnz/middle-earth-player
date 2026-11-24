// Rules: rr.step-6-4-3, rr.replacement-effects, rr.forced, rr.response, ats.villager-tokens-discarded (data/rules/entries.json).
// Protect the Villagers (stage 2, 06067:B:1): an undefended attack is aimed at Rescued Villagers and its damage is discarded villager tokens, not damage on a hero. Each attack here is a real one (the enemy attacks the first seat, the defender is no one), through the combat steps of the engine.
import { describe, expect, it } from "vitest";

import { fightEnemy, idOf, legalIntents, send } from "../../../../test/harness/scene-kit.ts";
import { CODES, damageOn, table, undefendedAtRescued, villagers } from "../../../../test/scenarios/encounter-at-amon-din/table.ts";

const { protect, rescued, dead, alcaron, hamlet, marauding, ghulat } = CODES;

// Marauding Orc (Attack 4) engaged with the first seat; Rescued Villagers holds `tokens` villager tokens.
const orc = (tokens: number, extra: Parameters<typeof table>[0] = {}) => table({ phase: "Encounter", stage: protect, engaged: [{ code: marauding, seat: 0 }], staging: [{ code: rescued, resources: tokens }, dead], deck: ["f0", "f0"], ...extra });
const heroDamage = (made: ReturnType<typeof orc>, state: ReturnType<typeof orc>["state"]): number[] => [made.hero, made.hero2].map((id) => state.cards[id]?.damage ?? 0);

describe("06067:B:1 the undefended attack discards villager tokens", () => {
  it("06067:B:1 an undefended attack of 4 discards 4 villager tokens from Rescued Villagers, 1 damage token on Dead Villagers for each, and damages no hero", () => {
    const made = orc(6);
    const done = undefendedAtRescued(made).state;
    expect(villagers(done, rescued)).toBe(2);
    expect(damageOn(done, dead)).toBe(4);
    expect(heroDamage(made, done)).toEqual([0, 0]);
    expect(damageOn(done, rescued)).toBe(0);
  });

  it("06067:B:1 with fewer villager tokens than the damage, all of them are discarded (1 of 4) and Dead Villagers gets 1 damage token only", () => {
    const made = orc(1);
    const done = undefendedAtRescued(made).state;
    expect(villagers(done, rescued)).toBe(0);
    expect(damageOn(done, dead)).toBe(1);
    expect(heroDamage(made, done)).toEqual([0, 0]);
  });

  it("06067:B:1 with no villager token on Rescued Villagers nothing is discarded and no hero takes the damage (reading to confirm: the damage is replaced by a discard of none)", () => {
    const made = orc(0);
    const done = undefendedAtRescued(made).state;
    expect(villagers(done, rescued)).toBe(0);
    expect(damageOn(done, dead)).toBe(0);
    expect(heroDamage(made, done)).toEqual([0, 0]);
  });

  it("06067:B:1 each discarded token is announced: Dead Villagers has all 4 damage tokens when Lord Alcaron is offered his Response, and his Response puts one token back on a location", () => {
    const made = orc(6, { staging: [{ code: rescued, resources: 6 }, dead, hamlet], play: [alcaron] });
    const offered = undefendedAtRescued(made, (state) => state.window?.kind === "response");
    expect(offered.state.window?.kind).toBe("response");
    expect(damageOn(offered.state, dead)).toBe(4);
    const use = legalIntents(offered.state, made.ctx).find((intent) => intent.type === "Trigger");
    expect(use).toBeDefined();
    let run = send(offered, use as never, made.ctx);
    if (run.state.window?.kind === "choose") run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
    expect(run.state.cards[idOf(run.state, alcaron)]?.exhausted).toBe(true);
    expect(villagers(run.state, hamlet)).toBeGreaterThanOrEqual(1);
    expect(villagers(run.state, rescued)).toBe(2);
    expect(damageOn(run.state, dead)).toBe(4);
  });

  it("06067:B:1 with no token to discard no Response is offered to Lord Alcaron", () => {
    const made = orc(0, { staging: [rescued, dead, hamlet], play: [alcaron] });
    const done = undefendedAtRescued(made, (state) => state.window?.kind === "response");
    expect(done.state.window?.kind).not.toBe("response");
  });

  it("06067:B:1 a defended attack is not changed: the defending hero takes the damage and no villager token is discarded", () => {
    const fight = fightEnemy((layout) => orc(5, layout), "f0", marauding, {});
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBe(2);
    expect(villagers(fight.run.state, rescued)).toBe(5);
    expect(damageOn(fight.run.state, dead)).toBe(0);
  });

  it("06067:B:1 Ghulat's undefended attack counts the damage token his Forced effect placed first: with 2 on Dead Villagers his Attack is 3 and 3 tokens are discarded", () => {
    const made = table({ phase: "Encounter", stage: protect, engaged: [{ code: ghulat, seat: 0 }], staging: [{ code: rescued, resources: 6 }, { code: dead, damage: 2 }], deck: ["f0", "f0"] });
    const done = undefendedAtRescued(made).state;
    // Forced first (Dead 3), then the Attack of 3 discards 3 tokens (Dead 6).
    expect(villagers(done, rescued)).toBe(3);
    expect(damageOn(done, dead)).toBe(6);
    expect(heroDamage(made, done)).toEqual([0, 0]);
  });
});
