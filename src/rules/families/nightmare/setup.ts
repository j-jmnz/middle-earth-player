// Rules: mec109.setup, rr.setup, rr.forced, rr.quest-advancement (data/rules/entries.json); ledger lines 900101:A:2, 906101:A:2, 906401:A:2.
//
// The Nightmare setup card's own lines: its Setup lines and its "During setup" Forced effects (setup.ts finishSetup), and the stage reveal
// it hears (stage-reveal.ts). A named card read as its Nightmare twin is `twinCode` (families/nightmare/guards.ts).
import type { EngineStep } from "../../intents.ts";
import { pushCardEffects } from "../../effect-frames.ts";
import { runEffect, type ReduceContext } from "../../interpret.ts";
import type { ScenarioState } from "../../state.ts";
import { fireForced } from "../../triggers.ts";
import { withFrame } from "../../windows.ts";
import { listenerInPlay } from "./guards.ts";

// A quest card became the current stage (afterProgress, rules/stage-reveal.ts): Forced effects that listen for it resolve
// ("Forced: When stage 3A is revealed", 906101:A:2). The event is about no card, so the setup card next to the quest deck hears it; its
// `subject` names the stage. It is announced only while a card that listens is in play.
// `afterStageRevealed` ("Forced: After stage 2B is revealed", 11182:A:3) is announced before the stage's When Revealed frames are pushed, so it resolves once they have.
export function announceStageRevealed(state: ScenarioState, stageId: string, ctx: ReduceContext, steps: EngineStep[], trigger: "stageRevealed" | "afterStageRevealed" = "stageRevealed"): ScenarioState {
  if (!listenerInPlay(state, trigger, ctx.effects)) return state;
  return fireForced(state, { trigger, seat: null, subject: stageId }, ctx, steps);
}

// The setup card's own Setup lines (906401:A:2, "Setup: Set each copy of Pale-green Tentacle aside, out of play") resolve once the piles are
// dealt and the encounter cards' Setup has run, before the first quest card's Setup (setup.ts finishSetup; mec109.setup, rr.setup): the
// recipe is applied before the quest's Setup (docs/plans/nightmare-mode.md). The setup card stays where it is, next to the quest deck.
export function nightmareSetup(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (card.zone !== "nightmare") continue;
    for (const effect of ctx.effects) {
      if (effect.cardCode !== card.code || effect.timing !== "setup") continue;
      next = withFrame(next, "setup", card.id, false, (framed) => runEffect(framed, effect, card.id, next.firstPlayer, ctx, steps), steps);
      if (next.failure || next.lost) return next;
    }
  }
  return next;
}

// The setup card's Forced effects that say "During setup" (900101:A:2) go down once the first quest card's Setup and When Revealed frames are
// on the stack (setup.ts finishSetup), so they resolve first, before the first round (rr.setup).
export function nightmareDuringSetup(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (card.zone !== "nightmare") continue;
    const own = ctx.effects.filter((effect) => effect.cardCode === card.code && effect.timing === "forced" && effect.trigger === "duringSetup");
    next = pushCardEffects(next, "forced", card.id, next.firstPlayer, false, own, ctx, steps);
  }
  return next;
}
