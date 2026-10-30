// Rules: rr.constant-ability, rr.modifiers, rr.in-play-and-out-of-play (data/rules/entries.json).
import { isStatCondition, type Instruction, type ModifierStat, type PickSpec } from "../catalog/boundary.ts";

import { resolveAmount } from "./amounts.ts";

import { characters } from "./combat.ts";
import { hasTrait } from "./conditions.ts";
import { constantInstructions } from "./constant-records.ts";
import { attachedCount } from "./families/sidequests-contract.ts";
import type { ReduceContext } from "./interpret.ts";
import { pickCandidates } from "./pick.ts";
import { cardTypeOf, isCharacterType, printedOf } from "./printed.ts";
import type { CardInstance, Modifier, ScenarioState } from "./state.ts";
import { inPlay, livingSeats, modifierActive } from "./state.ts";

// A constant effect is a rule that holds while its source is in play. The engine turns each ModifyStat
// instruction of one into records on the modifier list, so modifiedStat stays the only reader. The
// records are rebuilt from the effect list, so they follow the source and its conditions.

function cardsInPlay(state: ScenarioState): CardInstance[] {
  return Object.values(state.cards).filter((instance) => inPlay(instance.zone));
}

// Hobbit heroes the source's controller has.
function hobbitHeroes(state: ScenarioState, source: CardInstance, ctx: ReduceContext): number {
  const seat = source.controller ?? state.firstPlayer;
  return (state.seats[seat]?.heroes ?? []).filter((id) => hasTrait(state, id, "Hobbit", ctx)).length;
}

function holders(state: ScenarioState, source: CardInstance, target: string | undefined, ctx: ReduceContext, trait?: string): string[] {
  const found = holdersOf(state, source, target, ctx);
  return trait == null ? found : found.filter((id) => hasTrait(state, id, trait, ctx));
}

function holdersOf(state: ScenarioState, source: CardInstance, target: string | undefined, ctx: ReduceContext): string[] {
  switch (target) {
    case "heroes":
      return cardsInPlay(state).filter((instance) => cardTypeOf(instance, printedOf(ctx.cards, instance.code)) === "hero").map((instance) => instance.id);
    case "hobbitCharacters":
      return cardsInPlay(state)
        .filter((instance) => (instance.zone === "heroes" || instance.zone === "play") && isCharacterType(printedOf(ctx.cards, instance.code)) && hasTrait(state, instance.id, "Hobbit", ctx))
        .map((instance) => instance.id);
    case "enemies":
      return cardsInPlay(state).filter((instance) => printedOf(ctx.cards, instance.code).type === "enemy").map((instance) => instance.id);
    case "host":
      return source.host ? [source.host] : [];
    case "table":
      return ["table"];
    case "engagedSeat":
      return source.zone === "engaged" && source.controller != null ? [`seat:${source.controller}`] : [];
    // "characters that player controls" for the player the source is engaged with (141050:A:2).
    case "engagedSeatCharacters":
      return source.zone === "engaged" && source.controller != null ? characters(state, source.controller, ctx.cards) : [];
    case "allies":
      return cardsInPlay(state).filter((instance) => cardTypeOf(instance, printedOf(ctx.cards, instance.code)) === "ally").map((instance) => instance.id);
    case "eachSeat":
      return livingSeats(state).map((seat) => `seat:${seat}`);
    // The source controller's seat ("You draw 1 additional card during the resource phase").
    case "actorSeat":
      return [`seat:${source.controller ?? state.firstPlayer}`];
    default:
      return [source.id];
  }
}

// The holders a constant names by filter, from its controller's side ("Each Outlands character you control"). A player card's
// constant does not reach a card immune to player card effects (mec109.immune-to-player-card-effects).
function matching(state: ScenarioState, source: CardInstance, filter: PickSpec, ctx: ReduceContext): string[] {
  return pickCandidates(state, filter, source.controller ?? state.firstPlayer, [], source.id, ctx);
}

// A constant set ("Reduce attached hero's Willpower, Attack, and Defense to 0", 141055:A:2) is a set modifier (rr.modifiers).
function setRecord(state: ScenarioState, source: CardInstance, effectId: string, instruction: Extract<Instruction, { verb: "SetStat" }>, ctx: ReduceContext): Modifier[] {
  return holders(state, source, instruction.target, ctx).map((holder) => ({
    instanceId: holder,
    sourceId: source.id,
    stat: instruction.stat,
    amount: instruction.value,
    until: "whileSourceInPlay",
    origin: effectId,
    set: true,
  }));
}

