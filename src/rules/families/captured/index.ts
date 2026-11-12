// Rules: mec108.captured-deck, mec108.captured-cards, mec108.capture-x, mec108.joining-another-player, mec108.create-staging-area (data/rules/entries.json); the cards of Escape from Mount Gram (10038 to 10053, 10174, 10175).
// The vocabulary of src/catalog/families/captured.ts: the captured deck, Capture X, the cards captured underneath a card and their rescue, joining another player's staging area. The marker verbs (Capture, InEveryArea, CaptureInsteadOfDamage on an enemy) are read by the engine where
// it moves a card (entry.ts, zones.ts) or deals damage (play.ts captureInstead); RecordStolenCards is a Resolution verb (rules/setup/resolution.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { captureFromDeckVerb, chooseBoonToHand, discardCapturedTop, discardCapturedUnder, prepareCapturedDeck, setAsideCapturedBoons } from "./deck.ts";
import { joinAnotherPlayer } from "./join.ts";
import { attachBoonsOfSubject, captureAttachments, capturePicked, capturingAttack, engageSelfWithPicked, putCapturedIntoPlay } from "./play.ts";
import { capturedAmount, capturedHolds, capturedPool } from "./values.ts";

// The verbs src/catalog/families/captured.ts adds. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "Capture":
    case "InEveryArea":
    case "RecordStolenCards":
      return state;
    case "PrepareCapturedDeck":
      return prepareCapturedDeck(state, focus, ctx);
    case "SetAsideCapturedBoons":
      return setAsideCapturedBoons(state);
    case "CaptureFromDeck":
      return captureFromDeckVerb(state, instruction, focus);
    case "CapturePicked":
      return capturePicked(state, focus);
    case "CaptureAttachments":
      return captureAttachments(state);
    // On an enemy a marker the damage step reads; as a Shadow effect it marks the attack in progress.
    case "CaptureInsteadOfDamage":
      return state.pendingAttack ? capturingAttack(state) : state;
    case "PutCapturedIntoPlay":
      return putCapturedIntoPlay(state, focus, ctx, steps, instruction);
    case "DiscardCapturedUnder":
      return discardCapturedUnder(state, instruction, focus, ctx, steps);
    case "DiscardCapturedTop":
      return discardCapturedTop(state, instruction, focus, ctx, steps);
    case "EngageSelfWithPicked":
      return engageSelfWithPicked(state, focus);
    case "JoinAnotherPlayer":
      return joinAnotherPlayer(state, instruction, focus, ctx, steps);
    case "AttachHeroBoons":
      return attachBoonsOfSubject(state, focus);
    case "ChooseBoonToHand":
      return chooseBoonToHand(state, instruction, focus, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "captured",
  verbs: ["Capture", "InEveryArea", "PrepareCapturedDeck", "SetAsideCapturedBoons", "CaptureFromDeck", "CapturePicked", "CaptureAttachments", "CaptureInsteadOfDamage", "PutCapturedIntoPlay", "DiscardCapturedUnder", "DiscardCapturedTop", "EngageSelfWithPicked", "JoinAnotherPlayer", "AttachHeroBoons", "RecordStolenCards", "ChooseBoonToHand"],
  run,
  pool: (state, spec, asking, sourceId, ctx) => capturedPool(state, spec, asking, sourceId, ctx),
  condition: (state, condition, scope) => capturedHolds(state, condition, scope),
  amount: (state, found, scope, ctx) => capturedAmount(state, found, scope, ctx),
};
