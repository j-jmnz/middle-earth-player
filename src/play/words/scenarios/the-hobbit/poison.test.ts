// Rules: hob.venom-poison, hob.unconscious-characters (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { givePoison } from "../../../../rules/families/poison/poison.ts";
import { spiderTable } from "../../../../../test/scenarios/flies-and-spiders/scene.ts";
import { effectById } from "../../../../rules/windows/listen.ts";
import { askValues, type Ask } from "../../asks.ts";
import { poisonLine, unconsciousLine } from "./poison.ts";

describe("the poison lines", () => {
  it("tell the poison of the printed hit points, and leave the count out with no hit points", () => {
    expect(poisonLine("Bilbo Baggins", 1, 3)).toBe("Bilbo Baggins gets 1 poison (1 of 3)");
    expect(poisonLine("Bilbo Baggins", 1, 0)).toBe("Bilbo Baggins gets 1 poison");
  });

  it("tell a character made unconscious and one readied from it", () => {
    expect(unconsciousLine("Arwen", false)).toBe("Arwen is made unconscious");
    expect(unconsciousLine("Arwen", true)).toBe("Arwen is readied and no longer unconscious");
  });
});

describe("Forest Stream's countdown (132027:A:2)", () => {
  const entry: Ask = { note: "Discard ({countdown}).", countdown: { against: "poison" } };
  const said = (poison: number, again: number): string => {
    const t = spiderTable({ seats: 1 });
    const game = givePoison(t.state, t.hero, poison, t.ctx, []);
    const names = { card: (id: string) => id, code: (code: string) => code };
    // The Pick of the record's Repeat, and the 4 read from the record.
    const repeat = effectById(t.ctx, "132027:response:1")?.instructions.find((step) => step.verb === "Repeat");
    const instruction = repeat && repeat.verb === "Repeat" ? repeat.instructions[0] : undefined;
    if (!instruction) throw new Error("Forest Stream's Repeat is missing");
    return String(askValues({ game, ctx: t.ctx, names, instruction, effectId: "132027:response:1", source: null, options: [t.hero], again: () => again }, entry).values.countdown);
  };

  it("counts the discards of the four, this one included", () => {
    expect(said(5, 3)).toBe("1 of 4");
    expect(said(5, 0)).toBe("4 of 4");
  });

  it("counts against the poison that remains when it is fewer than the discards left", () => {
    expect(said(2, 3)).toBe("1 of 2");
    expect(said(1, 2)).toBe("2 of 2");
  });
});
