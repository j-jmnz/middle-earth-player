// Rules: hob.sack-x, hob.sack-x-example, rr.attachment-cards (data/rules/entries.json); ledger lines 131044:A:1 to 131050:A:1. The When Sacked attach of a Sack card: the eligible character with the highest value, the first player choosing among those tied; with none the card is shuffled back into the Sack deck.
import type { Instruction } from "../../../catalog/boundary.ts";

import { characters } from "../../combat/combat.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { attachBlocked } from "../../interpret/restrictions.ts";
import { printedOf } from "../../core/printed.ts";
import { printedStat } from "../../core/printed-stat.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";
import { shufflePile } from "../../core/piles.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb = Extract<Instruction, { verb: "AttachSacked" }>;

function valueOf(state: ScenarioState, card: CardInstance, by: Verb["by"], ctx: ReduceContext): number {
  const printed = printedOf(ctx.cards, card.code);
  switch (by) {
    case "cost":
      return printed.cost ?? 0;
    case "hitPoints":
      return printed.health ?? 0;
    case "attachments":
      return card.attachments.length;
    case "resources":
      return card.resources;
    default:
      return printedStat(printed, by, card.face);
  }
}

/** The characters a Sack card may attach to: in play, not titled Gandalf (unless the line prints no exclusion: `anyTitle`), with no Sack attached and able to have the attachment. */
function eligible(state: ScenarioState, instruction: Verb, sackCode: string, ctx: ReduceContext): string[] {
  const heroes = new Set(livingSeats(state).flatMap((seat) => state.seats[seat]?.heroes ?? []));
  return livingSeats(state)
    .flatMap((seat) => characters(state, seat, ctx.cards))
    .filter((id) => (instruction.to === "hero" ? heroes.has(id) : instruction.to === "ally" ? !heroes.has(id) : true))
    .filter((id) => {
      const card = state.cards[id];
      return card != null && (instruction.anyTitle === true || printedOf(ctx.cards, card.code).name !== "Gandalf") && !card.attachments.some((other) => hasTrait(state, other, "Sack", ctx)) && !attachBlocked(state, ctx, id, sackCode);
    });
}

export function attachSacked(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!source) return state;
  const hosts = eligible(state, instruction, source.code, ctx);
  const top = Math.max(...hosts.map((id) => valueOf(state, state.cards[id] as CardInstance, instruction.by, ctx)));
  const best = hosts.filter((id) => valueOf(state, state.cards[id] as CardInstance, instruction.by, ctx) === top);
  // With no character to hold it the card goes back into the deck, shuffled in.
  if (best.length === 0) return shufflePile(state, "sackDeck");
  const chosen = focus.chosen != null && best.includes(focus.chosen) ? focus.chosen : best.length === 1 ? best[0] : undefined;
  if (chosen == null) {
    // The first player chooses among the characters tied; with no effect open there is nobody to ask, and the first of them takes it.
    if (!effectData(state)) return attachSelf(state, source.id, best[0] as string, ctx);
    return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, best);
  }
  return attachSelf(state, source.id, chosen, ctx);
}
