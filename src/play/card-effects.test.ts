import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { addModifier, modifiedStat } from "../rules/keywords.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { starterStart, starterWorld } from "../../scripts/starter-game.ts";

import { cardEffects, effectLines } from "./card-effects.ts";

// Rules: rr.modifiers (data/rules/entries.json). The table shows on the card each printed number an effect changed, by how
// much, and each "cannot"; the preview words them with the card they come from.
let ctx: ReduceContext;
let kept: ScenarioState;

beforeAll(async () => {
  ctx = (await starterWorld("stealth-and-steadfastness")).ctx;
  kept = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 1), ctx), { type: "Keep" }, ctx)).state;
});

describe("effects on a card", () => {
  it("show nothing for a card no effect touches, and a constant effect of the card's own text", () => {
    const [, sam = "", merry = ""] = kept.seats[0].heroes;
    expect(cardEffects(kept, ctx, sam)).toEqual({ stats: [], flags: [] });
    // Merry (141003) gets +1 attack for each Hobbit hero his controller has: three, with Frodo and Sam.
    const hero = kept.cards[merry];
    expect(cardEffects(kept, ctx, merry).stats).toEqual([{ stat: "attack", icon: "attack", word: "Attack", value: hero ? modifiedStat(kept, hero, "attack", ctx.cards) : -1, delta: 3 }]);
    expect(effectLines(kept, ctx, merry, () => "Merry")).toEqual(["+3 Attack from its own text, while it is in play"]);
  });

  it("show each changed number with the engine's value and the change, and each cannot", () => {
    const [frodo = "", sam = ""] = kept.seats[0].heroes;
    let state = addModifier(kept, sam, frodo, "attack", 2, "endOfPhase");
    state = addModifier(state, sam, frodo, "willpower", -1, "endOfRound");
    state = addModifier(state, sam, frodo, "cannotAttack", 1, "endOfPhase");
    const hero = state.cards[sam];
    const effects = cardEffects(state, ctx, sam);
    expect(effects.stats.map((badge) => [badge.stat, badge.delta])).toEqual([
      ["willpower", -1],
      ["attack", 2],
    ]);
    expect(effects.stats.find((badge) => badge.stat === "attack")?.value).toBe(hero ? modifiedStat(state, hero, "attack", ctx.cards) : -1);
    expect(effects.flags.map((flag) => flag.word)).toEqual(["Cannot attack"]);
    expect(effectLines(state, ctx, sam, () => "Frodo Baggins")).toEqual([
      "+2 Attack from Frodo Baggins, until the end of the phase",
      "-1 Willpower from Frodo Baggins, until the end of the round",
      "Cannot attack: Frodo Baggins, until the end of the phase",
    ]);
  });
});
