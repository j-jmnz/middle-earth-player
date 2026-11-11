// Rules: rr.step-3-4, ltp.quest-resolution (data/rules/entries.json).
//
// The table's quest scale (docs/design-system-table.md, Quest scale): the threat in the staging area against the willpower committed to the
// quest, and how far apart they are. While the players commit, the dock's readout already adds the picked characters' willpower
// (readout.ts), so the scale moves as each one is picked; otherwise it reads the engine's own totals. Pure, so a test reads it.
import { committedWillpower, stagingThreat } from "../../rules/quest/quest.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import type { Readout } from "./readout.ts";
import { stageHasDefense } from "./fortress.ts";
import { questSeat } from "../store/selectors.ts";

// `live` is whether the comparison means anything now: only in the Quest phase, where characters are committed and the quest resolves,
// and only until it resolves. Outside it the meter is not drawn at all: a Planning "−3 Short" before anyone could commit would be a
// false alarm, and so would one after resolution (window 3.4), once the committed willpower is cleared.
// `seat`: the seat whose staging area and willpower these are once stages are separate between players (the acting seat's, whichever seat a peek draws), else null.
// `defense`: the current stage has Defense (mec112.defense), so the Threat that beats the Willpower is progress the encounter deck places and the Willpower that beats it places none.
export type QuestScale = { threat: number; willpower: number; delta: number; live: boolean; seat: number | null; defense?: boolean };

/** The scale now: the quest readout's numbers when the dock shows one, else the engine's staging threat and committed willpower. */
export function questScaleOf(game: ScenarioState, ctx: ReduceContext, readout: Readout | null): QuestScale {
  // The acting seat's own staging area and stage once stages are separate.
  const seat = questSeat(game);
  const owner = seat != null && game.seatCount > 1 ? seat : null;
  const defense = stageHasDefense(game) ? { defense: true } : {};
  if (readout?.kind === "quest") {
    const willpower = readout.stats.find((stat) => stat.icon === "willpower")?.value ?? 0;
    const threat = readout.stats.find((stat) => stat.icon === "threat")?.value ?? 0;
    return { threat, willpower, delta: willpower - threat, live: true, seat: owner, ...defense };
  }
  const threat = stagingThreat(game, ctx.cards, seat);
  const willpower = committedWillpower(game, ctx.cards, seat);
  return { threat, willpower, delta: willpower - threat, live: game.phase === "Quest" && !game.questResolved, seat: owner, ...defense };
}

/** What a screen reader hears of the scale: the threat in staging, the willpower committed and how far ahead or short it is. */
export function scaleLabel(scale: QuestScale): string {
  const whose = scale.seat == null ? "" : `Player ${scale.seat + 1}'s `;
  return `${whose}threat in staging ${scale.threat}, willpower committed ${scale.willpower}, ${gapWords(scale)}`;
}

// How far apart the bars are, by the marker's word: the Defense cases say where the progress goes.
function gapWords(scale: QuestScale): string {
  const marker = scaleMarker(scale);
  switch (marker.word) {
    case "Even":
      return "even";
    case "Encounter":
      return `the encounter deck places ${Math.abs(scale.delta)} progress, the stage has Defense`;
    case "Held":
      return "no progress, the stage has Defense";
    default:
      return `${Math.abs(scale.delta)} ${marker.word.toLowerCase()}`;
  }
}

/** The word under the threat bar: "staging", or "P2 staging" once stages are separate between players. */
export function stagingWord(scale: QuestScale): string {
  return scale.seat == null ? "staging" : `P${scale.seat + 1} staging`;
}

export type ScaleMarker = {
  value: string;
  word: "Ahead" | "Short" | "Even" | "Encounter" | "Held";
  tone: "ok" | "danger" | "muted";
  /** The small word under the marker in the full meter, null when there is none: on a stage with Defense it says where the progress goes. */
  caption: string | null;
};

/**
 * The marker between the bars: "+2" Ahead, "−1" Short, or Even, and the words a screen reader hears. On a stage with Defense it says which way the progress goes: "+2" in red, captioned "to stage", when the
 * Threat wins (the encounter deck places 2 progress on the stage), and "Held" when the Willpower wins (the players place none; the stage keeps what it has).
 */
export function scaleMarker(scale: QuestScale): ScaleMarker {
  const { delta } = scale;
  if (scale.defense && delta < 0) return { value: `+${-delta}`, word: "Encounter", tone: "danger", caption: "to stage" };
  if (scale.defense && delta > 0) return { value: "Held", word: "Held", tone: "muted", caption: null };
  if (delta > 0) return { value: `+${delta}`, word: "Ahead", tone: "ok", caption: null };
  if (delta < 0) return { value: `−${-delta}`, word: "Short", tone: "danger", caption: null };
  return { value: "0", word: "Even", tone: "muted", caption: null };
}

/** The bars' heights as shares of the larger value (at least 1, so two zeros draw empty bars). */
export function meterFractions(scale: QuestScale): { threat: number; willpower: number; line: number } {
  const most = Math.max(scale.threat, scale.willpower, 1);
  const threat = scale.threat / most;
  return { threat, willpower: scale.willpower / most, line: threat };
}
