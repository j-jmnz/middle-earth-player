// Rules: rr.lasting-effects, faq.lasting-effects (data/rules/entries.json); ledger lines 146023:A:1, 146022:A:3, 146014:A:2. The numbers The Tower of Cirith Ungol's lasting effects add to a stat where it is read (modifiedStat in core/modified-stat.ts): held per damage on the card or per Willpower of the hero its source lies on,
// recalculated as the damage and the Willpower change.
import type { ModifierStat } from "../../../catalog/boundary.ts";

import { modifiedStat } from "../../core/keywords.ts";
import { heldAmountByClass, heldBy } from "../../core/holder-classes.ts";
import type { PrintedCard } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { modifierActive } from "../../core/state.ts";

// The stats whose modifier is held per damage on the card ("+1 Threat for each damage on it", 146023:A:1; "+1 Attack for each damage on it", 146022:A:3): the modifier's amount times the damage.
const PER_DAMAGE: Readonly<Partial<Record<ModifierStat, ModifierStat>>> = { threat: "threatPerDamage", attack: "attackPerDamage" };

/** The Threat or Attack a card holds from effects that count its damage: the amount of each modifier of its class times the damage on the card. 0 for any other stat or an undamaged card. */
export function perDamage(state: ScenarioState, instance: CardInstance, printed: PrintedCard, stat: ModifierStat): number {
  const held = PER_DAMAGE[stat];
  return held != null && instance.damage > 0 ? instance.damage * heldAmountByClass(state, instance, printed, held) : 0;
}

/** The Threat a card holds from effects that follow the Willpower of their source's host (the flag threatPerHostWillpower, an amount of -1 for "-X Threat", 146014:A:2): read now, so the number follows the hero's Willpower while the effect lasts. */
export function threatPerHostWillpower(state: ScenarioState, instance: CardInstance, printed: PrintedCard, cards: ReadonlyMap<string, PrintedCard>): number {
  let total = 0;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "threatPerHostWillpower" || !modifierActive(state, modifier) || !heldBy(modifier, instance, printed)) continue;
    const hostId = state.cards[modifier.sourceId]?.host;
    const host = hostId ? state.cards[hostId] : undefined;
    if (host) total += modifier.amount * modifiedStat(state, host, "willpower", cards);
  }
  return total;
}
