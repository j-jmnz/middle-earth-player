// Rules: rr.the-word-choose (data/rules/entries.json); ledger lines 142021:B:2, 906404:A:1, 900303:A:3, 141070:A:2, 142043:A:2, 142064:B:3, 142079:A:1.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { walk } from "../../../test/harness/record-walk.ts";

import { pickWords, type ChoiceNames } from "./choice.ts";

const names: ChoiceNames = { card: (id) => id, code: (code) => `<${code}>` };

// The prompt of every Pick of a record, in order.
function prompts(id: string): string[] {
  const out: string[] = [];
  const record = EFFECTS.find((effect) => effect.id === id);
  expect(record, id).toBeDefined();
  walk(record?.instructions ?? [], (instruction, next, after) => {
    if (instruction.verb === "Pick") out.push(pickWords(instruction, next, names, record?.cardCode ?? null, 2, undefined, undefined, after).prompt);
    if (instruction.verb === "AttachSelf") out.push(pickWords(instruction, next, names, record?.cardCode ?? null).prompt);
  });
  return out;
}

describe("the picks that said only 'Choose a location.' or 'Choose an enemy.'", () => {
  it("say which active location takes the damage, and how much", () => {
    expect(prompts("142021:forced:1")).toEqual(["Choose an active location to place 1 damage on."]);
    expect(prompts("906404:whenRevealed:1")).toEqual(["Choose an active location to place 2 damage on.", "Choose the other active location to place 2 damage on."]);
  });

  it("say what the attacking enemy is picked for (900303:A:3)", () => {
    expect(prompts("900303:shadow:1")).toEqual(["Choose the attacking enemy. If it is not defeated this phase, raise your threat by 7 at the end of the phase."]);
  });

  it("name the Nazgûl an attachment lies on, the Balrog, the player who readies and the enemy that engages", () => {
    expect(prompts("141070:whenRevealed:1")).toEqual(["Choose a Nazgûl enemy in play to attach 141070 to."]);
    expect(prompts("142043:forced:2")).toEqual(["Choose The Balrog to attack from the staging area."]);
    expect(prompts("142064:response:1")).toEqual(["Choose the player whose heroes all ready."]);
    expect(prompts("142079:travel:1")).toEqual(["Choose an enemy in any staging area. It engages you."]);
  });
});
