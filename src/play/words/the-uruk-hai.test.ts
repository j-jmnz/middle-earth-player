// Rules: rr.the-word-choose, mec112.setup-the-uruk-hai, rr.damage (data/rules/entries.json); ledger lines 143069:A:1, 143030:A:1, 143063:A:2, 143024:A:1. The words of The Uruk-hai's own choices (src/play/words/asks/the-uruk-hai.ts) as the sheet reads them.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { CODES, haiTable, loadHaiWorld, type HaiWorld } from "../../../test/scenarios/the-uruk-hai/scene.ts";
import { ASKS_BY_SCENARIO } from "./asks/index.ts";
import { asksOption, asksPick } from "./asks.ts";
import type { ChoiceNames } from "./choice.ts";

let world: HaiWorld;
beforeAll(async () => {
  world = await loadHaiWorld();
});

const table = ASKS_BY_SCENARIO["the-uruk-hai"]!;
const names: ChoiceNames = { card: (key) => key, code: (code) => code };
const record = (id: string) => EFFECTS.find((effect) => effect.id === id)!;
const chooseOf = (id: string) => record(id).instructions[0] as Extract<Instruction, { verb: "Choose" }>;

describe("the words of The Uruk-hai's choices", () => {
  it("says what each damage branch does: Rest by Night? hurts each committed character, Isengard Uruk assigns 3 damage among yours (143030:A:1, 143063:A:2)", () => {
    const t = haiTable(world);
    for (const [id, optionId, label] of [
      ["143030:whenRevealed:1", "damage", "Deal 1 damage to each character committed to the quest"],
      ["143063:whenRevealed:1", "damage", "Assign 3 damage among your characters"],
    ] as const) {
      const instruction = chooseOf(id);
      expect(asksOption({ game: t.state, ctx: t.ctx, names, instruction, source: record(id).cardCode, effectId: id }, optionId, table)?.label).toBe(label);
    }
  });

  it("counts the damage an Isengard Uruk assigns, one at a time (\"1 of 3\", \"2 of 3\")", () => {
    const t = haiTable(world);
    const assign = (chooseOf("143063:whenRevealed:1").options.find((option) => option.id === "damage")?.instructions[0])!;
    if (assign.verb !== "AssignDamage") throw new Error("the damage branch assigns damage");
    const prompt = (left: number) => asksPick({ game: t.state, ctx: t.ctx, names, instruction: { ...assign, left, of: 3 }, source: CODES.isengardUruk, effectId: "143063:whenRevealed:1" }, table)?.prompt;
    expect(prompt(3)).toBe("Assign 1 damage to a character you control (1 of 3).");
    expect(prompt(2)).toBe("Assign 1 damage to a character you control (2 of 3).");
    expect(prompt(1)).toBe("Assign 1 damage to a character you control (3 of 3).");
  });

  it("gives the Captive the player chooses at Setup a reason that names the log in a campaign and the player's choice in standalone, and says the text box is blank", () => {
    const pick = ((record("143069:setup:1").instructions[0] as Extract<Instruction, { verb: "ForEachPlayer" }>).instructions[0])!;
    const said = (campaign: boolean) => {
      const t = haiTable(world, { campaign });
      return asksPick({ game: t.state, ctx: t.ctx, names, instruction: pick, source: CODES.stage1, effectId: "143069:setup:1" }, table)?.prompt ?? "";
    };
    expect(said(true)).toContain("the Campaign Log names no Captive of yours.");
    expect(said(false)).toContain("you choose your Captive.");
    for (const prompt of [said(true), said(false)]) expect(prompt).toContain("its text box is blank and no one controls it");
  });

  it("asks no question for the Captive the Campaign Log names or for the Captive Grishnákh holds: neither has a Pick (143069:A:1, 143024:A:2)", () => {
    const setup = (record("143069:setup:1").instructions[0] as Extract<Instruction, { verb: "ForEachPlayer" }>).instructions;
    expect(setup.filter((instruction) => instruction.verb === "Pick")).toHaveLength(1);
    expect(setup.find((instruction) => instruction.verb === "TakeCaptive" && instruction.logged === true)).toBeDefined();
    expect(record("143024:forced:3").instructions.map((instruction) => instruction.verb)).toEqual(["Each"]);
  });
});
