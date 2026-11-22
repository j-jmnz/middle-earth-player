// Rules: mec112.wizardry, rr.the-word-choose, rr.defending-player (data/rules/entries.json); ledger lines 143062:A:1, 143047:A:2, 143052:A:1.
//
// A Wizardry line's record is a `forced` effect whose trigger is `wizardry`: the location's own record answers its exploring (the core hears it as the location leaves play, in the staging area or as the active
// location), and TriggerWizardry reads the same record to run it without exploring: the active location's (Machines of Isengard) or a shadow card's (Saruman).
import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import type { Amount } from "../../../catalog/effect-schema-amount.ts";

import { effectCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { frameScope } from "../../interpret/amounts.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { effectsOf } from "../../windows/listen.ts";
import { activeOf } from "../breaking/areas.ts";
import type { Focus } from "../index.ts";

type Trigger = Extract<Instruction, { verb: "TriggerWizardry" }>;

/** The records of a card's Wizardry line: the effects whose trigger is `wizardry`. Empty for a card that prints none. */
export function wizardryOf(ctx: Pick<ReduceContext, "effects">, code: string): readonly Effect[] {
  return effectsOf(ctx, code).filter((effect) => effect.trigger === "wizardry");
}

/** The `hasWizardry` condition: the active location prints a Wizardry line. */
export function activeHasWizardry(state: ScenarioState, seat: number, ctx: ReduceContext): boolean {
  const id = activeOf(state, seat);
  const code = id ? state.cards[id]?.code : undefined;
  return code != null && wizardryOf(ctx, code).length > 0;
}

// "As if he is the only player in the game" (143047:A:2): each "each player" is the acting player alone, a number of players is 1, and "characters in play" are the acting player's (read as the card says it,
// docs/scenarios/the-two-towers.md, The Two Towers). A ForEachPlayer runs its instructions once, for the actor; `eachSeat` becomes the actor. The verbs a Wizardry line uses are listed; the test in index.test.ts reads every
// Wizardry record through asOnlyPlayer and fails on a number of players or an `eachSeat` it left, so a new line that needs another verb is found there.
function playersAmount(amount: Amount): Amount {
  if (typeof amount === "number" || amount.players !== true) return amount;
  const { players: _players, times, plus, limit, ...rest } = amount;
  // A number of players combined with another reading has no value of one player alone.
  if (Object.keys(rest).length > 0) throw new Error(`Wizardry reads a number of players with another amount: ${JSON.stringify(amount)}`);
  const value = Math.max(0, (times ?? 1) + (plus ?? 0));
  return limit != null ? Math.min(value, limit) : value;
}

function alone(instruction: Instruction): Instruction {
  switch (instruction.verb) {
    case "RaiseThreat": {
      const { who, amount, ...rest } = instruction;
      return { ...rest, ...(amount !== undefined ? { amount: playersAmount(amount) } : {}), ...(who === "eachSeat" ? { who: "actor" as const } : who !== undefined ? { who } : {}) };
    }
    case "LowerThreat":
      return { ...instruction, amount: playersAmount(instruction.amount), who: instruction.who === "eachSeat" ? "actor" : instruction.who };
    case "DiscardRandomFromHand": {
      const { who, amount, ...rest } = instruction;
      return { ...rest, ...(amount !== undefined ? { amount: playersAmount(amount) } : {}), ...(who !== undefined && who !== "eachSeat" ? { who } : {}) };
    }
    case "AssignDamage": {
      const { who, pick, amount, ...rest } = instruction;
      return { ...rest, amount: playersAmount(amount), pick: pick.control === "any" ? { ...pick, control: "you" } : pick, ...(who === "eachSeat" ? {} : who !== undefined ? { who } : {}) };
    }
    default:
      return instruction;
  }
}

/** The instructions of a Wizardry line as the only player in the game resolves them. */
export function asOnlyPlayer(instructions: readonly Instruction[]): readonly Instruction[] {
  return instructions.flatMap((instruction) => (instruction.verb === "ForEachPlayer" ? asOnlyPlayer(instruction.instructions) : [alone(instruction)]));
}

/** TriggerWizardry: the Wizardry effect of the target card resolves in a frame of its own, for the actor. Nothing happens for a card with no Wizardry line. */
export function triggerWizardry(state: ScenarioState, instruction: Trigger, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = instruction.target === "activeLocation" ? activeOf(state, focus.seat) : (frameScope(state, focus.seat, focus.sourceId).other ?? null);
  const card = id ? state.cards[id] : undefined;
  const records = card ? wizardryOf(ctx, card.code) : [];
  const first = records[0];
  if (!id || !first) return state;
  const running = instruction.asOnlyPlayer ? records.map((effect): Effect => ({ ...effect, instructions: [...asOnlyPlayer(effect.instructions)] })) : records;
  return pushEffectFrame(
    state,
    {
      frame: "forced",
      sourceId: id,
      actor: focus.seat,
      peril: state.perilSeat != null,
      effectId: first.id,
      instructions: running.flatMap((effect) => effect.instructions),
      causes: running.flatMap((effect) => effect.instructions.map(() => effectCause(effect))),
      cancel: null,
      blockCancel: null,
    },
    steps,
  );
}
