// Rules: rr.framework-steps, rr.action-windows, rr.attack-resolution-chart (data/rules/entries.json; data/rules/steps.json).
//
// The strip a tap on the phase rail opens (phase-carousel.tsx): the round's seven phases in order, each with its steps from the
// turn reference (reference.ts: the rule titles from data/rules and what the player decides), the step the engine is in, and the
// action windows the player can stop at. Pure and read-only: every word comes from `turnReference`, `STEP_WORDS` and the
// window points through it, none is written here, and nothing here sends an intent.
import type { ScenarioState } from "../rules/state.ts";

import { phaseIndex, ROUND_PHASES, windowPoint } from "./rail.ts";
import { turnReference } from "./reference.ts";
import type { TableSettings } from "./table-settings.ts";

export type CarouselWindow = {
  id: string;
  title: string;
  note: string;
  stop: boolean;
};
export type CarouselStep = {
  id: string;
  // The step's rule titles in one line ("Planning · Play allies and attachments").
  words: string;
  // What the player decides there.
  decision: string;
  current: boolean;
  // The step is followed by action windows (`windows`), each a Stop the player can set.
  window: boolean;
  // Any of those windows is one of the player's stops.
  stop: boolean;
  windows: readonly CarouselWindow[];
};
export type CarouselPhase = {
  id: string;
  name: string;
  state: "past" | "current" | "next";
  steps: readonly CarouselStep[];
};
export type Carousel = {
  round: number;
  phases: readonly CarouselPhase[];
  // Stops are on and one of the player's stops lies later in this phase than the game is now.
  stopAhead: boolean;
};

/** Where `phase` sits against the game's: before it (done this round), the game's own, or after it. */
function stateOf(index: number, here: number): CarouselPhase["state"] {
  return index < here ? "past" : index === here ? "current" : "next";
}

/**
 * The round laid out for the strip. `stops` is the player's standing setting (table-settings.ts); `title` reads a rule span's
 * title (as turnReference does). Before the Resource phase every phase is next, and after Refresh every phase is past.
 */
export function phaseCarousel(game: ScenarioState, stops: Pick<TableSettings, "stopsOn" | "stops">, title: (id: string) => string | null): Carousel {
  const here = phaseIndex(game);
  const reference = turnReference(game, title);
  const phases = ROUND_PHASES.map((name, index): CarouselPhase => {
    const steps = (reference.find((phase) => phase.phase === name)?.steps ?? []).map((step): CarouselStep => {
      const windows = step.windows.map((window) => ({
        ...window,
        stop: stops.stops.includes(window.id),
      }));
      return {
        id: step.id,
        words: step.titles.join(" · "),
        decision: step.decision,
        current: step.current,
        window: windows.length > 0,
        stop: windows.some((window) => window.stop),
        windows,
      };
    });
    return { id: name.toLowerCase(), name, state: stateOf(index, here), steps };
  });
  return {
    round: game.round,
    phases,
    stopAhead: stops.stopsOn && stopAhead(game, phases[here], stops.stops),
  };
}

// Whether a stop of the player's lies after the game's place in its phase: after the window it waits at, else from the step it
// is in (that step's own windows come after it).
function stopAhead(game: ScenarioState, phase: CarouselPhase | undefined, stops: readonly string[]): boolean {
  if (!phase) return false;
  const flat = phase.steps.flatMap((step, index) => step.windows.map((window) => ({ index, id: window.id })));
  const at = windowPoint(game)?.id;
  const waiting = at ? flat.findIndex((window) => window.id === at) : -1;
  const now = Math.max(
    0,
    phase.steps.findIndex((step) => step.current),
  );
  const from = waiting >= 0 ? waiting + 1 : flat.findIndex((window) => window.index >= now);
  return from >= 0 && flat.slice(from).some((window) => stops.includes(window.id));
}

/** The Stops setting in words (the screen reader's hint on the master switch). */
export const STOPS_TEXT = "Pass the action windows that are not stops, unless a card usable there is new. Planning, the commit, Responses and every choice still ask.";
/** The words for the accent S: a stop of the player's lies ahead in this phase. */
export const STOP_AHEAD_WORDS = "A stop is ahead";

const CARD_MIN = 230;
const CARD_MAX = 340;

/** The card's width for a strip `width` wide: about 58% of it, so the neighbors show at the sides, clamped to 230..340 (at the UI `scale`, those bounds times it). */
export function cardWidth(width: number, scale = 1): number {
  return Math.round(Math.min(CARD_MAX * scale, Math.max(CARD_MIN * scale, width * 0.58)));
}

/** The index the strip starts on: the current phase; the first before Resource, the last after Refresh. */
export function startIndex(carousel: Carousel): number {
  const at = carousel.phases.findIndex((phase) => phase.state === "current");
  if (at >= 0) return at;
  return carousel.phases[0]?.state === "past" ? carousel.phases.length - 1 : 0;
}
