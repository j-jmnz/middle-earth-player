// Rules: rr.modifiers, rr.lasting-effects (data/rules/entries.json). The stats of a card as the table reads them: the printed value with every modifier that holds, and the modifiers' conditions that ask who attacks or defends.
import type { ModifierStat, ModifierUntil } from "../../catalog/boundary.ts";
import { defendingAgainst } from "../families/angmar/combat.ts";
import { cardTypeOf, printedOf, type PrintedCard } from "./printed.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { flagged, isExhausted, modifierActive } from "./state.ts";
import { defenseFromWillpower } from "../families/defense/damage.ts";
import { attackingHolds } from "../families/attack/strike.ts";
import { seatThreat } from "../families/play/hooks.ts";
import { grappleThreat } from "../families/grapple/values.ts";
import { perDamage, threatPerHostWillpower } from "../families/cirith-ungol/values.ts";
import { perShadow } from "../families/wizards-quest/khazad.ts";
import { questProgressBonus } from "../families/wilderland/dolguldur.ts";
import { printedStat } from "./printed-stat.ts";
import { halvedThreat } from "../families/burgle/stack.ts";
import { fromPlayerCard, heldBy, type TraitCheck } from "./holder-classes.ts";
import { hasTrait } from "../interpret/conditions.ts";
import { inAreaOf } from "../families/breaking/areas.ts";
import { versusVictoryTrait } from "../families/captured/values.ts";

// The stats of a card. A value below 0 is treated as 0 (rr.modifiers).
const CARD_STATS: ReadonlySet<ModifierStat> = new Set(["willpower", "attack", "defense", "threat", "questPoints", "engagementCost", "hitPoints"]);

// `against` is the enemy the instance is attacking, for a modifier that only holds against some enemies.
// A set modifier overrides every other one, the most recent set winning (rr.modifiers).
export function modifiedStat(
  state: ScenarioState,
  instance: CardInstance,
  stat: ModifierStat,
  cards: ReadonlyMap<string, PrintedCard>,
  against?: string,
): number {
  // "Use their Willpower instead of Defense" (06038).
  if (stat === "defense" && defenseFromWillpower(state, instance, cards)) return modifiedStat(state, instance, "willpower", cards, against);
  // "During the encounter phase, treat each enemy's engagement cost as if it were 0" (41005:B:1).
  if (stat === "engagementCost" && state.phase === "Encounter" && flagged(state, "table", "engagementCostZero")) return 0;
  // "Reduce the engagement cost of each enemy not guarding an objective to 0 during these engagement checks" (17134:A:1): an enemy that holds no captive.
  if (stat === "engagementCost" && state.modifiers.length > 0 && flagged(state, "table", "engagementCostZeroUnguarded") && !Object.values(state.cards).some((other) => other.captive === true && other.host === instance.id)) return 0;
  const printed = printedOf(cards, instance.code);
  // The Threat of the enemies grappled with a location is added to it (dcce.grapple).
  let total = printedStat(printed, stat, instance.face) + (stat === "threat" ? grappleThreat(state, instance.id) : 0);
  let set: number | null = null;
  let gainBarred: boolean | undefined; // The table's noWillpowerGain, read once and only if a raise of Willpower is met.
  // The value with no modifier that lowers it: what a card that "cannot have its Willpower reduced" keeps (09013:A:2), or its Defense (900506:A:1).
  let floor = total;
  const has: TraitCheck = (trait) => hasTrait(state, instance.id, trait, { effects: [], cards }); // A class named by a Trait reads the Traits the card has now.
  for (const modifier of state.modifiers) {
    if (modifier.stat !== stat || !heldBy(modifier, instance, printed, has)) continue;
    if (!modifierActive(state, modifier)) continue;
    if (modifier.when?.kind === "versusHighEngagement" && !versusHighEngagement(state, modifier.when.role, instance, cards, against)) continue;
    if (modifier.when?.kind === "versusDefender" && !versusDefender(state, instance, modifier.when, cards)) continue;
    if (modifier.when?.kind === "defendingAgainst" && !defendingAgainst(state, instance, modifier.when.trait, { effects: [], cards })) continue;
    if (modifier.when?.kind === "versusVictoryTrait" && !versusVictoryTrait(state, instance, cards, against)) continue;
    if (modifier.when?.kind === "inArea" && !inAreaOf(state, instance, modifier.when.seat)) continue;
    // "While the character is exhausted" (Weighed Down, 132038:A:1); an unconscious character is not exhausted (hob.unconscious-characters).
    if (modifier.when?.kind === "holderExhausted" && !isExhausted(instance)) continue;
    // "+2 Attack while attacking that enemy": only while the holder attacks it.
    if (modifier.against != null && modifier.against !== against) continue;
    // "+1 Attack when attacking an Orc" (families/attack/strike.ts).
    if (modifier.when?.kind === "attacking" && !attackingHolds(state, modifier.when, instance, { effects: [], cards }, against)) continue;
    // "Characters cannot gain Willpower from player card effects" (901306:A:1): a raise from a player card is not counted; a reduction is.
    if (stat === "willpower" && !modifier.set && modifier.amount > 0) {
      gainBarred ??= flagged(state, "table", "noWillpowerGain");
      if (gainBarred && fromPlayerCard(state, modifier, cards)) continue;
    }
    if (modifier.set) set = modifier.amount;
    else total += modifier.amount;
    if (!modifier.set && modifier.amount > 0) floor += modifier.amount;
  }
  // Effects that count the damage on the card or the Willpower of its host (146023:A:1, 146022:A:3, 146014:A:2), recalculated as they change (faq.lasting-effects).
  total += perDamage(state, instance, printed, stat) + questProgressBonus(state, instance, printed, stat) + perShadow(state, instance, printed, stat);
  if (stat === "threat") total += threatPerHostWillpower(state, instance, printed, cards);
  const lowered = set ?? total;
  const value = lowered < floor && ((stat === "willpower" && flagged(state, instance.id, "cannotReduceWillpower")) || (stat === "defense" && flagged(state, instance.id, "cannotReduceDefense"))) ? floor : lowered;
  return CARD_STATS.has(stat) ? halvedThreat(state, instance, stat, Math.max(0, value)) : value;
}

