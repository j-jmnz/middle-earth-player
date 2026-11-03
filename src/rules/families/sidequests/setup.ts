// Rules: rr.setup, mec109.setup, rr.campaign-pool (data/rules/entries.json).
//
// Setup lines on the cards a player starts with in play: a hero ("Setup: Add 2 resources to Denethor's resource pool.") or a
// contract (Sméagol shuffles himself in this way, misc family). They resolve once, after the opening hands and mulligans, before the quest card's Setup, for each player in player
// order. (The Rules Reference in data/rules does not say when a hero's Setup resolves; mec109.setup says a card in a deck is
// searched out before the opening hand is drawn. Resolving after the mulligan lets a Setup that searches the deck work on the
// deck that remains, and was chosen for that.)
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectsOf } from "../../windows/listen.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";

// The Setup records of each hero and contract the players start with, as effect frames; the state is returned as it is when no
// such card has one, or once they have been pushed.
export function pushPlayerSetup(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.playerSetup) return state;
  const due: { id: string; seat: number; code: string }[] = [];
  for (const seat of livingSeats(state)) {
    const seated = state.seats[seat];
    if (!seated) continue;
    for (const id of [...seated.heroes, ...seated.play]) {
      const card = state.cards[id];
      if (!card) continue;
      const type = printedOf(ctx.cards, card.code).type;
      if ((type === "hero" || type === "contract") && effectsOf(ctx, card.code).some((effect) => effect.timing === "setup")) due.push({ id, seat, code: card.code });
    }
  }
  if (due.length === 0) return state;
  // The first in player order resolves first, so it is pushed last.
  let next: ScenarioState = { ...state, playerSetup: true };
  for (const entry of [...due].reverse()) {
    next = pushCardEffects(next, "setup", entry.id, entry.seat, false, effectsOf(ctx, entry.code).filter((effect) => effect.timing === "setup"), ctx, steps);
  }
  return next;
}
