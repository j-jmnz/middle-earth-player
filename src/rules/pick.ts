// Rules: rr.in-play-and-out-of-play, mec109.immune-to-player-card-effects, mec109.permanent (data/rules/entries.json).
import type { PickSpec } from "../catalog/boundary.ts";

import { attachmentHostIds } from "./attach.ts";
import { canAttack, characters, legalAttackEnemies } from "./combat.ts";
import { hasTrait } from "./conditions.ts";
import { attachmentsPickMatches } from "./families/attachments-pick.ts";
import { costsPickMatches } from "./families/costs-pick.ts";
import { attackPickMatches } from "./families/attack-pick.ts";
import { miscPickMatches } from "./families/misc-pick.ts";
import { immuneToSource } from "./families/misc-guards.ts";
import { countsExtra } from "./families/misc-traits.ts";
import { seatThreat } from "./families/play-hooks.ts";
import { playPickMatches } from "./families/play-pick.ts";
import { playBlocked } from "./families/sidequests-contract.ts";
import { sidequestsPickMatches } from "./families/sidequests-pick.ts";
import { lookedPool } from "./families/deck-pick.ts";
import type { ReduceContext } from "./interpret.ts";
import { hasKeyword, modifiedStat, playerCardEffectCanChoose, uniqueBlocked } from "./keywords.ts";
import { cardTypeOf, isPlayerType, printedOf } from "./printed.ts";
import { stagingLocations } from "./quest.ts";
import type { ScenarioState } from "./state.ts";
import { inPlay, livingSeats } from "./state.ts";
import { canDeclareDefender, isDefending } from "./families/defense-defenders.ts";
import { facedownShadow } from "./families/defense-shadow.ts";

// What a filter is read against: who is choosing or counting, the effect's source, what it has picked, its X, and the
// characters of the attack a Response answers. `counting` reads every card that matches, immune ones too: a count or a
// condition is not a player card effect choosing a card.
export type PickContext = {
  seat: number;
  sourceId: string | null;
  picked?: readonly string[];
  x?: number;
  participants?: readonly string[];
  counting?: boolean;
  // The answered event's cards, when a condition is read for it (families/attack-pick.ts).
  subject?: string | null;
  other?: string | null;
};

function seatsOf(state: ScenarioState, spec: PickSpec, asking: number): number[] {
  if (spec.control === "you") return [asking];
  if (spec.control === "other") return livingSeats(state).filter((seat) => seat !== asking);
  return livingSeats(state);
}

// The cards a filter starts from: its zone group and whose cards they are.
function pool(state: ScenarioState, spec: PickSpec, asking: number, ctx: ReduceContext): string[] {
  const seats = seatsOf(state, spec, asking);
  const raw: string[] = [];
  const from = spec.from ?? "play";
  // Only the cards the running effect looked at or discarded (families/deck-pick.ts).
  if (spec.looked) return lookedPool(state, spec, seats);
  if (from === "hand") for (const index of seats) raw.push(...(state.seats[index]?.hand ?? []));
  else if (from === "victory") raw.push(...state.victory);
  else if (from === "loot") raw.push(...Object.values(state.cards).filter((card) => card.zone === "under" && card.controller != null && seats.includes(card.controller)).map((card) => card.id));
  else if (from === "discard") {
    for (const index of seats) {
      // `top`: the last cards put on the pile.
      const pile = spec.top != null ? (state.seats[index]?.discard ?? []).slice(-spec.top) : (state.seats[index]?.discard ?? []);
      if (!spec.topmost) raw.push(...pile);
      else {
        // The last card put on a discard pile is its top.
        const top = [...pile].reverse().find((id) => {
          const instance = state.cards[id];
          return instance != null && (!spec.cardType || printedOf(ctx.cards, instance.code).type === spec.cardType);
        });
        if (top) raw.push(top);
      }
    }
  } else if (from === "deck") for (const index of seats) raw.push(...(state.seats[index]?.deck ?? []).slice(0, spec.top ?? Number.MAX_SAFE_INTEGER));
  else if (spec.type === "attachment") {
    for (const instance of Object.values(state.cards)) {
      if (instance.host == null || (instance.zone !== "play" && instance.zone !== "attached")) continue;
      // An encounter attachment (a Condition) has no controller: any player's filter sees it.
      if (instance.controller != null && !seats.includes(instance.controller)) continue;
      raw.push(instance.id);
    }
  } else if (spec.type === "enemy") {
    const engagedSeats = spec.engaged === "you" ? [asking] : spec.engaged === "other" ? livingSeats(state).filter((seat) => seat !== asking) : livingSeats(state);
    if (!spec.stagingOnly) for (const index of engagedSeats) raw.push(...(state.seats[index]?.engaged ?? []));
    // `staging` with `engaged`: the staging area and the enemies engaged as `engaged` says ("or engaged with another player").
    if (spec.staging || (spec.stagingOnly && spec.engaged == null)) raw.push(...state.staging);
  } else if (spec.type === "location") {
    raw.push(...stagingLocations(state, ctx.cards));
    if (!spec.stagingOnly) raw.push(...[state.activeLocation, state.secondActiveLocation].filter((id): id is string => id != null));
  } else if (spec.type === "card" && spec.stagingOnly) {
    raw.push(...state.staging);
  } else if (spec.type === "card") {
    for (const index of seats) raw.push(...(state.seats[index]?.heroes ?? []), ...(state.seats[index]?.play ?? []));
    if (spec.control === "any") raw.push(...state.staging, ...[state.activeLocation].filter((id): id is string => id != null));
  } else {
    for (const index of seats) raw.push(...characters(state, index, ctx.cards));
  }
  return raw;
}

