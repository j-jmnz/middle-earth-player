// Rules: rr.attachment-cards, rr.lasting-effects, rr.shadow-effects, rr.travel, rr.guarded (data/rules/entries.json); ledger lines 21017:A:1, 21021:A:1, 21024:A:2, 21025:A:1, 21027:A:2 and those of Danger in Dorwinion (21030 to 21052, 21077 to 21079).
// The verbs src/catalog/families/mordor.ts adds: a treachery of the discard pile attached to an enemy (attach.ts), a lasting effect held by a class of cards (held.ts), the ally Secret Cultist makes an enemy (convert.ts), the Travel effect of the active location resolved as an effect (travel.ts), the
// shadow cards Black Númenórean keeps (shadows.ts), the cards facedown under Seedy Tavern and the events Bribes counts (under.ts), the random set-aside Plot and Cultist cards (set-aside.ts), the damage Overwhelmed bars and the threat raise Darkness in the East reads (rounds.ts)
// and the Evidence of the Cult that is free (free.ts, a settle sweep).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { attachTreachery } from "./attach.ts";
import { convertAttachedAlly, returnConvertedAlly } from "./convert.ts";
import { victoryWhenFreeAddsResource } from "./free.ts";
import { modifyHeld } from "./held.ts";
import { barDamageToEngaged, mordorCondition } from "./rounds.ts";
import { addRandomSetAsideToStaging } from "./set-aside.ts";
import { keepDealtShadow, resolveHeldShadowEffects } from "./shadows.ts";
import { resolveActiveTravel } from "./travel.ts";
import { placeResourcePerDiscarded, revealFacedownUnder } from "./under.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "AttachTreachery":
      return attachTreachery(state, instruction, focus, ctx);
    case "ModifyHeld":
      return modifyHeld(state, instruction, focus, ctx);
    case "AddRandomSetAsideToStaging":
      return addRandomSetAsideToStaging(state, instruction, focus, ctx, steps);
    case "ConvertAttachedAlly":
      return convertAttachedAlly(state, focus, ctx, steps);
    case "ReturnConvertedAlly":
      return returnConvertedAlly(state, instruction, focus, ctx);
    case "ResolveActiveTravel":
      return resolveActiveTravel(state, focus, ctx, steps);
    case "KeepDealtShadow":
      return keepDealtShadow(state, focus, ctx);
    case "ResolveHeldShadowEffects":
      return resolveHeldShadowEffects(state, focus, ctx, steps);
    case "PlaceResourcePerDiscarded":
      return placeResourcePerDiscarded(state, instruction, focus, ctx);
    case "RevealFacedownUnder":
      return revealFacedownUnder(state, focus, ctx, steps);
    case "BarDamageToEngaged":
      return barDamageToEngaged(state, focus);
    // A constant marker: the settle sweep (free.ts) reads it.
    case "VictoryWhenFreeAddsResource":
      return state;
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "mordor",
  verbs: ["AttachTreachery", "ModifyHeld", "AddRandomSetAsideToStaging", "ConvertAttachedAlly", "ReturnConvertedAlly", "ResolveActiveTravel", "KeepDealtShadow", "ResolveHeldShadowEffects", "PlaceResourcePerDiscarded", "RevealFacedownUnder", "BarDamageToEngaged", "VictoryWhenFreeAddsResource"],
  run,
  condition: mordorCondition,
  settle: { sweep: victoryWhenFreeAddsResource },
};
