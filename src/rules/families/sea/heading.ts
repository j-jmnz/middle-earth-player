// Rules: dcce.heading (data/rules/entries.json). The Heading card attached to the Dream-chaser: all players share one heading, four settings from
// Sun (the only on-course one) to Storm (the worst). Shifting off-course turns the card one step toward Storm, on-course one step toward Sun, and
// neither goes past its end.
import type { Condition } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";
import { HEADINGS, type Heading } from "./types.ts";

type HeadingTest = Extract<Condition, { kind: "heading" }>["is"];

/** The current heading, or null while the game has no Heading card. */
export function headingOf(state: Pick<ScenarioState, "sea">): Heading | null {
  return state.sea?.heading ?? null;
}

/** "On-course" is Sun alone, "off-course" is Cloud, Rain or Storm, and "the worst setting" is Storm (dcce.heading). All false with no Heading card. */
export function headingIs(state: Pick<ScenarioState, "sea">, is: HeadingTest): boolean {
  const heading = headingOf(state);
  if (heading == null) return false;
  if (is === "onCourse") return heading === "Sun";
  if (is === "offCourse") return heading !== "Sun";
  return heading === "Storm";
}

/** One step off-course or on-course, never past Storm or Sun. A game with no Heading card is left as it is. */
export function shiftHeading(state: ScenarioState, direction: "onCourse" | "offCourse"): ScenarioState {
  const heading = headingOf(state);
  if (heading == null || !state.sea) return state;
  const at = HEADINGS.indexOf(heading);
  const next = HEADINGS[Math.max(0, Math.min(HEADINGS.length - 1, at + (direction === "offCourse" ? 1 : -1)))] ?? heading;
  return next === heading ? state : { ...state, sea: { ...state.sea, heading: next } };
}
