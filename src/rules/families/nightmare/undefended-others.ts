// Rules: ltp.undefended-attack, rr.step-6-4-3 (data/rules/entries.json); ledger line 900208:A:2.
//
// "Shadow: If attacking enemy is a Troll, resolve this attack against each player. (Attack is undefended against each player not engaged with this enemy.)" The
// attack's own Attack (the value it dealt its damage with, noted at the damage step: the effects that last until the end of the attack have expired by now) is
// dealt to a hero of each other player as combat damage of the attacking enemy, through the same path an undefended attack's damage takes: the strike is logged
// as undefended, the enemy's damage flags read it, and the cards that answer damage from an attack and a character the attack destroys hear it. The resolved
// attack is the same attack, so it is dealt no shadow card of its own (the card says "this attack").
import type { PickSpec } from "../../../catalog/boundary.ts";
import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { flagged, livingSeats } from "../../core/state.ts";
import type { ScenarioState } from "../../core/state.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { announceDestroyed } from "../burden/attack.ts";
import { combatDamage } from "../defense/excess.ts";
import { noteAttackDamage } from "../defense/damage.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { patchTop } from "../../windows/windows.ts";

// AttackOthersUndefended (in the effect an attack leaves for its end, the source the attacking enemy): each player other than the one it is engaged with
// chooses a hero they control, which takes the attack's damage.
export function attackOthersUndefended(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const enemy = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const data = effectData(state);
  if (!enemy || enemy.zone !== "engaged" || !data) return state;
  const amount = data.struck ?? modifiedStat(state, enemy, "attack", ctx.cards);
  if (amount <= 0) return state;
  const hero: PickSpec = { type: "hero", control: "you" };
  const items = livingSeats(state)
    .filter((seat) => seat !== enemy.controller)
    .flatMap((seat) => [
      { instruction: { verb: "Pick", pick: hero } as const, seat, chosen: null },
      { instruction: { verb: "StrikeUndefended", amount } as const, seat, chosen: null },
    ]);
  return patchTop(state, { data: { ...data, queue: [...items, ...data.queue] } });
}

// StrikeUndefended: the picked hero takes the amount as an undefended attack's combat damage from the source enemy.
export function strikeUndefended(state: ScenarioState, amount: number, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const enemyId = focus.sourceId;
  const enemy = enemyId ? state.cards[enemyId] : undefined;
  const heroId = refCard(state, "picked", frameScope(state, focus.seat, enemyId)) ?? "";
  if (!enemyId || !enemy || !state.cards[heroId]) return state;
  steps.push({ kind: "strike", side: "enemy", enemyId, targetId: heroId, attack: amount, defense: 0, undefended: true, cause: ruleCause("rr.step-6-4-3") });
  const raw = flagged(state, enemyId, "dealsNoDamage") ? 0 : amount;
  const hit = noteAttackDamage(state, combatDamage(state, enemyId, heroId, raw, ctx, steps), ctx);
  return announceDestroyed(hit, { enemyId, seat: focus.seat, heroId }, ctx);
}
