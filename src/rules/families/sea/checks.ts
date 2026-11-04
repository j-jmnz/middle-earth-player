// Rules: rr.engagement-check, ltp.engagement-checks-intro, ltp.engagement-checks-repeat (data/rules/entries.json); ledger line 12122:A:1. "The players make engagement checks against each enemy in the staging area": the checks of the encounter
// phase (quest/quest.ts engagementStep) made at once: in player order each player engages the enemy of the highest engagement cost at or below his threat, and the pass is made again until it engages no enemy. A tie
// is the first player's choice. "Raider Flagship gets -50 engagement cost during these engagement checks": the cost is read with that much off for the named enemy, and only here.
import type { Instruction } from "../../../catalog/boundary.ts";

import { askTarget } from "../../windows/choices.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { addModifier } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { engageEnemy, engagementCheck } from "../../quest/quest.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Checks = Extract<Instruction, { verb: "MakeEngagementChecks" }>;

// The state the costs are read in: the lowered enemies hold the reduction. Only the reading uses it; the engagements are made on the real state.
function reading(state: ScenarioState, instruction: Checks, focus: Focus, ctx: ReduceContext): ScenarioState {
  if (!instruction.lower) return state;
  let probe = state;
  for (const id of state.staging) {
    if (printedOf(ctx.cards, state.cards[id]?.code ?? "").name === instruction.lower.name) probe = addModifier(probe, id, focus.sourceId ?? id, "engagementCost", -instruction.lower.amount, "endOfPhase");
  }
  return probe;
}

export function makeEngagementChecks(state: ScenarioState, instruction: Checks, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  let ordinal = instruction.ordinal ?? 0;
  let engaged = instruction.engaged ?? false;
  let answer = focus.chosen;
  // Each engagement lowers what is in the staging area, so the passes end; the bound keeps a card that cannot be engaged from looping.
  for (let guard = 0; guard < 200; guard += 1) {
    const seats = livingSeats(next);
    if (ordinal >= seats.length) {
      if (!engaged) return next;
      ordinal = 0;
      engaged = false;
      continue;
    }
    const seat = seats[ordinal] ?? 0;
    const check = engagementCheck(reading(next, instruction, focus, ctx), seat, ctx.cards);
    if (check.kind === "none") {
      ordinal += 1;
      continue;
    }
    const chosen = check.kind === "one" ? check.enemyId : answer && check.options.includes(answer) ? answer : undefined;
    answer = undefined;
    if (!chosen && check.kind === "tied") {
      return effectData(next) ? askTarget(next, { instruction: { ...instruction, ordinal, engaged }, seat: next.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, check.options) : next;
    }
    if (!chosen) return next;
    const after = engageEnemy(next, seat, chosen, steps);
    if (after !== next) engaged = true;
    next = after;
    ordinal += 1;
  }
  return next;
}
