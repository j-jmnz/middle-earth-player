import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { vocabulary } from "./effects/vocabulary.ts";
import { ROOT } from "./paths.ts";

// The draft bundles list the schema's words. A verb declared through the verb() or codeVerb() helper is a verb too.
describe("effect vocabulary for the draft bundles", () => {
  const vocab = vocabulary();
  const source = readFileSync(path.join(ROOT, "src", "catalog", "effect-schema.ts"), "utf8");

  it("lists every verb the schema declares, through either helper or a literal", () => {
    const declared = new Set([
      ...[...source.matchAll(/verb: z\.literal\("(\w+)"\)/g)].map((match) => match[1]),
      ...[...source.matchAll(/(?:codeVerb|verb)\("(\w+)"\)/g)].map((match) => match[1]),
    ]);
    expect(new Set(vocab.verbs)).toEqual(declared);
    expect(vocab.verbs).toContain("AddSetAsideToStaging");
    expect(vocab.verbs).toContain("ShuffleEncounterDeck");
    expect(vocab.verbs).toContain("Choose");
  });

  it("lists conditions only, not cost or target kinds", () => {
    expect(vocab.conditions).toContain("inPlay");
    expect(vocab.conditions).not.toContain("exhaustSelf");
    expect(vocab.conditions).not.toContain("byCode");
    expect(vocab.costs).toContain("exhaustSelf");
  });

  it("lists the triggers, timings and ModifyStat words", () => {
    expect(vocab.triggers).toContain("revealed");
    expect(vocab.timings).toContain("constant");
    expect(vocab.stats).toContain("cannotAttack");
    expect(vocab.statTargets).toContain("attacker");
    expect(vocab.durations).toContain("whileSourceInPlay");
  });
});
