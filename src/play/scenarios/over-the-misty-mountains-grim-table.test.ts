// Rules: hob.bilbo-baggins-ohauh, hob.baggins-sphere-ohauh, rr.the-word-choose, rr.first-player (data/rules/entries.json); ledger line 131028:B:2.
// What the table says at the choice of X on Down, Down to Goblin Town: the sheet of the live window (not the entry alone) says what X is, the resources Bilbo Baggins holds, and what each number buys.
// The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { settle } from "../../rules/engine/machine.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { idOf, legalIntents, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";

const names = (state: ScenarioState): SheetNames => ({ card: (id) => state.cards[id]?.code ?? id, line: (line) => `line ${line}` });

// The stage 3 reveal with Bilbo Baggins (a hero of the first seat) holding `resources`, stopped on the window that asks for X.
function xSheet(resources: number, seats: 1 | 2): PickSheet | null {
  const made = tableFromLayout("over-the-misty-mountains-grim", { stage: "131028", seats, setAside: ["131063", "131058", "131058", "131058", "131058", "131058"] });
  const spawned = spawn(made.state, "131001", { zone: "heroes", seat: 0 });
  const state = syncConstants(updateCard(spawned.state, spawned.id, { resources }), made.ctx);
  // The records of the stage push one frame and the window is left open, as the table meets it.
  const steps: EngineStep[] = [];
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === "131028" && effect.timing === "whenRevealed");
  const pushed = pushCardEffects(state, "whenRevealed", idOf(state, "131028"), state.firstPlayer, false, effects, made.ctx, steps);
  const open = settle({ ...pushed, window: null, mode: "stopped" as const }, made.ctx, steps);
  expect(open.window?.kind).toBe("choose");
  return sheetFor(open, made.ctx, legalIntents(open, made.ctx), names(open)) as PickSheet | null;
}

// The sheet of the choice a card's records of `timing` open, on a table where the card is in the staging area.
function sheetOf(code: string, timing: "whenRevealed" | "forced" | "shadow", seats: 1 | 2, layout: Layout = {}, zone = "staging"): PickSheet | null {
  const made = tableFromLayout("over-the-misty-mountains-grim", { stage: "131027", seats, phase: "Quest", ...layout });
  const steps: EngineStep[] = [];
  const id = spawn(made.state, code, { zone: zone as "staging" });
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const frame = timing === "whenRevealed" ? "whenRevealed" : timing === "shadow" ? "shadow" : "forced";
  const pushed = pushCardEffects(id.state, frame, id.id, id.state.firstPlayer, false, effects, made.ctx, steps);
  const open = settle({ ...pushed, window: null, mode: "stopped" as const }, made.ctx, steps);
  expect(open.window?.kind).toBe("choose");
  return sheetFor(open, made.ctx, legalIntents(open, made.ctx), names(open)) as PickSheet | null;
}

describe("the encounter choices name their owner and the full effect", () => {
  it("131061:A:1 Goblin Driver: the first player chooses a character he controls to exhaust", () => {
    expect(sheetOf("131061", "whenRevealed", 2)?.note).toContain("Player 1: 131061: choose a character you control to exhaust.");
    expect(sheetOf("131061", "whenRevealed", 1)?.note).toContain("131061: choose a character you control to exhaust.");
  });

  it("131061:A:2 Goblin Driver Shadow: the defending player chooses a character he controls to exhaust", () => {
    expect(sheetOf("131061", "shadow", 2)?.note).toContain("choose a character you control to exhaust.");
  });

  it("131072:A:1 Galloping Boulders says the character takes 3 damage and leaves the quest", () => {
    const sheet = sheetOf("131072", "whenRevealed", 2, { committed: ["dh1", "dh2"] });
    expect(sheet?.note).toContain("choose a character committed to the quest. It takes 3 damage and is removed from the quest.");
    expect(sheet?.note).toMatch(/^Player 1: /);
  });

  it("131064:A:2 Stone-Giant says it engaged you and that you discard an ally you control", () => {
    expect(sheetOf("131064", "forced", 1, { play: ["ally", "ally"] })?.note).toContain("it engaged you. Choose an ally you control to discard.");
  });

  it("131067:A:1 Great Cavern Room says you engaged a Goblin and take 1 damage on a character you control", () => {
    expect(sheetOf("131067", "forced", 1, {}, "activeLocation")?.note).toContain("you engaged a Goblin enemy. Choose a character you control to take 1 damage.");
  });
});

describe("the choice of X on Down, Down to Goblin Town", () => {
  it("131028:B:2 says what X is and what each number buys, each row from the resources Bilbo holds", () => {
    const sheet = xSheet(2, 1);
    expect(sheet?.note).toBe("Down, Down to Goblin Town: choose X, from 0 to 2, the resources in Bilbo Baggins' pool. Bilbo spends X resources, and the players reveal 3 encounter cards less X, and at least 1. line 131028:B:2");
    expect(sheet?.options?.map((option) => option.label)).toEqual(["Spend 0: reveal 3 cards", "Spend 1: reveal 2 cards", "Spend 2: reveal 1 card"]);
  });

  it("131028:B:2 names the player who chooses and reveals 3 for each player two-handed", () => {
    const sheet = xSheet(3, 2);
    expect(sheet?.note).toBe("Player 1: Down, Down to Goblin Town: choose X, from 0 to 3, the resources in Bilbo Baggins' pool. Bilbo spends X resources, and the players reveal 6 encounter cards less X, and at least 1. line 131028:B:2");
    expect(sheet?.options?.map((option) => option.label)).toEqual(["Spend 0: reveal 6 cards", "Spend 1: reveal 5 cards", "Spend 2: reveal 4 cards", "Spend 3: reveal 3 cards"]);
  });
});
