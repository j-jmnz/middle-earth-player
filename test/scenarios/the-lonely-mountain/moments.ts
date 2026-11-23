import type { Effect } from "../../../src/catalog/boundary.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PlayerIntent, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { IntentRefused } from "../../harness/scene.ts";
import { first, legalIntents, resolveRecords, send, start, tableFromLayout, type Layout, type LayoutTable, type Run } from "../../harness/scene-kit.ts";

// Test helper. The moments of The Lonely Mountain's tests: a table from a layout on the scenario's records (or on the records a `lineSpec` check hands it) and a run driven through the windows a burgle attempt, a Choose and a Pick open.
// A card-spec row (test/harness/card-spec.ts) stops at the action window of a burgle attempt, so the multi-step moments are played here.

export const SCENARIO = "the-lonely-mountain";
export const STAGES = ["132071", "132072", "132073", "132074"] as const;
// Bilbo Baggins (the loadout deals him to the first seat) with Baggins resources for the Mountain's action and Pretending to Sleep.
export const bilbo = (resources = 0) => ({ code: "132001", resources });

// Player cards of other codes a layout may hold: 01016 Snowbourn Scout (leadership ally, cost 1), 01028 Veteran Axehand (tactics ally, 2), 02102 Silvan Tracker (lore ally, 3), 01048 Hasty Stroke (spirit event, 1), 04108 Daeron's Runes (lore event, 0).
export const PLAYER_CARDS = ["01016", "01028", "02102", "01048", "04108", "01050"];

export const make = (layout: Layout, effects: readonly Effect[] = EFFECTS): LayoutTable => tableFromLayout(SCENARIO, { stages: STAGES, ...layout }, { effects, extra: PLAYER_CARDS });

/** What a driven run does at each window: the answers to the Choose windows in order (an option id, or the code of a card a Pick offers; the first option when none is left) and the actions used in an action window (a card code, with the payment). */
export type Plan = { answers?: readonly string[]; use?: readonly { code: string; from?: string }[] };

const idsOfCode = (state: ScenarioState, code: string): string[] => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.id);

/** The run on, each window answered from the plan, until a window the plan has nothing for stays open: a Pass in a look window or an action window, an answer in a choice. `stopAt` names a window kind to stop at. */
export function drive(run: Run, made: LayoutTable, plan: Plan = {}, stopAt: readonly string[] = []): Run {
  const answers = [...(plan.answers ?? [])];
  const uses = [...(plan.use ?? [])];
  let current = run;
  for (let guard = 0; guard < 80; guard += 1) {
    const window = current.state.window;
    if (!window || current.state.lost || current.state.stageCleared || stopAt.includes(window.kind)) break;
    if (window.kind === "choose") {
      const asked = answers.shift();
      const wanted = asked === undefined ? undefined : window.options.includes(asked) ? asked : window.options.find((option) => current.state.cards[option]?.code === asked);
      if (asked !== undefined && wanted === undefined) throw new Error(`answer ${asked} is not offered (${window.options.map((option) => current.state.cards[option]?.code ?? option).join(", ")})`);
      current = send(current, { type: "Choose", optionId: wanted ?? window.options[0] ?? "" }, made.ctx);
    } else if (window.kind === "look") current = send(current, { type: "Pass" }, made.ctx);
    else if (window.kind === "frameAction" || window.kind === "actions") {
      const use = uses.shift();
      if (use) {
        const ids = idsOfCode(current.state, use.code);
        const offered = legalIntents(current.state, made.ctx).find((intent) => intent.type === "Trigger" && ids.includes(intent.cardId));
        if (!offered) throw new IntentRefused({ type: "Trigger", cardId: ids[0] ?? "", effectId: "", payments: [] }, `no action of ${use.code} is offered`);
        const payer = current.state.seats[current.state.firstPlayer]?.heroes.find((id) => current.state.cards[id]?.code === (use.from ?? "132001"));
        current = send(current, { ...offered, payments: payer ? [{ heroId: payer, amount: 2 }] : [] } as PlayerIntent, made.ctx);
      } else current = send(current, { type: "Pass" }, made.ctx);
    } else break;
  }
  return current;
}

/** The records of `code` at `timing` resolve for the table's first player, and the windows they open are driven. */
export function resolveAndDrive(made: LayoutTable, code: string, timing: Effect["timing"], plan: Plan = {}, stopAt: readonly string[] = []): Run {
  const resolved = resolveRecords(made.state, made.ctx, code, timing, first(made.state, code) || undefined, undefined, true);
  return drive(resolved, made, plan, stopAt);
}

export { start };
