import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { CATALOG_FAMILIES, FAMILY_VERBS } from "../../catalog/families/index.ts";
import { simpleInstructionSchema } from "../../catalog/effect-schema-verbs.ts";
import { fixtureDefinition } from "../core/test-fixture.ts";
import { blankScenario } from "../core/state.ts";
import { rulesFamilies } from "../families/index.ts";

// Every verb a mechanic family declares (src/catalog/families) has a runner (src/rules/families), and every verb a runner answers is declared. An
// unhandled verb would fail only at play, as "Unimplemented instruction X" (rules/interpret/verbs.ts).
const declared: readonly string[] = FAMILY_VERBS.map((schema) => schema.shape.verb.value);
const answered: readonly string[] = rulesFamilies().flatMap((family) => family.verbs);

// Declared verbs no runner answers, because the code that reads the effect records finds them there and nothing executes them (a constant's marker).
// Each names the file that reads it; the test checks the file does.
const READ_AS_DATA: Record<string, string> = {
  FixedX: "src/rules/families/misc/cost.ts",
  GrantSecrecy: "src/rules/families/misc/cost.ts",
  VictoryLimit: "src/rules/families/sidequests/victory.ts",
  InPlayLimit: "src/rules/families/sidequests/play.ts",
  EncounterKeyword: "src/rules/families/sidequests/encounter.ts",
  CannotPlay: "src/rules/families/sidequests/contract.ts",
  ReduceFirstOnEachHero: "src/rules/families/sidequests/contract.ts",
  DeckRule: "src/catalog/deck-rules.ts",
  CountsAs: "src/rules/interpret/conditions.ts",
};

// Verbs a runner answers that the core schema (src/catalog/effect-schema-verbs.ts) declares, not a family.
const DECLARED_BY_CORE = ["ReduceNextCost", "ShuffleIntoEncounterDeck", "AttachSelf"];

describe("mechanic family manifests", () => {
  it("lists the same families on both sides, in the same order", () => {
    expect(rulesFamilies().map((family) => family.name)).toEqual(CATALOG_FAMILIES.map((family) => family.name));
  });

  it("declares no verb twice and no runner verb twice", () => {
    const twice = (names: readonly string[]) => names.filter((name, at) => names.indexOf(name) !== at);
    expect(twice(declared)).toEqual([]);
    expect(twice(answered)).toEqual([]);
  });

  it("gives every declared verb a runner, or names the file that reads it as data", () => {
    const missing = declared.filter((verb) => !answered.includes(verb) && !(verb in READ_AS_DATA));
    expect(missing).toEqual([]);
    for (const [verb, file] of Object.entries(READ_AS_DATA)) {
      expect(declared, verb).toContain(verb);
      expect(answered, verb).not.toContain(verb);
      expect(readFileSync(file, "utf8"), `${verb} in ${file}`).toContain(`"${verb}"`);
    }
  });

  it("declares every verb a runner answers", () => {
    const coreVerbs = new Set<string>(simpleInstructionSchema.options.map((schema) => schema.shape.verb.value));
    const undeclared = answered.filter((verb) => !declared.includes(verb) && !DECLARED_BY_CORE.includes(verb));
    expect(undeclared).toEqual([]);
    for (const verb of DECLARED_BY_CORE) {
      expect(coreVerbs.has(verb), verb).toBe(true);
      expect(declared, verb).not.toContain(verb);
      expect(answered, verb).toContain(verb);
    }
  });

  // A runner answers a verb when it does not return null for it. An instruction with no fields is refused by most verbs' own code with a throw or a
  // state, which still shows the runner took the verb; only null means it did not.
  it("has each runner take every verb its manifest lists", () => {
    const state = blankScenario({ seatCount: 1, seed: 4, definition: fixtureDefinition(["stage"]) });
    const ctx = { effects: [], cards: new Map() };
    const notTaken: string[] = [];
    for (const family of rulesFamilies()) {
      for (const verb of family.verbs) {
        try {
          if (family.run(state, { verb } as unknown as Instruction, { seat: 0, sourceId: null }, ctx, []) === null) notTaken.push(`${family.name}: ${verb}`);
        } catch {
          // Reached the verb's own code.
        }
      }
    }
    expect(notTaken).toEqual([]);
  });
});
