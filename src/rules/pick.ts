// Rules: rr.in-play-and-out-of-play, mec109.immune-to-player-card-effects, mec109.permanent (data/rules/entries.json).
import type { PickSpec } from "../catalog/boundary.ts";

import { attachmentHostIds } from "./attach.ts";
import { canAttack, characters, defendersOf, legalAttackEnemies } from "./combat.ts";
import { countsAsAttachment, hasTrait } from "./conditions.ts";
import type { ReduceContext } from "./interpret.ts";
import { playerCardEffectCanChoose, uniqueBlocked } from "./keywords.ts";
import { seatOf } from "./player-verbs.ts";
import { isPlayerType, printedOf } from "./printed.ts";
import { stagingLocations } from "./quest.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats } from "./state.ts";

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
): string[] {
  const asking = spec.who === "firstPlayer" ? state.firstPlayer : seat;
  const seats = spec.control === "you" ? [asking] : spec.control === "others" ? livingSeats(state).filter((index) => index !== asking) : livingSeats(state);
  if (spec.type === "player") return seats.filter((index) => !state.seats[index]?.eliminated).map((index) => `seat:${index}`);
  if (spec.hostForPicked) {
    const code = state.cards[picked.at(-1) ?? ""]?.code;
    return code ? attachmentHostIds(state, asking, code, ctx) : [];
  }
  const raw: string[] = [];
  const from = spec.from ?? "play";
  // Immunity is to player card effects: an encounter card's Pick may choose an immune card (mec109.immune-to-player-card-effects).
  const source = sourceId ? state.cards[sourceId] : undefined;
  const playerEffect = source == null || isPlayerType(printedOf(ctx.cards, source.code));
  if (from === "hand") for (const index of seats) raw.push(...(state.seats[index]?.hand ?? []));
  else if (from === "discard") {
    for (const index of seats) {
      const pile = state.seats[index]?.discard ?? [];
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
  }
  else if (from === "deck") {
    // "Look at the top X cards of any player's deck" (01067:A:1): the deck of the player the last Pick chose, X deep.
    // Before the player is chosen and X is paid (an event's play check) every deck and every depth may hold a target.
    const chosen = spec.ofPickedPlayer ? seatOf(picked.at(-1) ?? "") : null;
    const decks = chosen != null ? [chosen] : seats;
    const top = spec.topIsX ? (x ?? Number.MAX_SAFE_INTEGER) : (spec.top ?? Number.MAX_SAFE_INTEGER);
    for (const index of decks) raw.push(...(state.seats[index]?.deck ?? []).slice(0, top));
  } else if (spec.type === "attachment") {
    // Attachments in play that the chooser (or any player) controls, on any host. The pick is for a discard (141071:A:2):
    // a Permanent card on a hero cannot be discarded (mec109.permanent), so it is not offered. With `control: "any"` an
    // encounter card that counts as an attachment, which nobody controls, is one too (141055:A:2, 01061:A:1).
    for (const instance of Object.values(state.cards)) {
      if (instance.host == null) continue;
      if (instance.controller == null ? spec.control !== "any" || !countsAsAttachment(state, instance.id, ctx) : !seats.includes(instance.controller)) continue;
      if (instance.zone !== "play" && instance.zone !== "attached") continue;
      if (printedOf(ctx.cards, instance.code).keywords.permanent && state.cards[instance.host]?.zone === "heroes") continue;
      raw.push(instance.id);
    }
  } else if (spec.type === "enemy") {
    if (!spec.stagingOnly) for (const index of seats) raw.push(...(state.seats[index]?.engaged ?? []));
    if (spec.staging || spec.stagingOnly) raw.push(...state.staging);
  } else if (spec.type === "location") {
    raw.push(...stagingLocations(state, ctx.cards));
    if (!spec.stagingOnly) raw.push(...[state.activeLocation, state.secondActiveLocation].filter((id): id is string => id != null));
  } else {
    for (const index of seats) raw.push(...characters(state, index, ctx.cards));
  }
  return raw.filter((id) => {
    const instance = state.cards[id];
    if (!instance || (id === sourceId && (from !== "play" || spec.other)) || picked.includes(id)) return false;
    const printed = printedOf(ctx.cards, instance.code);
    if (playerEffect && !playerCardEffectCanChoose(printed)) return false;
    const typed = spec.type === "character" ? printed.type === "hero" || printed.type === "ally" : printed.type === spec.type || (spec.type === "attachment" && countsAsAttachment(state, id, ctx));
    if (spec.type !== "card" && !typed) return false;
    if (spec.damaged && instance.damage <= 0) return false;
    if (spec.keyword && !printed.keywords[spec.keyword]) return false;
    if (spec.trait && !hasTrait(state, id, spec.trait, ctx)) return false;
    if (spec.sphere && printed.sphere !== spec.sphere) return false;
    if (spec.nonNeutral && (printed.sphere == null || printed.sphere === "neutral")) return false;
    if (spec.exceptSphere && printed.sphere === spec.exceptSphere) return false;
    if (spec.cardType && printed.type !== spec.cardType) return false;
    if (spec.committed && !instance.committed) return false;
    if (spec.participating && !(participants ?? []).includes(id)) return false;
    if (spec.defending && !defendersOf(state).includes(id)) return false;
    if (spec.nonUnique && printed.isUnique) return false;
    if (spec.hasShadow && !instance.shadowId) return false;
    if (spec.intoPlay && uniqueBlocked(state, printed, ctx.cards)) return false;
    if (spec.costIsX && x != null && printed.cost !== x) return false;
    if (spec.maxCost != null && (printed.cost == null || printed.cost > spec.maxCost)) return false;
    if (spec.cost != null && (from === "play" || printed.cost !== spec.cost)) return false;
    if (spec.state === "ready" && instance.exhausted) return false;
    if (spec.state === "exhausted" && !instance.exhausted) return false;
    if (spec.canAttack && !legalAttackEnemies(state, instance.controller ?? seat, id, ctx.cards, true).length) return false;
    if (spec.attackableByPicked) {
      const attacker = picked.at(-1);
      if (!attacker || !canAttack(state, state.cards[attacker]?.controller ?? seat, attacker, id, ctx.cards, true)) return false;
    }
    return true;
  });
}
