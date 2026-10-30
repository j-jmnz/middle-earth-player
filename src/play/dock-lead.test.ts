import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../rules/reduce.ts";

import type { TriggerSheet } from "./sheet-types.ts";
import { headerOf } from "./table-choice.ts";

// The dock draws no step overline, so a Response's or an Action's timing leads its title ("Response · Pathless Country").
const trigger = (timing: string, title: string): TriggerSheet => ({ kind: "trigger", key: "t", step: "Quest", title, sourceId: null, timing, note: null, hide: null, options: [], pass: null });
const solo = { seatCount: 1, activeSeat: 0 } as ScenarioState;
const two = { seatCount: 2, activeSeat: 1 } as ScenarioState;

describe("the dock title's lead", () => {
  it("is the timing of a Response or an Action, before the card's name", () => {
    expect(headerOf(trigger("Response", "Pathless Country"), solo).lead).toBe("Response · ");
    expect(headerOf(trigger("Action", "Gandalf"), solo).lead).toBe("Action · ");
  });

  it("keeps the seat first in two-handed play", () => {
    expect(headerOf(trigger("Response", "Pathless Country"), two).lead).toBe("Player 2 · Response · ");
  });

  it("does not say the timing twice when the title already is it", () => {
    expect(headerOf(trigger("Response", "Response"), solo).lead).toBe("");
  });

  it("is the seat alone for a question that is not a Response", () => {
    const pick = { kind: "pick", key: "p", step: "Combat", title: "Choose a defender", note: null, options: [], alternative: null } as unknown as Parameters<typeof headerOf>[0];
    expect(headerOf(pick, solo).lead).toBe("");
    expect(headerOf(pick, two).lead).toBe("Player 2 · ");
  });
});