// Whether one card matches a filter's predicates (not its zone): what the filter reads of the card itself.
export function matchesPick(state: ScenarioState, id: string, spec: PickSpec, at: PickContext, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  if (!instance) return false;
  const printed = printedOf(ctx.cards, instance.code);
  const asking = spec.who === "firstPlayer" ? state.firstPlayer : at.seat;
  const picked = at.picked ?? [];
  const from = spec.from ?? "play";
  if ((id === at.sourceId && (from !== "play" || spec.other)) || (spec.different && picked.includes(id))) return false;
  if (spec.type !== "card" && spec.type !== "player") {
    // A card among a player's heroes is a hero: an ally that gained the hero card type sits there (heroType, families/play-sweep.ts).
    // An ally attached to another card (Wild Stallion) is an attachment while it is.
    const type = printed.type === "ally" && instance.host != null && instance.zone !== "heroes" ? "attachment" : cardTypeOf(instance, printed);
    const typed = spec.type === "character" ? type === "hero" || type === "ally" : type === spec.type;
    if (!typed) return false;
  }
  if (spec.trait && !hasTrait(state, id, spec.trait, ctx)) return false;
  if (spec.traits && !spec.traits.some((trait) => hasTrait(state, id, trait, ctx))) return false;
  if (spec.notTraits && spec.notTraits.some((trait) => hasTrait(state, id, trait, ctx))) return false;
  if (spec.names && !spec.names.includes(printed.name)) return false;
  if (spec.sphere && printed.sphere !== spec.sphere) return false;
  if (spec.spheres && (printed.sphere == null || !spec.spheres.includes(printed.sphere))) return false;
  if (spec.printedIcon && !(printed.type === "hero" && printed.sphere === spec.printedIcon)) return false;
  if (spec.nonNeutral && (printed.sphere == null || printed.sphere === "neutral")) return false;
  if (spec.exceptSphere && printed.sphere === spec.exceptSphere) return false;
  if (spec.cardType && printed.type !== spec.cardType) return false;
  if (spec.committed != null && instance.committed !== spec.committed) return false;
  if (spec.participating && !(at.participants ?? []).includes(id)) return false;
  if (spec.nonUnique && printed.isUnique) return false;
  if (spec.unique && !printed.isUnique) return false;
  if (spec.hasShadow && !instance.shadowId) return false;
  if (spec.keyword && !hasKeyword(state, id, spec.keyword, ctx.cards)) return false;
  if (spec.damaged != null && instance.damage > 0 !== spec.damaged) return false;
  if (spec.hasResources && instance.resources <= 0) return false;
  // The costs family's filters: a pool's size, a Valour ability, a lower threat cost, a pool that paid (families/costs-pick.ts).
  if (!costsPickMatches(state, id, spec, at.picked, ctx)) return false;
  if (spec.on && !onHost(state, instance.host, spec.on, asking, ctx)) return false;
  if (spec.notHost && at.sourceId != null && state.cards[at.sourceId]?.host === id) return false;
  // The attachments family's filters: attached or not, Guarded, progress tokens (families/attachments-pick.ts).
  if (!attachmentsPickMatches(state, id, spec, ctx)) return false;
  // The attack family's filters: printed keywords, the source's host, engaged with whom, a shared Trait, an attachment on the
  // event's card, printed hit points, the top of a discard pile (families/attack-pick.ts).
  if (!attackPickMatches(state, id, spec, at, ctx)) return false;
  // The play family's filters: a Trait shared with the source or its host (families/play-pick.ts).
  if (!playPickMatches(state, id, spec, at.sourceId, ctx)) return false;
  // The misc family's filters: controlled by the picked player, attached to the picked card, a player card, a Defense limit, drawn
  // in the resource phase (families/misc-pick.ts).
  if (!miscPickMatches(state, id, spec, at, ctx)) return false;
  // The sidequests family's filters: a Trait or a title shared with another card, the quest a character is committed to
  // (families/sidequests-pick.ts).
  if (!sidequestsPickMatches(state, id, spec, at, ctx)) return false;
  if (spec.attacking && !attackingNow(state, id)) return false;
  // Every defender of the attack in progress, the extra ones too (rr.multiple-defenders).
  if (spec.defending && !isDefending(state, id)) return false;
  if (spec.canDefend && !canDeclareDefender(state, id, ctx.cards)) return false;
  if (spec.facedownShadow && !facedownShadow(state, id)) return false;
  if (spec.attackingEnemy != null && (state.pendingAttack?.enemyId === id) !== spec.attackingEnemy) return false;
  if (spec.hasAttachment) {
    const want = spec.hasAttachment;
    const found = instance.attachments.some((attachmentId) => {
      const attachment = state.cards[attachmentId];
      if (!attachment) return false;
      if (want.trait && !hasTrait(state, attachmentId, want.trait, ctx)) return false;
      if (want.playerCard && !isPlayerType(printedOf(ctx.cards, attachment.code))) return false;
      return true;
    });
    if (!found) return false;
  }
  if (spec.aboveThreat) {
    const threat = seatThreat(state, asking);
    if (printed.engagementCost == null || modifiedStat(state, instance, "engagementCost", ctx.cards) <= threat) return false;
  }
  if (spec.intoPlay && (uniqueBlocked(state, printed, ctx.cards) || playBlocked(state, id, asking, ctx))) return false;
  if (spec.costIsX && at.x != null && printed.cost !== at.x) return false;
  if (spec.maxCost != null && (printed.cost == null || printed.cost > spec.maxCost)) return false;
  if (spec.minCost != null && (printed.cost == null || printed.cost < spec.minCost)) return false;
  if (spec.cost != null && (from === "play" || printed.cost !== spec.cost)) return false;
  if (spec.noVictory && (printed.victory ?? 0) > 0) return false;
  if (spec.state === "ready" && instance.exhausted) return false;
  if (spec.state === "exhausted" && !instance.exhausted) return false;
  if (spec.canAttack && !legalAttackEnemies(state, instance.controller ?? asking, id, ctx.cards, true).length) return false;
  if (spec.attackableByPicked) {
    const attacker = picked.at(-1);
    if (!attacker || !canAttack(state, state.cards[attacker]?.controller ?? asking, attacker, id, ctx.cards, true)) return false;
  }
  return true;
}

