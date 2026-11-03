// Rules: dcce.heading (data/rules/entries.json). The Heading card's four steps as the table shows them: the dial in the top bar (an icon in a
// disc, a ring of four quarter arcs lit clockwise from the top), what a screen reader hears, the badge that says a shift, and how the card is turned in
// its preview (a quarter turn per step, the way the rule turns it). Pure: table-chrome.tsx draws it, the tests read it. The engine owns the step
// (families/sea/heading.ts); nothing here changes it.
import type { IconName } from "./icon-map.ts";
import type { ArcPart } from "./arc-spans.ts";
import type { TableToken } from "./tokens.ts";

/** The steps from the best to the worst: the order a counterclockwise quarter turn brings them to the pointer (dcce.heading). */
export const HEADING_STEPS = ["Sun", "Cloud", "Rain", "Storm"] as const;
export type HeadingStep = (typeof HEADING_STEPS)[number];

/** The game icon of each step (the MEC111 font's U+F2091 to U+F2094, assets/icons). */
export const HEADING_ICONS: Readonly<Record<HeadingStep, IconName>> = { Sun: "headingSun", Cloud: "headingCloud", Rain: "headingRain", Storm: "headingStorm" };

export type HeadingLook = {
  step: HeadingStep;
  // The step's word, as the card shows it.
  word: string;
  icon: IconName;
  // Only Sun is on-course (dcce.heading).
  onCourse: boolean;
  // How many steps it is from on-course: 0 for Sun, 3 for Storm.
  off: number;
  // How many of the ring's four quarter arcs are lit, clockwise from the top: Sun four, Cloud three, Rain two, Storm one.
  lit: number;
  // The design token the icon and the lit arcs take: the accent for Sun, bone for Cloud and Rain, threat red for Storm.
  tone: Extract<TableToken, "accent" | "bone" | "threat">;
  // Storm fills the disc in threat red; the shape of the icon and the number of arcs carry the step without the colour.
  filled: boolean;
  // How far the card is turned in its preview, in degrees counterclockwise: a quarter turn per step.
  turn: number;
  // The dial's label under or beside it.
  label: "Heading";
};

const TONES: Readonly<Record<HeadingStep, HeadingLook["tone"]>> = { Sun: "accent", Cloud: "bone", Rain: "bone", Storm: "threat" };

/** How the dial draws a step. */
export function headingLook(step: HeadingStep): HeadingLook {
  const off = HEADING_STEPS.indexOf(step);
  return { step, word: step, icon: HEADING_ICONS[step], onCourse: off === 0, off, lit: 4 - off, tone: TONES[step], filled: step === "Storm", turn: off * 90, label: "Heading" };
}

/** The ring's arcs: one quarter per lit step, from the top clockwise, in the step's colour (`color`); the rest of the ring is the track. */
export function headingArcs(step: HeadingStep, color: string): ArcPart[] {
  const { lit } = headingLook(step);
  return Array.from({ length: lit }, (_, at) => ({ key: `quarter-${at}`, share: 0.25, color }));
}

/** What a screen reader hears of the dial: "Heading, Rain, off-course, two steps from on-course". */
export function headingWords(step: HeadingStep): string {
  const { off, onCourse, word } = headingLook(step);
  if (onCourse) return `Heading, ${word}, on-course`;
  return `Heading, ${word}, off-course, ${off === 1 ? "one step" : `${off === 2 ? "two" : "three"} steps`} from on-course`;
}

/** The dial's hint: a tap opens the card. */
export const HEADING_HINT = "Shows the Heading card";

/** The change badge beside the dial for three seconds, worded by the direction of the shift and not the state it leaves ("Toward Sun" on an accent wash, "Toward Storm" on a threat-red wash; a Storm-to-Rain shift is still off-course); null when it did not move. */
export function headingDelta(before: HeadingStep, after: HeadingStep): { text: string; towardSun: boolean } | null {
  if (before === after) return null;
  const towardSun = HEADING_STEPS.indexOf(after) < HEADING_STEPS.indexOf(before);
  return { text: towardSun ? "Toward Sun" : "Toward Storm", towardSun };
}

/** What a screen reader hears of a shift: "Heading shifted off-course, now Rain". */
export function headingDeltaWords(before: HeadingStep, after: HeadingStep): string | null {
  const delta = headingDelta(before, after);
  return delta ? `Heading shifted ${delta.towardSun ? "on-course" : "off-course"}, now ${after}` : null;
}

/** The preview's title: "Heading · Rain (off-course)". */
export function headingPreviewTitle(step: HeadingStep): string {
  return `Heading · ${step} (${headingLook(step).onCourse ? "on-course" : "off-course"})`;
}

/** The preview's four steps, the current one marked, each with where it stands. */
export function headingPreviewSteps(step: HeadingStep): readonly { step: HeadingStep; line: string; current: boolean }[] {
  return HEADING_STEPS.map((each) => ({ step: each, line: `${each}: ${each === "Sun" ? "on-course" : each === "Storm" ? "off-course, the worst" : "off-course"}`, current: each === step }));
}

/** The step a state's sea record holds, narrowed; null with no Heading card. */
export function headingStepOf(heading: string | null | undefined): HeadingStep | null {
  return HEADING_STEPS.find((step) => step === heading) ?? null;
}
