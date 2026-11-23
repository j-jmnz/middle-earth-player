// Rules: hob.venom-poison, hob.unconscious-characters (data/rules/entries.json). The table pieces of poison and the unconscious state: the pill on a poisoned character, the 180 degree turn of an unconscious one.
import { describe, expect, it } from "vitest";

import { cardRect, footprint, slotOf } from "../layout/slots.ts";
import { isExhausted, updateCard } from "../../rules/core/state.ts";
import { slotRotation } from "../motion/motion.ts";
import { givePoison, makeUnconscious } from "../../rules/families/poison/poison.ts";
import { spiderTable } from "../../../test/scenarios/flies-and-spiders/scene.ts";
import { poisonMark } from "./poison-mark.ts";

const rect = { x: 0, y: 0, w: 60, h: 84 };

describe("the poison of a character on the table", () => {
  it("is a pill with its poison against its hit points, red when one more makes it unconscious, and silent with none", () => {
    const t = spiderTable({ seats: 1 });
    expect(poisonMark(t.state, t.ctx, t.hero)).toBeNull();
    const hit = t.cards.get(t.state.cards[t.hero]?.code ?? "")?.health ?? 0;
    const some = givePoison(t.state, t.hero, 2, t.ctx);
    expect(poisonMark(some, t.ctx, t.hero)).toMatchObject({ text: `2/${hit} poison`, loses: false, count: 2 });
    const near = givePoison(t.state, t.hero, hit - 1, t.ctx);
    expect(poisonMark(near, t.ctx, t.hero)?.loses).toBe(true);
  });

  it("says Unconscious for a character turned upside down, which is no sideways exhausted card", () => {
    const t = spiderTable({ seats: 1 });
    const down = makeUnconscious(t.state, t.hero, t.ctx);
    expect(poisonMark(down, t.ctx, t.hero)?.text).toBe("Unconscious");
    const slot = slotOf(down.cards[t.hero]!, "heroes" as never, "card" as never, rect);
    expect(slot).toMatchObject({ unconscious: true, exhausted: false });
    expect(slotRotation(slot)).toBe(Math.PI);
    expect(slotRotation(slotOf(t.state.cards[t.hero]!, "heroes" as never, "card" as never, rect))).toBe(0);
  });

  it("takes the footprint of an upright card, not the sideways footprint of an exhausted one, and is not exhausted for the table's readers", () => {
    const t = spiderTable({ seats: 1 });
    const size = { w: 60, h: 84 };
    const down = makeUnconscious(t.state, t.hero, t.ctx);
    expect(down.cards[t.hero]?.exhausted, "unconscious is also exhausted in the state").toBe(true);
    expect(isExhausted(down.cards[t.hero]!)).toBe(false);
    expect(footprint(down.cards[t.hero]!, size)).toBe(size.w);
    expect(cardRect(down.cards[t.hero]!, 10, 0, size).x).toBe(10);
    const tired = updateCard(t.state, t.hero, { exhausted: true });
    expect(isExhausted(tired.cards[t.hero]!)).toBe(true);
    expect(footprint(tired.cards[t.hero]!, size)).toBe(size.h);
  });
});
