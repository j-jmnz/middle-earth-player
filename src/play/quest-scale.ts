// Rules: rr.step-3-4, ltp.quest-resolution (data/rules/entries.json).
//
// The table's quest scale (docs/design-system.md, Table): the threat in the staging area against the willpower committed to the
// quest, and how far apart they are. While the players commit, the dock's readout already adds the picked characters' willpower
// (readout.ts), so the scale moves as each one is picked; otherwise it reads the engine's own totals. Pure, so a test reads it.
import { committedWillpower, stagingThreat } from "../rules/quest.ts";
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";

import type { Readout } from "./readout.ts";

export type QuestScale = { threat: number; willpower: number; delta: number };

/** The scale now: the quest readout's numbers when the dock shows one, else the engine's staging threat and committed willpower. */
export function questScaleOf(game: ScenarioState, ctx: ReduceContext, readout: Readout | null): QuestScale {
  if (readout?.kind === "quest") {
    const willpower = readout.stats.find((stat) => stat.icon === "willpower")?.value ?? 0;
    const threat = readout.stats.find((stat) => stat.icon === "threat")?.value ?? 0;
    return { threat, willpower, delta: willpower - threat };
  }
  const threat = stagingThreat(game, ctx.cards);
  const willpower = committedWillpower(game, ctx.cards);
  return { threat, willpower, delta: willpower - threat };
}

/** The marker between the dials: "+2" Ahead, "−1" Short, or Even, and the words a screen reader hears. */
export function scaleMarker(delta: number): { value: string; word: "Ahead" | "Short" | "Even"; tone: "ok" | "danger" | "muted" } {
  if (delta > 0) return { value: `+${delta}`, word: "Ahead", tone: "ok" };
  if (delta < 0) return { value: `−${-delta}`, word: "Short", tone: "danger" };
  return { value: "0", word: "Even", tone: "muted" };
}