// The enemy in this attack costs more to engage than the threat of the holder's controller. "Your threat" in "defending
// against an enemy with an engagement cost higher than your threat" is the threat of the player who controls the card.
export function versusHighEngagement(
  state: ScenarioState,
  role: "defending" | "attacking",
  holder: CardInstance,
  cards: ReadonlyMap<string, PrintedCard>,
  against?: string,
): boolean {
  if (holder.controller == null) return false;
  const threat = seatThreat(state, holder.controller);
  let enemyId: string | undefined;
  if (role === "defending") {
    const attack = state.pendingAttack;
    if (!attack || attack.defenderId !== holder.id || attack.undefended) return false;
    enemyId = attack.enemyId;
  } else {
    enemyId = against;
  }
  const enemy = enemyId ? state.cards[enemyId] : undefined;
  if (!enemy || printedOf(cards, enemy.code).engagementCost == null) return false;
  return modifiedStat(state, enemy, "engagementCost", cards) > threat;
}

// The holder is the enemy making the attack in progress and the character defending it has at most this many printed hit points (142071:A:2).
// With `ally`, the defender is an ally (12054:A:2).
export function versusDefender(state: ScenarioState, holder: CardInstance, versus: { maxHitPoints?: number; maxWillpower?: number; ally?: true }, cards: ReadonlyMap<string, PrintedCard>): boolean {
  const attack = state.pendingAttack;
  if (!attack || attack.enemyId !== holder.id || attack.defenderId == null || attack.undefended) return false;
  const defender = state.cards[attack.defenderId];
  const printed = defender ? printedOf(cards, defender.code) : null;
  if (printed == null || (versus.ally === true && cardTypeOf(defender!, printed) !== "ally")) return false;
  // "if the defending character has less than 2 Willpower" (901303:A:1): its current Willpower, modifiers counted.
  if (versus.maxWillpower != null && modifiedStat(state, defender!, "willpower", cards) > versus.maxWillpower) return false;
  return versus.maxHitPoints == null || (printed.health != null && printed.health <= versus.maxHitPoints);
}

// A character's defense as the defender of the attack in progress, read as if it were declared, so a modifier that holds
// only while it defends counts ("while defending against an enemy with an engagement cost higher than your threat":
// Hobbit Cloak 141013, Boromir 142004).
export function defenseAsDefender(state: ScenarioState, defenderId: string, cards: ReadonlyMap<string, PrintedCard>): number {
  const defender = state.cards[defenderId];
  if (!defender) return 0;
  const attack = state.pendingAttack;
  // The enemy making the attack says its defenders do not count their Defense (19067:A:1).
  if (attack && flagged(state, attack.enemyId, "defenseIgnored")) return 0;
  const declared = attack ? { ...state, pendingAttack: { ...attack, defenderId, undefended: false } } : state;
  return modifiedStat(declared, defender, "defense", cards);
}

export function addModifier(
  state: ScenarioState,
  instanceId: string,
  sourceId: string,
  stat: ModifierStat,
  amount: number,
  until: ModifierUntil,
): ScenarioState {
  if (!state.cards[instanceId]) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId, sourceId, stat, amount, until }] };
}

export { printedStat };
