// Rules: rr.constant-ability, rr.step-6-4-1, rr.travel (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { constantInstructions } from "./constant-records.ts";
import type { ReduceContext } from "./interpret.ts";
import { modifiedStat } from "./keywords.ts";
import { printedOf } from "./printed.ts";
import { inPlay, type ScenarioState } from "./state.ts";

type Restrict = Extract<Instruction, { verb: "Restrict" }>;
export type Restriction = { sourceId: string; what: Restrict["what"]; exceptTrait?: string; maxWillpower?: number };

// Rules from constant effects that forbid something. The question names what is being asked about, and
// each record names the card it came from, so a caller can tell whose rule it is.
export function restricted(state: ScenarioState, ctx: ReduceContext, what: Restrict["what"]): Restriction[] {
  const found: Restriction[] = [];
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "Restrict" || instruction.what !== what) continue;
    found.push({
      sourceId: source.id,
      what,
      ...(instruction.exceptTrait ? { exceptTrait: instruction.exceptTrait } : {}),
      ...(instruction.maxWillpower != null ? { maxWillpower: instruction.maxWillpower } : {}),
    });
  }
  return found;
}

export function travelBlocked(state: ScenarioState, ctx: ReduceContext, locationId: string): boolean {
  return restricted(state, ctx, "travel").some((rule) => rule.sourceId === locationId);
}

// "If the players cannot pay the Travel cost, then they cannot travel to that location." (rr.travel). A Travel cost that
// exhausts a named card (Weathertop, 141046:A:3: "The first player must exhaust The One Ring to travel here") can be paid
// only while a ready copy of that card is in play. A Hide test on a Travel line is not a cost the players can fail to pay.
export function travelCostUnpayable(state: ScenarioState, ctx: ReduceContext, locationId: string): boolean {
  const code = state.cards[locationId]?.code;
  if (code == null) return false;
  return ctx.effects
    .filter((effect) => effect.cardCode === code && effect.timing === "travel")
    .flatMap((effect) => effect.instructions)
    .some((instruction) => {
      if (instruction.verb !== "Exhaust" || instruction.target?.kind !== "byCode") return false;
      const named = instruction.target.code;
      return !Object.values(state.cards).some((card) => card.code === named && inPlay(card.zone) && !card.exhausted);
    });
}

export function attachBlocked(state: ScenarioState, ctx: ReduceContext, hostId: string, attachmentCode: string): boolean {
  const traits = printedOf(ctx.cards, attachmentCode).traits;
  return restricted(state, ctx, "attach").some(
    (rule) => rule.sourceId === hostId && !(rule.exceptTrait != null && traits.includes(rule.exceptTrait)),
  );
}

// The character cannot defend the attack in progress: "Characters with 1 Willpower or less cannot defend attacks made by The
// Witch-king" (141068:A:3) is a rule of the attacking enemy, read against the character's willpower now.
export function defenseBlocked(state: ScenarioState, ctx: ReduceContext, defenderId: string): boolean {
  const attack = state.pendingAttack;
  const defender = state.cards[defenderId];
  if (!attack || !defender) return false;
  return restricted(state, ctx, "defend").some(
    (rule) => rule.sourceId === attack.enemyId && modifiedStat(state, defender, "willpower", ctx.cards) <= (rule.maxWillpower ?? 0),
  );
}

// The hero does not count against the hero limit while a card attached to it says so.
export function heroLimitExempt(state: ScenarioState, ctx: ReduceContext, heroId: string): boolean {
  return restricted(state, ctx, "heroLimit").some((rule) => state.cards[rule.sourceId]?.host === heroId);
}

// Attachments of the card that carry the Restricted keyword.
export function restrictedAttachments(state: ScenarioState, hostId: string, ctx: ReduceContext): string[] {
  const host = state.cards[hostId];
  if (!host) return [];
  return host.attachments.filter((id) => {
    const attachment = state.cards[id];
    return attachment != null && printedOf(ctx.cards, attachment.code).keywords.restricted;
  });
}
