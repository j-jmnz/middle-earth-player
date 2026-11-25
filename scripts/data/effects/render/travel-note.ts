// What bars a Travel effect: "If the players cannot pay the Travel cost, then they cannot travel to that location" (rr.travel). The engine reads some steps of a Travel line as costs and refuses the travel while one cannot be paid (travelCostUnpayable in src/rules/interpret/restrictions.ts and the `travel.unpayable` hook of the angmar, quest, sea, wilderland, flame and investigation families); the note lists those steps of one record.
import { renderCondition } from "./conditions.ts";
import { isObj, type Ctx, type Obj } from "./kit.ts";

// The reason a step is unpayable, or null when the engine does not read the step as a cost.
function reason(step: Obj, steps: readonly Obj[]): string | null {
  const pickBefore = steps.some((other) => other.verb === "Pick");
  const target = isObj(step.target) ? step.target : null;
  switch (step.verb) {
    case "Engage":
      return step.target === "picked" && pickBefore ? "no card matches the line's choose step" : null;
    case "PlaceResourceTokens":
      return step.on === "picked" && pickBefore ? "no card matches the line's choose step" : null;
    case "RemoveResourceTokens":
      return step.on === "picked" && pickBefore ? "no card the line's choose step finds holds a resource token (read by the angmar family)" : null;
    case "Pick":
      return isObj(step.pick) && step.pick.type === "enemy" ? "no enemy matches the choose step (read by the angmar family)" : null;
    case "Exhaust":
      if (target?.kind === "picked") return "the line's choose step finds fewer cards than it must exhaust";
      return target?.kind === "byCode" || target?.kind === "byName" ? `no ready copy of the card it exhausts is in play${step.who === "firstPlayer" ? " under the first player's control" : ""}` : null;
    case "DiscardPicked":
      return pickBefore ? "no card matches the line's choose step" : null;
    case "PickDiscardTop":
      return "the encounter discard pile holds no card of the kind (read by the angmar family)";
    case "SearchReveal":
      return step.cost === true ? "no matching card is in the encounter deck or its discard pile (read by the angmar family)" : null;
    case "DealShadowInPlay":
      return "the shadow card cannot be dealt (read by the angmar family)";
    case "SpendResources":
      return "the heroes hold fewer resources than the cost";
    case "Choose":
      return "no option can be taken";
    case "RevealBurden":
      return "the burden deck is empty";
    case "RevealCorsair":
      return "the Corsair deck and its discard pile are empty (read by the sea family)";
    case "DiscardRandomFromHand":
      return step.who === "firstPlayer" && typeof step.amount === "number" ? "the first player's hand holds fewer cards than must be discarded" : null;
    case "ForEachPlayer": {
      const inner = Array.isArray(step.instructions) ? step.instructions.filter(isObj) : [];
      if (inner.some((one) => one.verb === "DiscardRandomFromHand")) return "some player's hand holds fewer cards than they must discard";
      if (inner.some((one) => one.verb === "Pick") && inner.some((one) => one.verb === "Exhaust")) return "some player has no card to choose and exhaust";
      if (inner.some((one) => one.verb === "SpendResources")) return "some player's heroes hold fewer resources than they must spend (read by the investigation family)";
      if (inner.some((one) => one.verb === "MoveDamage")) return "Durin's Bane holds less damage than there are players (read by the flame family)";
      return null;
    }
    case "Heal":
      return step.target === "self" && typeof step.amount === "number" ? "this location holds less damage than must be removed" : null;
    case "MoveProgressToStormcaller":
      return "the current quest card holds less progress than must be moved";
    case "RemoveProgressFromQuest":
      return "the main quest holds less progress than must be removed (read by the quest family)";
    case "AddFromPile":
      return "the pile and its discard pile are empty (read by the wilderland family)";
    default:
      return null;
  }
}

/** The note for a Travel record: the steps the engine reads as costs, each with when the travel is barred; null when the record has none. */
export function travelNote(effect: Obj, ctx: Ctx): string | null {
  if (effect.timing !== "travel" || !Array.isArray(effect.instructions)) return null;
  const steps = effect.instructions.filter(isObj);
  const found = steps.flatMap((step) => {
    const why = reason(step, steps);
    if (why === null) return [];
    return [isObj(step.when) ? `${why} (owed only while ${renderCondition(step.when, ctx)})` : why];
  });
  const unique = [...new Set(found)];
  return unique.length === 0 ? null : `this Travel effect is a cost: the engine refuses the travel to this location while the players cannot pay it, that is, when ${unique.join("; or when ")}`;
}
