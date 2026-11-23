// Rules: hob.unconscious-characters, ltp.commit-characters (data/rules/entries.json). The settle sweep of the committed characters of Flies and Spiders (families/poison/quest.ts): an unconscious character and a poisoned one that
// Forest Stream bars leave the quest and add no Willpower; a character that cannot quest for any other reason stays as it is.
import { describe, expect, it } from "vitest";

import { addModifier } from "../../core/keywords.ts";
import { updateCard } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { spiderTable } from "../../../../test/scenarios/flies-and-spiders/scene.ts";
import { givePoison, makeUnconscious } from "./poison.ts";

describe("the committed characters that cannot quest any more (hob.unconscious-characters)", () => {
  const committed = (active?: string) => {
    const t = spiderTable({ seats: 1, ...(active ? { active } : {}) });
    const state = [t.hero, t.hero2].reduce((acc, hero) => updateCard(acc, hero, { committed: true }), t.state);
    return { t, state };
  };

  it("removes an unconscious character from the quest", () => {
    const { t, state } = committed();
    const out = settle(makeUnconscious(state, t.hero, t.ctx), t.ctx, []);
    expect(out.cards[t.hero]?.committed).toBe(false);
    expect(out.cards[t.hero2]?.committed).toBe(true);
  });

  it("removes a poisoned character that Forest Stream bars, and leaves a committed one with no poison", () => {
    const { t, state } = committed("132027");
    const out = settle(syncConstants(givePoison(state, t.hero, 1, t.ctx), t.ctx), t.ctx, []);
    expect(out.cards[t.hero]?.committed, "poisoned under Forest Stream").toBe(false);
    expect(out.cards[t.hero2]?.committed, "no poison").toBe(true);
  });

  it("leaves a character that cannot quest for another reason as it is", () => {
    const { t, state } = committed();
    const barred = addModifier(state, t.hero, "x", "cannotQuest", 1, "endOfRound");
    const out = settle(barred, t.ctx, []);
    expect(out.cards[t.hero]?.committed).toBe(true);
  });
});
