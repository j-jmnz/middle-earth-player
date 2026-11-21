// Rules: rr.staging-area, rr.lasting-effects (data/rules/entries.json); ledger lines 11060:A:1, 12075:A:1, 143065:A:2, 148015:A:2.
// The engaged enemies that contribute their Threat to the total Threat in the staging area.
import { modifiedStat } from "../core/keywords.ts";
import { printedOf, type PrintedCard } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";
import { flagged, modifierActive } from "../core/state.ts";
import { headOf } from "../families/breaking/areas.ts";
import type { ThreatSource } from "./quest.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// An enemy engaged with a player that contributes its Threat to the staging area's ("each Ship enemy engaged with you contributes its Threat", 11060:A:1; "While engaged with a player, Faithless Desecrator contributes its Threat", 12075:A:1). Only the games with
// ships (`sea`) or an Uncharted deck (`uncharted`) have such a card, so no other game reads the engaged enemies here.
// `engagedThreatSeat` on a seat ("each enemy engaged with you adds its Threat ... until the end of the round", 143065:A:2) is read live: an enemy that engages that seat later counts too (rr.lasting-effects). With a Trait it counts the enemies with it only ("each Wight enemy engaged with you", 148015:A:2).
// On a seat's view once the areas are separate, only the enemies engaged with the players of that area count: the others are in another staging area.
export function engagedContributors(view: ScenarioState, cards: Cards): ThreatSource[] {
  const found: ThreatSource[] = [];
  if (!(view.sea || view.uncharted || view.modifiers.some((modifier) => modifier.stat === "engagedThreat" || modifier.stat === "engagedThreatSeat"))) return found;
  view.seats.forEach((seat, index) => {
    if (view.separate && view.viewSeat != null && headOf(view, index) !== view.viewSeat) return;
    const held = view.modifiers.filter((modifier) => modifier.stat === "engagedThreatSeat" && modifier.instanceId === `seat:${index}` && modifier.amount > 0 && modifierActive(view, modifier));
    for (const id of seat.engaged) {
      const instance = view.cards[id];
      if (!instance || flagged(view, id, "noThreatContribution")) continue;
      const whole = held.some((modifier) => modifier.trait == null || printedOf(cards, instance.code).traits.includes(modifier.trait));
      if (whole || flagged(view, id, "engagedThreat")) found.push({ id, threat: modifiedStat(view, instance, "threat", cards), from: "engaged" });
    }
  });
  // The enemy engaged with every player while it stays in the staging area (the Dreadnaught, Massive) is engaged with the player the card names too: it contributes once more ("each Ship enemy engaged with you", 40024:A:1).
  for (const [id, instance] of Object.entries(view.cards)) {
    if (instance.zone === "staging" && view.modifiers.length > 0 && flagged(view, id, "engagedThreat") && flagged(view, id, "engagedWithAll") && !flagged(view, id, "noThreatContribution")) found.push({ id, threat: modifiedStat(view, instance, "threat", cards), from: "engaged" });
  }
  return found;
}
