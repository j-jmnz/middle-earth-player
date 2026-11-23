// Rules: hob.venom-poison, hob.unconscious-characters (data/rules/entries.json). The table pieces of poison and the unconscious state: the pill on a poisoned character, the 180 degree turn of an unconscious one.
import { describe, expect, it } from "vitest";

import { slotOf } from "../layout/slots.ts";
import { slotRotation } from "../motion/motion.ts";
import { givePoison, makeUnconscious } from "../../rules/families/poison/poison.ts";
import { spiderTable } from "../../../test/scenarios/flies-and-spiders/scene.ts";
import { poisonMark } from "./poison.ts";

const rect = { x: 0, y: 0, w: 60, h: 84 };

describe("the poison of a character on the table", () => {
  it("is a pill with its poison against its hit points, red when one more makes it unconscious, and silent with none", () => {
    const t = spiderTable({ seats: 1 });
    expect(poisonMark(t.state, t.ctx, t.hero)).toBeNull();
    const hit = t.cards.get(t.state.cards[t.hero]?.code ?? "")?.health ?? 0;
    const some = givePoison(t.state, t.hero, 2, t.ctx, []);
    expect(poisonMark(some, t.ctx, t.hero)).toMatchObject({ text: `2/${hit} poison`, loses: false, count: 2 });
    const near = givePoison(t.state, t.hero, hit - 1, t.ctx, []);
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
});
