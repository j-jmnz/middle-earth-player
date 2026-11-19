// Rules: rr.damage, rr.attachment-cards (data/rules/entries.json); ledger line 901507:A:1.
//
// "Deal 3 damage to each character with a Tentacle attachment. If no characters were damaged by this effect, ...": each character in play, any player's, that has an attachment with the trait is dealt the damage in turn, as an encounter card's effect deals it.
// The effect's X is how many were damaged: a character that took none (the damage was canceled, capped or prevented all of) does not count, one that the damage destroyed does.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { placeDamage } from "../../core/keywords.ts";
import { inPlay, livingSeats, type ScenarioState } from "../../core/state.ts";
import { characters } from "../../combat/combat.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { patchTop } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";
import { effectData } from "./moves.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

export function damageEachWithAttachment(state: ScenarioState, instruction: Verb<"DamageEachWithAttachment">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const targets = livingSeats(state)
    .flatMap((seat) => characters(state, seat, ctx.cards))
    .filter((id) => (state.cards[id]?.attachments ?? []).some((attachment) => hasTrait(state, attachment, instruction.trait, ctx)));
  let next = state;
  let damaged = 0;
  for (const id of targets) {
    const before = next.cards[id];
    if (!before) continue;
    next = placeDamage(next, id, instruction.amount, ctx.cards, steps, "framework", currentCause(steps, UNATTRIBUTED), focus.sourceId);
    const after = next.cards[id];
    if (!after || !inPlay(after.zone) || after.damage > before.damage) damaged += 1;
  }
  const data = effectData(next);
  return data ? patchTop(next, { data: { ...data, x: damaged } }) : next;
}