// An attachment's host is of the type and controlled as the filter's `on` says, from the chooser's side.
function onHost(state: ScenarioState, hostId: string | null, on: NonNullable<PickSpec["on"]>, asking: number, ctx: ReduceContext): boolean {
  const host = hostId ? state.cards[hostId] : undefined;
  if (!host || host.controller == null) return false;
  const type = cardTypeOf(host, printedOf(ctx.cards, host.code));
  if (on.type === "hero" ? type !== "hero" : type !== "hero" && type !== "ally") return false;
  return on.control === "any" || (on.control === "you") === (host.controller === asking);
}

// The character is attacking in the attack in progress: one of the attackers of a player attack.
function attackingNow(state: ScenarioState, id: string): boolean {
  return state.pendingStrike?.attackerIds.includes(id) === true;
}

// A Pick names cards or players a player may choose for the instructions after it. The seat is the one making the choice.
// Cards that are immune to player card effects cannot be chosen by a player card's Pick (mec109.immune-to-player-card-effects).
// An encounter card's Pick (141049:A:1, 141054:A:2, 141071:A:2) is not a player card effect.
export function pickCandidates(
  state: ScenarioState,
  spec: PickSpec,
  seat: number,
  picked: readonly string[],
  sourceId: string | null,
  ctx: ReduceContext,
  // The X an event was played for, for a pick that asks for a printed cost of X.
  x?: number,
  // The characters that took part in the attack the Response answers.
  participants?: readonly string[],
  counting = false,
  // The answered event's subject and other card, for a condition read about it (families/attack-pick.ts).
  event?: { subject?: string | null; other?: string | null },
): string[] {
  const asking = spec.who === "firstPlayer" ? state.firstPlayer : seat;
  if (spec.type === "player") return seatsOf(state, spec, asking).filter((index) => !state.seats[index]?.eliminated).map((index) => `seat:${index}`);
  if (spec.hostForPicked) {
    const code = state.cards[picked.at(-1) ?? ""]?.code;
    return code ? attachmentHostIds(state, asking, code, ctx) : [];
  }
  // Immunity is to player card effects: an encounter card's Pick may choose an immune card (mec109.immune-to-player-card-effects).
  const source = sourceId ? state.cards[sourceId] : undefined;
  const playerEffect = !counting && (source == null || isPlayerType(printedOf(ctx.cards, source.code)));
  const raw = spec.attachedTo ? attachedPool(state, spec.attachedTo, sourceId) : pool(state, spec, asking, ctx);
  const at: PickContext = { seat, sourceId, picked, ...(x != null ? { x } : {}), ...(participants ? { participants } : {}), counting, ...event };
  return raw.filter((id) => {
    const instance = state.cards[id];
    if (!instance) return false;
    // Only an attachment a player may discard is offered for one (141071:A:2): a Permanent card on a hero is not.
    if (spec.type === "attachment" && !counting && printedOf(ctx.cards, instance.code).keywords.permanent && state.cards[instance.host ?? ""]?.zone === "heroes") return false;
    if (playerEffect && !playerCardEffectCanChoose(printedOf(ctx.cards, instance.code))) return false;
    // "Immune to non-Master card effects": a card without that Trait cannot choose or affect it (families/misc-guards.ts).
    if (!counting && immuneToSource(state, id, sourceId, ctx)) return false;
    return matchesPick(state, id, spec, at, ctx);
  });
}

// The cards attached to the source, to the source's host, to the active location, or to the defending character.
function attachedPool(state: ScenarioState, where: "source" | "host" | "activeLocation" | "defender", sourceId: string | null): string[] {
  const source = sourceId ? state.cards[sourceId] : undefined;
  const defender = state.pendingAttack?.defenderId && !state.pendingAttack.undefended ? state.cards[state.pendingAttack.defenderId] : undefined;
  const holder =
    where === "defender" ? defender : where === "activeLocation" ? (state.activeLocation ? state.cards[state.activeLocation] : undefined) : where === "source" ? source : source?.host ? state.cards[source.host] : undefined;
  return holder ? holder.attachments.filter((id) => state.cards[id] != null && inPlay(state.cards[id]?.zone ?? "removed")) : [];
}

// How many cards match a filter from a seat's side: the count an amount or a condition reads.
export function countMatching(state: ScenarioState, spec: PickSpec, seat: number, sourceId: string | null, ctx: ReduceContext): number {
  const found = pickCandidates(state, spec, seat, [], sourceId, ctx, undefined, undefined, true);
  // "When counting the number of Dwarf characters you control, Bombur counts as two" (families/misc-traits.ts).
  return found.length + countsExtra(state, found, spec);
}
