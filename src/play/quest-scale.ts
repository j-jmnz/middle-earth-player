// Rules: rr.step-3-4, ltp.quest-resolution (data/rules/entries.json).
//
// The table's quest scale (docs/design-system-table.md, Quest scale): the threat in the staging area against the willpower committed to the
// quest, and how far apart they are. While the players commit, the dock's readout already adds the picked characters' willpower
// (readout.ts), so the scale moves as each one is picked; otherwise it reads the engine's own totals. Pure, so a test reads it.
import { committedWillpower, stagingThreat } from "../rules/quest/quest.ts";
import type { ReduceContext, ScenarioState } from "../rules/engine/reduce.ts";

import type { Readout } from "./readout.ts";
import { questSeat } from "./selectors.ts";

// `live` is whether the comparison means anything now: only in the Quest phase, where characters are committed and the quest resolves.
// Outside it the meter is not drawn at all: a Planning "−3 Short" before anyone could commit would be a false alarm.
// `seat`: the seat whose staging area and willpower these are once stages are separate between players (the acting seat's, whichever seat a peek draws), else null.
export type QuestScale = { threat: number; willpower: number; delta: number; live: boolean; seat: number | null };

/** The scale now: the quest readout's numbers when the dock shows one, else the engine's staging threat and committed willpower. */
export function questScaleOf(game: ScenarioState, ctx: ReduceContext, readout: Readout | null): QuestScale {
  // The acting seat's own staging area and stage once stages are separate.
  const seat = questSeat(game);
  const owner = seat != null && game.seatCount > 1 ? seat : null;
  if (readout?.kind === "quest") {
    const willpower = readout.stats.find((stat) => stat.icon === "willpower")?.value ?? 0;
    const threat = readout.stats.find((stat) => stat.icon === "threat")?.value ?? 0;
    return { threat, willpower, delta: willpower - threat, live: true, seat: owner };
  }
  const threat = stagingThreat(game, ctx.cards, seat);
  const willpower = committedWillpower(game, ctx.cards, seat);
  return { threat, willpower, delta: willpower - threat, live: game.phase === "Quest", seat: owner };
}

/** What a screen reader hears of the scale: the threat in staging, the willpower committed and how far ahead or short it is. */
export function scaleLabel(scale: QuestScale): string {
  const whose = scale.seat == null ? "" : `Player ${scale.seat + 1}'s `;
  const marker = scaleMarker(scale.delta);
  const gap = marker.word === "Even" ? "even" : `${Math.abs(scale.delta)} ${marker.word.toLowerCase()}`;
  return `${whose}threat in staging ${scale.threat}, willpower committed ${scale.willpower}, ${gap}`;
}

/** The word under the threat bar: "staging", or "P2 staging" once stages are separate between players. */
export function stagingWord(scale: QuestScale): string {
  return scale.seat == null ? "staging" : `P${scale.seat + 1} staging`;
}

/** The marker between the bars: "+2" Ahead, "−1" Short, or Even, and the words a screen reader hears. */
export function scaleMarker(delta: number): { value: string; word: "Ahead" | "Short" | "Even"; tone: "ok" | "danger" | "muted" } {
  if (delta > 0) return { value: `+${delta}`, word: "Ahead", tone: "ok" };
  if (delta < 0) return { value: `−${-delta}`, word: "Short", tone: "danger" };
  return { value: "0", word: "Even", tone: "muted" };
}

/** The bars' heights as shares of the larger value (at least 1, so two zeros draw empty bars). */
export function meterFractions(scale: QuestScale): { threat: number; willpower: number; line: number } {
  const most = Math.max(scale.threat, scale.willpower, 1);
  const threat = scale.threat / most;
  return { threat, willpower: scale.willpower / most, line: threat };
}
