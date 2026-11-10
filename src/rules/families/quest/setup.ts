// Rules: mec109.setup, rr.setup, rr.quest-cards-quest-deck, rr.reveal (data/rules/entries.json); ledger lines 01126:A:1, 01126:B:1.
//
// The first quest card's own text at the start of the game, once the piles have been dealt (setup.ts finishSetup). Its Setup is placed by
// the scenario's piles (cards set aside or added to staging), except a Setup that reveals encounter cards: "Each player reveals 1 card
// from the top of the encounter deck, and adds it to the staging area" (01126:A:1) is a record with a ForEachPlayer that holds a
// RevealEncounter, run here in a frame of its own after the deck is shuffled. The stage then turns to its side B, and its When Revealed
// effects resolve (01126:B:1, "Search the encounter deck for 1 Hill Troll (if one is not already in play)"), after the Setup's reveals.
import { setupRunVerbs, type Effect } from "../../../catalog/boundary.ts";

import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";

// A Setup record that reveals cards for each player, or attaches an encounter card to each objective (01123:A:1, GuardObjective), or has the
// first player attach a card to a hero (41004:A:1, AttachSetAside: the Cave Torch), or has each player choose a ship (PrepareFleet), or prepares the Uncharted deck (PrepareUnchartedDeck) or the Grotto deck (PrepareGrottoDeck): the Setup the piles cannot place.
// A Setup that searches the encounter deck for each player (142040:A:1, "each player adds 1 different location") or puts damage tokens on a
// card (PlaceDamageOn) is run here too.
// Which verbs do it is on their schema entries (`setupRuns`, src/catalog/verb-flags.ts): a verb run at the top level, or one inside a top-level ForEachPlayer or Each.
export function revealsPerPlayer(effect: Effect): boolean {
  if (effect.timing !== "setup") return false;
  const top = setupRunVerbs("top");
  const inForEachPlayer = setupRunVerbs("inForEachPlayer");
  const inEach = setupRunVerbs("inEach");
  const inChoose = setupRunVerbs("inChoose");
  return effect.instructions.some(
    (instruction) =>
      top.has(instruction.verb) ||
      (instruction.verb === "ForEachPlayer" && instruction.instructions.some((inner) => inForEachPlayer.has(inner.verb))) ||
      (instruction.verb === "Each" && instruction.instructions.some((inner) => inEach.has(inner.verb))) ||
      (instruction.verb === "Choose" && instruction.options.some((option) => option.instructions.some((inner) => inChoose.has(inner.verb)))),
  );
}

export function questStageStart(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = state.questStage;
  const code = id ? state.cards[id]?.code : undefined;
  if (!id || !code) return state;
  const own = ctx.effects.filter((effect) => effect.cardCode === code);
  // The When Revealed effects go down first, so the Setup's reveals resolve before them.
  let next = pushCardEffects(state, "whenRevealed", id, state.firstPlayer, false, own.filter((effect) => effect.timing === "whenRevealed"), ctx, steps);
  next = pushCardEffects(next, "setup", id, state.firstPlayer, false, own.filter(revealsPerPlayer), ctx, steps);
  return next;
}
