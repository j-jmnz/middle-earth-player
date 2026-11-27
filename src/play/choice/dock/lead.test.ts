import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/engine/reduce.ts";

import type { TriggerSheet } from "../sheet-types.ts";
import { headerOf } from "../table-choice.ts";
import { lineCount } from "./armed-room.ts";
import { planWords, TITLE_CHAR_PT, TITLE_PX } from "./budget.ts";

// The dock draws no step overline, so a Response's or an Action's timing leads its title ("Response · Pathless Country").
const trigger = (timing: string, title: string): TriggerSheet => ({ kind: "trigger", key: "t", step: "Quest", title, sourceId: null, timing, note: null, hide: null, options: [], pass: null });
const solo = { seatCount: 1, activeSeat: 0 } as ScenarioState;
const two = { seatCount: 2, activeSeat: 1 } as ScenarioState;

describe("the dock title's lead", () => {
  it("names the timing of a Response or an Action after the card's name", () => {
    expect(headerOf(trigger("Response", "Pathless Country"), solo)).toMatchObject({ lead: "", title: "Pathless Country · Response" });
    expect(headerOf(trigger("Action", "Gandalf"), solo)).toMatchObject({ lead: "", title: "Gandalf · Action" });
  });

  it("keeps the seat first in two-handed play", () => {
    expect(headerOf(trigger("Response", "Pathless Country"), two)).toMatchObject({ lead: "Player 2 · ", title: "Pathless Country · Response" });
  });

  it("does not say the timing twice when the title already is it", () => {
    expect(headerOf(trigger("Response", "Response"), solo)).toMatchObject({ lead: "", title: "Response" });
  });

  it("keeps the whole card name in the lines a short screen leaves the title, two-handed (667x375, a dock 198 pt wide)", () => {
    const name = "Pathless Country";
    const header = headerOf(trigger("Response", name), two);
    const words = header.lead + header.title;
    // The title keeps one line in the worst dock and two where the rows leave room: the name and the seat fit the first two lines, so a cut only takes the timing.
    expect(lineCount(header.lead + name, Math.floor(198 / TITLE_CHAR_PT))).toBeLessThanOrEqual(2);
    const plan = planWords({ space: 2 * TITLE_PX, dense: true, clamp: true, title: words, textWidth: 198, hasLine: false, foldable: true });
    expect(plan.titleLines).toBe(2);
    expect(lineCount(header.lead + name, Math.floor(198 / TITLE_CHAR_PT))).toBeLessThanOrEqual(plan.titleLines);
  });

  it("is the seat alone for a question that is not a Response", () => {
    const pick = { kind: "pick", key: "p", step: "Combat", title: "Choose a defender", note: null, options: [], alternative: null } as unknown as Parameters<typeof headerOf>[0];
    expect(headerOf(pick, solo).lead).toBe("");
    expect(headerOf(pick, two).lead).toBe("Player 2 · ");
  });
});
