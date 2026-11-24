// Rules: rr.staging, rr.step-3-3, rr.encounter-deck, faq.cancel-encounter-effect, faq.errata.05061 (data/rules/entries.json); ledger lines 05056:A:2, 05061:A:2.
// The two effects of The Siege of Cair Andros that work on cards other than their own: the When Revealed effect copied from the topmost treachery in the encounter discard pile (Lieutenant of Mordor) and the staging area shuffled into the encounter deck (The Power of Mordor).
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { patchTop } from "../../windows/windows.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

// A condition that always holds, for the frame of an effect that cannot be canceled (the same one the records name `ALWAYS`).
const ALWAYS: Condition = { kind: "count", pick: { type: "hero", control: "any" }, min: 0 };

/** ResolveTopmostTreachery: the When Revealed effects of the last treachery card placed in the encounter discard pile resolve for the acting seat, and the card stays there. No Doomed and no Surge: they are keywords, not part of the effect (faq.cancel-encounter-effect). */
export function resolveTopmostTreachery(state: ScenarioState, instruction: Extract<Instruction, { verb: "ResolveTopmostTreachery" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = [...state.encounterDiscard].reverse().find((candidate) => printedOf(ctx.cards, state.cards[candidate]?.code ?? "").type === "treachery");
  const code = id ? state.cards[id]?.code : undefined;
  if (!id || !code) return state;
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed").map((effect) => (instruction.uncancelable ? { ...effect, uncancelable: ALWAYS } : effect));
  return pushCardEffects(state, "whenRevealed", id, focus.seat, false, effects, ctx, steps);
}

/** ShuffleStagingIntoEncounterDeck: each card in the staging area leaves play and is shuffled into the encounter deck; the effect's X is how many there were. A location's damage and progress go with it, and it is not explored. */
export function shuffleStagingIntoEncounterDeck(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // The card itself is not counted (it resolves while the revealed card is still held with the staging area), nor is any treachery.
  const ids = state.staging.filter((id) => id !== focus.sourceId && printedOf(ctx.cards, state.cards[id]?.code ?? "").type !== "treachery");
  let next = state;
  for (const id of ids) next = moveEncounter(next, id, "shuffle", focus.seat, ctx, steps);
  const data = effectData(next);
  return data ? patchTop(next, { data: { ...data, x: ids.length } }) : next;
}
