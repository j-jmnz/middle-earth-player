// Rules: rr.framework-steps, rr.action-windows, rr.attack-resolution-chart (data/rules/entries.json; data/rules/steps.json).
//
// The panel a tap on the phase rail opens (phase-carousel.tsx): the round's seven phases in order, each with its steps from the
// turn reference (reference.ts: the rule titles from data/rules and what the player decides), the step the engine is in, and the
// action windows the player can stop at. Pure and read-only: every word comes from `turnReference`, `STEP_WORDS` and the
// window points through it, none is written here, and nothing here sends an intent.
import { questStatNow, type QuestStat } from "./quest-stat.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";

import { phaseIndex, ROUND_PHASES, windowPoint } from "./rail.ts";
import { turnReference, type ReferencePhase } from "./reference.ts";
import type { TableSettings } from "../../ui/table-settings.ts";

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

/** Where `phase` sits against the game's: before it (done this round), the game's own, or after it. While an additional instance of a phase runs (11213:A:2), the phases between the one it followed (`ran`) and it
 * have not run yet: they stay next. */
function stateOf(index: number, here: number, ran: number): CarouselPhase["state"] {
  return index < here && index <= ran ? "past" : index === here ? "current" : "next";
}

/**
 * The round laid out for the panel. `stops` is the player's standing setting (table-settings.ts); `title` reads a rule span's
 * title (as turnReference does). Before the Resource phase every phase is next, and after Refresh every phase is past.
 */
export function phaseCarousel(game: ScenarioState, stops: Pick<TableSettings, "stopsOn" | "stops">, title: (id: string) => string | null, stat?: QuestStat): Carousel {
  const here = phaseIndex(game);
  const ran = game.extraResume != null && game.extraFollowed ? ROUND_PHASES.indexOf(game.extraFollowed) : here;
  const reference = turnReference(game, title, stat);
  const phases = ROUND_PHASES.map((name, index): CarouselPhase => {
    const steps = carouselSteps(reference.find((phase) => phase.phase === name)?.steps ?? [], stops.stops);
    return { id: name.toLowerCase(), name, state: stateOf(index, here, ran), steps };
  });
  return {
    round: game.round,
    phases,
    stopAhead: stops.stopsOn && stopAhead(game, phases[here]?.steps, stops.stops),
  };
}

/** The carousel with the quest steps worded by the stat the stage counts (quest-stat.ts): Attack under Battle, Defense under Siege. */
export function carouselOf(game: ScenarioState, ctx: ReduceContext, stops: Pick<TableSettings, "stopsOn" | "stops">, title: (id: string) => string | null): Carousel {
  return phaseCarousel(game, stops, title, questStatNow(game, ctx));
}

// A phase's steps for the panel, each window marked a stop where the player's stops say so.
function carouselSteps(steps: ReferencePhase["steps"], stops: readonly string[]): CarouselStep[] {
  return steps.map((step): CarouselStep => {
    const windows = step.windows.map((window) => ({
      ...window,
      stop: stops.includes(window.id),
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
}

// No rule title: the words of a step are not read for the stop that lies ahead.
const noTitle = () => null;

/**
 * Whether a stop of the player's lies after the game's place in its phase (the rail's S, `Carousel.stopAhead`), without laying out the
 * panel: only the game's own phase is built, and no rule title is looked up. The same answer as `phaseCarousel(...).stopAhead`.
 */
export function stopAheadOf(game: ScenarioState, stops: Pick<TableSettings, "stopsOn" | "stops">): boolean {
  if (!stops.stopsOn) return false;
  const name = ROUND_PHASES[phaseIndex(game)];
  const phase = name ? turnReference(game, noTitle).find((candidate) => candidate.phase === name) : undefined;
  return stopAhead(game, phase ? carouselSteps(phase.steps, stops.stops) : undefined, stops.stops);
}

// Whether a stop of the player's lies after the game's place in its phase: after the window it waits at, else from the step it
// is in (that step's own windows come after it).
function stopAhead(game: ScenarioState, steps: readonly CarouselStep[] | undefined, stops: readonly string[]): boolean {
  if (!steps) return false;
  const flat = steps.flatMap((step, index) => step.windows.map((window) => ({ index, id: window.id })));
  const at = windowPoint(game)?.id;
  const waiting = at ? flat.findIndex((window) => window.id === at) : -1;
  const now = Math.max(
    0,
    steps.findIndex((step) => step.current),
  );
  const from = waiting >= 0 ? waiting + 1 : flat.findIndex((window) => window.index >= now);
  return from >= 0 && flat.slice(from).some((window) => stops.includes(window.id));
}

/** The Stops setting in words (the screen reader's hint on the master switch). */
export const STOPS_TEXT = "Pass the action windows that are not stops, unless a card usable there is new. Planning, the commit, Responses and every choice still ask.";
/** The words for the accent S: a stop of the player's lies ahead in this phase. */
export const STOP_AHEAD_WORDS = "A stop is ahead";

/** The phase the panel opens on: the current phase; the first before Resource, the last after Refresh. */
export function startIndex(carousel: Carousel): number {
  const at = carousel.phases.findIndex((phase) => phase.state === "current");
  if (at >= 0) return at;
  return carousel.phases[0]?.state === "past" ? carousel.phases.length - 1 : 0;
}
