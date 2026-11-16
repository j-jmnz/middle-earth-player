import { describe, expect, it } from "vitest";

import { HERO, SAMPLES } from "./read-fields-samples.ts";
import { newCtx, type Obj } from "./kit.ts";
import { TEMPLATES } from "./verbs.ts";

// A key whose value in a sample reads as its absence does (the only value of `to` on Travel is "self"; `to: "play"` is what a MovePicked without `to` words; a FlipGollum without `to` words as its "gollum" side).
const SAME_EITHER_WAY = new Set(["Travel.to", "MovePicked[1].to", "FlipGollum[1].to"]);
// Keys that hold instructions: the renderer prints them beneath, not in the line.
const NESTED = new Set(["instructions", "options"]);

const textOf = (verb: string, ins: Obj): { text: string; read: readonly string[] } => {
  const made = TEMPLATES[verb]?.(ins, newCtx());
  if (!made) throw new Error(`${verb} has no template`);
  return made;
};

describe("effects render read fields", () => {
  it("has a sample for every verb with a template, and none for a verb without", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(TEMPLATES).sort());
  });

  it("prints every field a template says it reads, in each sample that sets it", () => {
    const hidden: string[] = [];
    for (const [verb, samples] of Object.entries(SAMPLES)) {
      samples.forEach((sample, index) => {
        const full = textOf(verb, sample);
        for (const key of full.read) {
          if (!(key in sample) || NESTED.has(key) || SAME_EITHER_WAY.has(`${verb}.${key}`) || SAME_EITHER_WAY.has(`${verb}[${index}].${key}`)) continue;
          const { [key]: _removed, ...rest } = sample;
          let without: string | null = null;
          try {
            without = textOf(verb, rest).text;
          } catch {
            // A template that cannot run without the key reads it for its text.
          }
          // Removing the key must change the text: otherwise the sample's value is not said.
          if (without === full.text) hidden.push(`${verb}[${index}].${key}`);
        }
      });
    }
    expect(hidden).toEqual([]);
  });

  it("claims for Restrict only the keys its branch says", () => {
    expect(textOf("Restrict", { verb: "Restrict", what: "advance" }).read).toEqual(["what"]);
    expect(textOf("Restrict", { verb: "Restrict", what: "travel" }).read).not.toContain("allies");
    expect(textOf("Restrict", { verb: "Restrict", what: "defend" }).read).not.toContain("location");
  });

  it("says the fields the review found dropped", () => {
    const say = (verb: string, ins: Obj) => textOf(verb, ins).text;
    expect(say("RaiseThreat", { verb: "RaiseThreat", who: "eachSeat", perCommitted: { type: "hero", exceptSphere: "fellowship" } })).toBe("raise threat by 1 (each player) for each non-fellowship hero committed to the quest");
    expect(say("MovePicked", { verb: "MovePicked", to: "hand", who: "firstPlayer" })).toContain("the first player's hand");
    expect(say("Delay", { verb: "Delay", until: "endOfRound", subject: "picked", instructions: [] })).toContain("the card last picked");
    expect(say("Each", { verb: "Each", pick: HERO, upTo: 2, totalCost: 5, instructions: [] })).toContain("adding up to at most 5");
  });
});
