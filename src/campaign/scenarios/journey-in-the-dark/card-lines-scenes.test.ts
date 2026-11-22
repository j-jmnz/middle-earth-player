// Rules: mec109.setup, mec109.setup-journey-in-the-dark, rr.burdens, rr.campaign-cards, rr.winning-the-game, rr.attachment-cards (data/rules/entries.json).
// Lines: 142087:A:1, 142088:A:1, 142039:A:2, 142042:B:3, 906502:A:1. The Journey in the Dark lines a single card-spec row cannot show (card-lines.test.ts holds the rows): the Setup lines, the win of the last
// stage, the attachments Slab-bearer refuses. Each runs again with the records of its line removed (test/harness/card-spec.ts, withoutLine), where it must not hold, except 142042:B:3, whose record holds no step.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { quest, rowProblems, withoutLine, won, zone } from "../../../../test/harness/card-spec.ts";
import { first, idOf, resolveRecords, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const ID = "journey-in-the-dark";
const without = (...lines: string[]): readonly Effect[] => lines.reduce(withoutLine, EFFECTS);
const make = (layout: Layout, effects: readonly Effect[] = EFFECTS): LayoutTable => tableFromLayout(ID, layout, { effects });
const zonesOf = (state: ScenarioState, code: string): string[] => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone).sort();

describe("142087 Overcome by Grief and 142088 Grievous Wound", () => {
  // "Setup: Add Overcome by Grief to the staging area." (Grievous Wound the same.) The card's own Setup runs for the copy a Setup search found in the encounter deck, set aside while it resolves (mec109.setup): that
  // copy, and no second one, goes to the staging area.
  for (const [code, line] of [["142087", "142087:A:1"], ["142088", "142088:A:1"]] as const) {
    it(`${line} its Setup puts the copy found into the staging area, and makes no second copy`, () => {
      const setUp = (effects: readonly Effect[]): string[] => {
        const made = make({ setAside: [code] }, effects);
        return zonesOf(resolveRecords(made.state, made.ctx, code, "setup", idOf(made.state, code)).state, code);
      };
      expect(setUp(EFFECTS)).toEqual(["staging"]);
      expect(setUp(without(line))).toEqual(["setAside"]);
    });
  }
});

describe("142039 Journey in the Dark (campaign card)", () => {
  // A:2 "Setup: Shuffle the burden treachery cards Pursued by the Enemy and Shadow of Fear, into the encounter deck. Add the burden objective cards Grievous Wound and Overcome by Grief to the staging area."
  it("142039:A:2 shuffles one Pursued by the Enemy and one Shadow of Fear into the encounter deck and puts one Grievous Wound and one Overcome by Grief into the staging area", () => {
    const setUp = (effects: readonly Effect[]) => {
      const made = make({ campaign: true, deck: ["f0", "f0", "f0"] }, effects);
      const source = first(made.state, "142039") || undefined;
      const state = resolveRecords(made.state, made.ctx, "142039", "campaignSetup", source).state;
      return ["142086", "142085", "142088", "142087"].map((code) => zonesOf(state, code));
    };
    expect(setUp(EFFECTS)).toEqual([["encounterDeck"], ["encounterDeck"], ["staging"], ["staging"]]);
    expect(setUp(without("142039:A:2"))).toEqual([[], [], [], []]);
  });
});

describe("142042 The Bridge of Khazad-dûm", () => {
  // B:3 "If the players defeat this stage, they win the game." It is the last stage, so the engine ends the game as a win by its own rule (rr.winning-the-game): the record holds no step, and the game is won
  // without it too. With The Great Bridge gone the heroes (4 Willpower) quest the last progress onto it.
  it("142042:B:3 defeating the stage with The Great Bridge out of play wins the game", () => {
    expect(rowProblems(ID, { line: "142042:B:3", layout: { stage: "142042", progress: 14 }, act: quest("success"), expect: won }, EFFECTS)).toEqual([]);
    expect(rowProblems(ID, { line: "142042:B:3", layout: { stage: "142042", progress: 14, victory: ["142050"] }, act: quest("success"), expect: [won, zone("142050", "victory")] }, EFFECTS)).toEqual([]);
  });
});

describe("906502 Slab-bearer", () => {
  // A:1 "Cannot have attachments."
  it("906502:A:1 an attachment cannot be attached to it", () => {
    const made = make({ staging: ["906502"] });
    expect(attachBlocked(made.state, made.ctx, idOf(made.state, "906502"), "attachment")).toBe(true);
    const bare = make({ staging: ["906502"] }, without("906502:A:1"));
    expect(attachBlocked(bare.state, bare.ctx, idOf(bare.state, "906502"), "attachment")).toBe(false);
  });
});
