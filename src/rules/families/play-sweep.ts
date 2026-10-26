// Rules: rr.card-types, rr.ownership-and-control, rr.constant-ability (data/rules/entries.json).
//
// Rules the play family's constants keep true at all times, checked by settle (machine.ts) with the other sweeps: an ally that
// gained the hero card type sits among its controller's heroes and functions as a hero ("Attached character loses the ally card
// type and gains the hero card type", rr.card-types); a card the first player controls follows the token ("The first player
// gains control of attached ally"); a card that must be discarded at a stat ("Discard Denethor if his Willpower is 0 or less").
import type { Effect, Instruction } from "../../catalog/boundary.ts";

import { constantInstructions } from "../constant-records.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { destroyCard, modifiedStat } from "../keywords.ts";
import { printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { flagged, inPlay, livingSeats } from "../state.ts";
import { moveCard } from "../zones.ts";
import { giveControl } from "./play-control.ts";

const CODES = new WeakMap<readonly Effect[], ReadonlySet<string>>();

// The cards whose constants this sweep keeps (read once per effect list).
function sweptCodes(ctx: ReduceContext): ReadonlySet<string> {
  let known = CODES.get(ctx.effects);
  if (!known) {
    known = new Set(ctx.effects.filter((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "ControlledBy" || instruction.verb === "DiscardWhen")).map((effect) => effect.cardCode));
    CODES.set(ctx.effects, known);
  }
  return known;
}

// An ally that holds heroType moves among its controller's heroes; one that no longer holds it goes back to the play area.
function heroTypes(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const flags = state.modifiers.some((modifier) => modifier.stat === "heroType");
  const strays = livingSeats(state).some((seat) => (state.seats[seat]?.heroes ?? []).some((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type !== "hero"));
  if (!flags && !strays) return state;
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (card.controller == null || (card.zone !== "play" && card.zone !== "heroes")) continue;
    const hero = flagged(next, card.id, "heroType");
    if (card.zone === "play" && hero) next = moveCard(next, card.id, { zone: "heroes", seat: card.controller });
    else if (card.zone === "heroes" && !hero && printedOf(ctx.cards, card.code).type !== "hero") next = moveCard(next, card.id, { zone: "play", seat: card.controller });
  }
  return next;
}

export function playSweep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.lost) return state;
  let next = heroTypes(state, ctx);
  const codes = sweptCodes(ctx);
  if (codes.size === 0 || !Object.values(next.cards).some((card) => codes.has(card.code) && inPlay(card.zone))) return next;
  const rules: { sourceId: string; instruction: Instruction }[] = [];
  for (const { source, instruction } of constantInstructions(next, ctx)) {
    if (instruction.verb === "ControlledBy" || instruction.verb === "DiscardWhen") rules.push({ sourceId: source.id, instruction });
  }
  for (const { sourceId, instruction } of rules) {
    const source = next.cards[sourceId];
    if (!source || !inPlay(source.zone)) continue;
    if (instruction.verb === "ControlledBy") {
      const id = instruction.card === "host" ? source.host : source.id;
      if (id && next.cards[id]?.controller !== next.firstPlayer) next = giveControl(next, id, next.firstPlayer);
    } else if (instruction.verb === "DiscardWhen" && modifiedStat(next, source, instruction.stat, ctx.cards) <= instruction.max) {
      next = destroyCard(next, source.id, ctx.cards, steps);
    }
  }
  return next;
}
