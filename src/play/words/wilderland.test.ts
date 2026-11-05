import { describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { cardMap, hero, idleScenario } from "../../rules/core/test-fixture.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { pushEffectFrame } from "../../rules/interpret/effect-frames.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";

import { sheetFor } from "../choice/sheets.ts";
import type { SheetNames } from "../choice/sheet-types.ts";
import { wilderlandAsk, wilderlandOptionLabel } from "./wilderland.ts";

// Rules: emce.treasure, rr.guarded (data/rules/entries.json). What the choice sheet says when the players look at random undiscovered treasures: each option is the treasure's title and
// its picture, and the sentence names the card that guards it.
const cards = cardMap([
  hero("frodo", "lore"),
  definePrinted({ code: "stage", name: "Stage", type: "quest" }),
  definePrinted({ code: "hall", name: "Twilight Hall", type: "location", threat: 2, questPoints: 3 }),
  ...["a", "b", "c", "d"].map((code) => definePrinted({ code: `t${code}`, name: `Treasure ${code.toUpperCase()}`, type: "treasure", campaignKind: "treasure" })),
]);
const ctx = { effects: [], cards };
const ATTACH: Instruction = { verb: "AttachRandomTreasure" };
const names = (): SheetNames => ({ card: (id) => cards.get(id)?.name ?? id, facedown: (id) => id, line: () => null });
const words = { card: (id: string) => (id === "hall-id" ? "Twilight Hall" : id), code: (code: string) => cards.get(code)?.name ?? code, traits: () => [] };

function asked(): ScenarioState {
  let state: ScenarioState = { ...idleScenario(1), seed: 5 };
  state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
  const guard = spawn(state, "hall", { zone: "staging" });
  return settle(pushEffectFrame(guard.state, { frame: "whenRevealed", sourceId: guard.id, actor: 0, peril: false, effectId: "hall:whenRevealed:1", instructions: [ATTACH], cancel: null, blockCancel: null }, []), ctx, []);
}

describe("the treasure choice", () => {
  it("names the guard in its sentence and asks for one of the treasures", () => {
    expect(wilderlandAsk(ATTACH, "hall-id", words)).toEqual({
      verb: "Attach",
      prompt: "Choose 1 of 3 random undiscovered treasures to attach as a guarded objective. Twilight Hall is attached to it, and the players cannot claim it until Twilight Hall is dealt with.",
    });
    // With no card to name, the sentence stands alone.
    expect(wilderlandAsk({ verb: "AttachRandomTreasure", count: 2 }, null, words)?.prompt).toBe("Choose 1 of 2 random undiscovered treasures to attach as a guarded objective.");
    expect(wilderlandAsk({ verb: "Draw" }, "hall-id", words)).toBeNull();
  });

  it("labels each option with the treasure's title, and no other instruction's", () => {
    expect(wilderlandOptionLabel(ATTACH, "ta", words)).toBe("Treasure A");
    expect(wilderlandOptionLabel({ verb: "Draw" }, "ta", words)).toBeNull();
  });

  it("shows the sheet three tiles titled by the treasure, each with its picture", () => {
    const state = asked();
    const sheet = sheetFor(state, ctx, legalIntents(state, ctx), names());
    if (sheet?.kind !== "pick") throw new Error("expected a pick sheet");
    expect(sheet.options).toHaveLength(3);
    expect(sheet.options.map((option) => option.label).every((label) => /^Treasure [A-D]$/.test(label))).toBe(true);
    expect(sheet.options.map((option) => option.code)).toEqual(sheet.options.map((option) => option.id));
    expect(sheet.note).toContain("Choose 1 of 3 random undiscovered treasures to attach as a guarded objective.");
  });
});
