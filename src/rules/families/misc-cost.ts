// Rules: rr.cost, rr.resource-match, rr.the-letter-x (data/rules/entries.json).
//
// What the misc family changes about paying for a card: a fixed X ("X is the number of players in the game"), Secrecy a card in
// play grants the first matching card its controller plays each round, and the spheres a lasting effect lets any resource pay for.
import { resolveAmount } from "../amounts.ts";
import { constantInstructions } from "../constant-records.ts";
import { holds } from "../conditions.ts";
import type { ReduceContext } from "../interpret.ts";
import { effectsOf } from "../listen.ts";
import { matchesPick } from "../pick.ts";
import { printedOf, type Sphere } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { heldAmount } from "../state.ts";
import { seatThreat } from "./play-hooks.ts";

// The X a card with a printed cost of X has fixed by a record of its own, or null when its player chooses X.
export function fixedX(state: ScenarioState, cardId: string, ctx: ReduceContext): number | null {
  const card = state.cards[cardId];
  if (!card || !printedOf(ctx.cards, card.code).costX) return null;
  const seat = card.controller ?? state.activeSeat;
  const scope = { actor: seat, sourceId: cardId, returned: 0 };
  for (const effect of effectsOf(ctx, card.code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb !== "FixedX" || (instruction.when && !holds(state, instruction.when, scope, ctx))) continue;
      return resolveAmount(state, instruction.amount, { actor: seat, sourceId: cardId }, ctx);
    }
  }
  return null;
}

// Whether the card's cost is X chosen by its player (a printed X no record fixes).
export function chosenX(state: ScenarioState, cardId: string, ctx: ReduceContext): boolean {
  const card = state.cards[cardId];
  return card != null && printedOf(ctx.cards, card.code).costX && fixedX(state, cardId, ctx) == null;
}

// The seat already played a card this round that matched the filter (so "the first ... each round" is spent).
function playedMatching(state: ScenarioState, seat: number, cardId: string, fits: (id: string) => boolean): boolean {
  return (state.played ?? []).some((entry) => entry.round === state.round && entry.seat === seat && entry.id !== cardId && state.cards[entry.id] != null && fits(entry.id));
}

// The Secrecy the constants of the seat's cards in play give the card, and the seat's threat allows (Secrecy X: X less while the
// player's threat is 20 or less).
export function grantedSecrecy(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): number {
  const card = state.cards[cardId];
  if (!card || seatThreat(state, seat) > 20) return 0;
  const sphere = printedOf(ctx.cards, card.code).sphere;
  let total = 0;
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "GrantSecrecy" || (source.controller ?? state.firstPlayer) !== seat) continue;
    const hostSphere = source.host ? printedOf(ctx.cards, state.cards[source.host]?.code ?? "").sphere : null;
    const fits = (id: string) =>
      matchesPick(state, id, instruction.pick, { seat, sourceId: null, counting: true }, ctx) &&
      (!instruction.hostSphere || printedOf(ctx.cards, state.cards[id]?.code ?? "").sphere === hostSphere);
    if (!fits(cardId) || (instruction.hostSphere && (hostSphere == null || sphere !== hostSphere))) continue;
    if (instruction.firstEachRound && playedMatching(state, seat, cardId, fits)) continue;
    total += instruction.amount;
  }
  return total;
}

const SPEND_FLAGS = { leadership: "spendAsLeadership", tactics: "spendAsTactics", spirit: "spendAsSpirit", lore: "spendAsLore" } as const;

// A lasting effect lets the seat's resources of any sphere pay for cards of the sphere it named ("A Good Harvest").
export function spendsAsSphere(state: ScenarioState, seat: number, sphere: Sphere | null): boolean {
  if (sphere == null || sphere === "neutral" || sphere === "fellowship" || sphere === "baggins") return false;
  return heldAmount(state, `seat:${seat}`, SPEND_FLAGS[sphere]) > 0;
}