function wanted(state: ScenarioState, ctx: ReduceContext): Modifier[] {
  const found: Modifier[] = [];
  for (const { source, effect, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb === "SetStat") found.push(...setRecord(state, source, effect.id, instruction, ctx));
    if (instruction.verb !== "ModifyStat") continue;
    // "for each Hobbit hero you control", "for each enemy engaged with you" are counted here, each time the records are rebuilt.
    const seat = source.controller ?? state.firstPlayer;
    const base = resolveAmount(state, instruction.amount, { actor: seat, sourceId: source.id }, ctx);
    const read = instruction.per === "hobbitHero" ? base * hobbitHeroes(state, source, ctx) : base;
    const amount = instruction.subtract ? -read : read;
    if (amount === 0) continue;
    const named = instruction.holders ? matching(state, source, instruction.holders, ctx) : holders(state, source, instruction.target, ctx, instruction.trait);
    for (const holder of named) {
      // "+1 Willpower for each restricted attachment on it": the amount times the matching cards attached to the holder.
      const factor = instruction.eachAttached ? attachedCount(state, holder, instruction.eachAttached, source.id, ctx) : 1;
      if (factor === 0) continue;
      found.push({
        instanceId: holder,
        sourceId: source.id,
        stat: instruction.stat,
        amount: amount * factor,
        until: source.zone === "victory" ? "whileSourceInVictory" : "whileSourceInPlay",
        origin: effect.id,
        ...(instruction.per === "committed" || instruction.per === "ally" ? { per: instruction.per } : {}),
        ...(isStatCondition(instruction.when) ? { when: instruction.when } : {}),
      });
    }
  }
  return found;
}

// Field by field, as the records are plain data. A `when` condition comes from the effect record, so the same record gives the
// same object; only a different one is compared in depth.
function sameModifiers(left: readonly Modifier[], right: readonly Modifier[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((a, index) => {
    const b = right[index]!;
    return (
      a.instanceId === b.instanceId &&
      a.sourceId === b.sourceId &&
      a.stat === b.stat &&
      a.amount === b.amount &&
      a.until === b.until &&
      a.origin === b.origin &&
      a.per === b.per &&
      a.seat === b.seat &&
      a.against === b.against &&
      a.set === b.set &&
      (a.when === b.when || JSON.stringify(a.when) === JSON.stringify(b.when))
    );
  });
}

export function syncConstants(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const current = state.modifiers.filter((modifier) => modifier.origin != null);
  if (current.length === 0 && !ctx.effects.some((effect) => effect.timing === "constant")) return state;
  const desired = wanted(state, ctx);
  if (sameModifiers(current, desired)) return state;
  return { ...state, modifiers: [...state.modifiers.filter((modifier) => modifier.origin == null), ...desired] };
}

// A constant victory condition ("If there are no Nazgûl enemies in play, the players win the game", 141027:B:1) ends the
// game as soon as it is met (rr.winning-the-game). It is read once no effect is resolving, so a stage whose When Revealed
// puts the enemies out is not won before they arrive. An open window closes: the resolution asks next.
export function constantWin(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (state.stageCleared || state.lost || state.failure || state.stack.length > 0) return state;
  if (!ctx.effects.some((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "WinGame"))) return state;
  for (const { instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb === "WinGame") return { ...state, stageCleared: true, window: null, pendingAttack: null };
  }
  return state;
}

export type HoldCounts = { committed: number; ally: number };

// A Hide number held by the table or by one seat. `per` modifiers count once for each committed character or ally.
export function heldStat(state: ScenarioState, seat: number, stat: ModifierStat, counts: HoldCounts): number {
  let total = 0;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== stat || !modifierActive(state, modifier)) continue;
    if (modifier.instanceId !== "table" && modifier.instanceId !== `seat:${seat}`) continue;
    total += modifier.amount * (modifier.per === "committed" ? counts.committed : modifier.per === "ally" ? counts.ally : 1);
  }
  return total;
}

export const NO_COUNTS: HoldCounts = { committed: 0, ally: 0 };

// An enemy that cannot attack one seat for now.
export function attackBarred(state: ScenarioState, enemyId: string, seat: number): boolean {
  return state.modifiers.some(
    (modifier) =>
      modifier.stat === "cannotAttack" &&
      modifier.instanceId === enemyId &&
      (modifier.seat == null || modifier.seat === seat) &&
      modifierActive(state, modifier),
  );
}
