// Rules: dcce.heading (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { ICONS } from "../../ui/icons/generated.ts";
import { arcSpans } from "../../ui/arc-spans.ts";
import { tableTokens } from "../../ui/tokens.ts";
import {
  HEADING_ICONS,
  HEADING_HINT,
  HEADING_STEPS,
  headingArcs,
  headingDelta,
  headingDeltaWords,
  headingLook,
  headingPreviewSteps,
  headingPreviewTitle,
  headingStepOf,
  headingWords,
} from "./heading.ts";

describe("the Heading dial's steps", () => {
  it("run from Sun to Storm, each with a game icon the build cut from the MEC111 font", () => {
    expect(HEADING_STEPS).toEqual(["Sun", "Cloud", "Rain", "Storm"]);
    for (const step of HEADING_STEPS) {
      const icon = ICONS[HEADING_ICONS[step]];
      expect(icon.kind).toBe("vector");
      expect(icon.source).toMatch(/MEC111\.pdf$/);
    }
    expect(new Set(Object.values(HEADING_ICONS)).size).toBe(4);
  });

  it("light the ring clockwise from the top: Sun four quarters, Cloud three, Rain two, Storm one", () => {
    expect(HEADING_STEPS.map((step) => headingLook(step).lit)).toEqual([4, 3, 2, 1]);
    for (const step of HEADING_STEPS) {
      const spans = arcSpans(headingArcs(step, "#fff"));
      expect(spans).toHaveLength(headingLook(step).lit);
      expect(spans[0]?.from ?? 0).toBe(0);
      expect(spans.at(-1)?.to).toBeCloseTo(headingLook(step).lit / 4, 9);
      for (const span of spans) expect(span.to - span.from).toBeCloseTo(0.25, 9);
    }
  });

  it("colour the step: accent for Sun, bone for Cloud and Rain, threat red and a filled disc for Storm", () => {
    expect(HEADING_STEPS.map((step) => headingLook(step).tone)).toEqual(["accent", "bone", "bone", "threat"]);
    expect(HEADING_STEPS.map((step) => headingLook(step).filled)).toEqual([false, false, false, true]);
    for (const step of HEADING_STEPS) expect(tableTokens[headingLook(step).tone]).toBeTruthy();
  });

  it("are on-course only at Sun, and turn the card a quarter turn per step counterclockwise", () => {
    expect(HEADING_STEPS.map((step) => headingLook(step).onCourse)).toEqual([true, false, false, false]);
    expect(HEADING_STEPS.map((step) => headingLook(step).turn)).toEqual([0, 90, 180, 270]);
    expect(HEADING_STEPS.map((step) => headingLook(step).off)).toEqual([0, 1, 2, 3]);
  });

  it("are heard with their word, their course and how far they are from on-course", () => {
    expect(headingWords("Rain")).toBe("Heading, Rain, off-course, two steps from on-course");
    expect(headingWords("Sun")).toBe("Heading, Sun, on-course");
    expect(headingWords("Cloud")).toBe("Heading, Cloud, off-course, one step from on-course");
    expect(headingWords("Storm")).toBe("Heading, Storm, off-course, three steps from on-course");
    expect(HEADING_HINT).toBe("Shows the Heading card");
    expect(headingLook("Rain").label).toBe("Heading");
  });

  it("say a shift in a badge and in words, and nothing when the step did not move", () => {
    expect(headingDelta("Sun", "Cloud")).toEqual({ text: "Toward Storm", towardSun: false });
    expect(headingDelta("Rain", "Cloud")).toEqual({ text: "Toward Sun", towardSun: true });
    expect(headingDelta("Rain", "Rain")).toBeNull();
    expect(headingDeltaWords("Cloud", "Rain")).toBe("Heading shifted off-course, now Rain");
    expect(headingDeltaWords("Rain", "Cloud")).toBe("Heading shifted on-course, now Cloud");
    expect(headingDeltaWords("Storm", "Storm")).toBeNull();
  });

  it("title the preview with the step and its course, list the four steps with the current one marked", () => {
    expect(headingPreviewTitle("Rain")).toBe("Heading · Rain (off-course)");
    expect(headingPreviewTitle("Sun")).toBe("Heading · Sun (on-course)");
    const steps = headingPreviewSteps("Rain");
    expect(steps.map((row) => row.step)).toEqual([...HEADING_STEPS]);
    expect(steps.filter((row) => row.current).map((row) => row.step)).toEqual(["Rain"]);
  });

  it("read a step from the engine's word", () => {
    expect(headingStepOf("Storm")).toBe("Storm");
    expect(headingStepOf(null)).toBeNull();
    expect(headingStepOf("Hail")).toBeNull();
  });
});
