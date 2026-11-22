// Rules: mec109.setting-up-the-game, rr.setup (data/rules/entries.json); ledger line 50801:A:1 (docs/scenarios/standalone-scenarios.md, The Siege of Annúminas, reading 3).
//
// The scenario's mode card (`ScenarioDefinition.modeCard`) with a Setup of its own: The Siege of Annúminas' Standard Game Mode is laid down on its Setup side before the quest card's Setup and
// resolves it ("set its city strength to 20"), then is flipped and kept beside the quest deck (setup.ts finishSetup). A mode card with no Setup record (the Dream-chaser Hard/Expert Mode card)
// is not laid down here: it enters at the end of Setup, on the side the players chose.
import type { Instruction, ScenarioDefinition } from "../../catalog/boundary.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ScenarioState } from "../core/state.ts";
import { updateCard } from "../core/state.ts";
import { spawn } from "../core/zones.ts";
import { pushCardEffects } from "../interpret/effect-frames.ts";
import { runEffect, type ReduceContext } from "../interpret/interpret.ts";
import { withFrame } from "../windows/windows.ts";

// The mode card's Setup records, run in a frame of their own with the card faceup on its Setup side (side A).
export function modeCardSetup(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const mode = state.modeCard;
  if (!mode) return state;
  const own = ctx.effects.filter((effect) => effect.cardCode === mode.code && effect.timing === "setup");
  if (own.length === 0) return state;
  const spawned = spawn(state, mode.code, { zone: "modeCard" }, "A");
  // A Setup that asks a player (The Hunt for the Dreadnaught's "Players prepare their fleet": each player chooses a ship) is one effect frame, resolved after Setup's own steps (docs/scenarios/standalone-scenarios.md, The Hunt for the Dreadnaught, reading 3).
  if (own.some((effect) => effect.instructions.some((instruction) => instruction.verb === "PrepareFleet"))) return pushCardEffects(spawned.state, "setup", spawned.id, state.firstPlayer, false, own, ctx, steps);
  let next = spawned.state;
  for (const effect of own) {
    next = withFrame(next, "setup", spawned.id, false, (framed) => runEffect(framed, effect, spawned.id, next.firstPlayer, ctx, steps), steps);
    if (next.failure || next.lost) return next;
  }
  return next;
}

// The end of Setup: a mode card already laid down is flipped to the side the game keeps ("Flip this card over and place it next to the quest deck"); any other is put down on that side.
export function placeModeCard(state: ScenarioState): ScenarioState {
  const mode = state.modeCard;
  if (!mode) return state;
  const down = Object.values(state.cards).find((card) => card.zone === "modeCard" && card.code === mode.code);
  return down ? updateCard(state, down.id, { face: mode.side }) : spawn(state, mode.code, { zone: "modeCard" }, mode.side).state;
}

// Whether the steps give the heroes resources, in a ForEachPlayer's steps too ("each player adds 1 resource to each hero").
function gainsResources(steps: readonly Instruction[]): boolean {
  return steps.some((step) => step.verb === "HeroesGainResources" || (step.verb === "ForEachPlayer" && gainsResources(step.instructions)));
}

// Easy's one resource for each hero is the mode card's own Setup line where the card prints it (The Hunt for the Dreadnaught's Easy Mode, "Add 1 resource to each hero's resource pool"): the generic step 2 of Setup then adds none
// (docs/scenarios/standalone-scenarios.md, The Hunt for the Dreadnaught, reading 2).
export function modeAddsEasyResource(definition: Pick<ScenarioDefinition, "modeCard">, ctx: ReduceContext): boolean {
  const mode = definition.modeCard;
  if (!mode) return false;
  return ctx.effects.some((effect) => effect.cardCode === mode.code && effect.timing === "setup" && gainsResources(effect.instructions));
}
