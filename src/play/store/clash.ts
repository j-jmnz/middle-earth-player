// Rules: rr.step-6-4-3, rr.step-6-8b, rr.step-6-8-3, ltp.shadow-discard (data/rules/entries.json).
//
// The attacks a new state resolved, for the combat spotlight (docs/design-system-table.md, Spotlight; phase 24). Pure: it reads
// the same engine steps the banner (outcome.ts) and the dock (readout.ts) read, the `strike` the attack's numbers came from and
// the `damage` and `destroy` steps that follow it, and every number it returns is one of them. The UI never works one out.
//
// Archery, damage from a card effect, an attack that was canceled and an attack that placed no damage step (a card said the
// target takes none, or the damage went to the Ring-bearer's life) have no `strike` followed by its `damage`, and so no clash:
// the banner covers them.
import type { PrintedCard } from "../../rules/core/printed.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { shadowCards } from "../../rules/core/zones.ts";

/**
 * One attack in a new state.
 * - `attackers`: the enemy for an enemy's attack, the characters declared for the players' attack; the spotlight stands them left.
 * - `target`: the defender, the hero an undefended attack hit, or the enemy the players attacked.
 * - `attack`, `defense`: the strike's numbers (the defense of an undefended hero is 0).
 * - `damage`: the combat damage the engine placed on the target, after toughness. 0 is a blocked attack.
 * - `destroyed`: the attack destroyed the target.
 * - `shadow`: the shadow card the attack turned face up, or null.
 * - `hitPoints`: the target's hit points as the strike found it (its modified stat in `prev`), for the spotlight's gauge.
 */
export type Clash = { attackers: string[]; target: string; attack: number; defense: number; damage: number; destroyed: boolean; shadow: string | null; undefended: boolean; hitPoints: number };

// A strike ends where the next attack or strike of the same reduce begins.
function endOf(steps: readonly EngineStep[], from: number): number {
  const rest = steps.slice(from + 1).findIndex((step) => step.kind === "strike" || step.kind === "attack");
  return rest < 0 ? steps.length : from + 1 + rest;
}

// The characters a players' attack was declared with: the `attack` step before its strike names them; an older step, or one a
// window delayed past the reduce that declared it, is read from the strike the state still holds.
function attackersOf(prev: ScenarioState, steps: readonly EngineStep[], index: number, enemyId: string): string[] {
  for (let at = index - 1; at >= 0; at -= 1) {
    const step = steps[at];
    if (step?.kind === "attack" && step.side === "player" && step.enemyId === enemyId) return [...(step.attackerIds ?? prev.pendingStrike?.attackerIds ?? [])];
  }
  return [...(prev.pendingStrike?.enemyId === enemyId ? prev.pendingStrike.attackerIds : [])];
}

// The shadow card the enemy's attack turned face up. The engine turns it (or cancels it, which turns it too) before damage, and an
// action window may lie between the two, so the strike's state finds it face up beside the enemy; the last attack of the combat
// phase has already sent it to the discard pile. A shadow card still face down in the shadow zone was not turned. The additional
// shadow cards of a Ringwraith are read the same way, the first first.
function shadowOf(prev: ScenarioState, next: ScenarioState, enemyId: string): string | null {
  const dealt = [...new Set([...shadowCards(prev.cards[enemyId]), ...shadowCards(next.cards[enemyId])])];
  return (
    dealt.find((id) => {
      const card = next.cards[id];
      return card != null && (card.zone !== "shadow" || card.face === "up");
    }) ?? null
  );
}

/**
 * The attacks the intent resolved, in order. `prev` is the state it was sent in, `next` the state it left, `steps` the engine's,
 * `cards` the printed cards (for the target's hit points). Each `strike` that is followed by the damage step of its target is one
 * clash; a state with two attacks has two.
 */
export function clashesOf(prev: ScenarioState, next: ScenarioState, steps: readonly EngineStep[], cards: ReadonlyMap<string, PrintedCard>): Clash[] {
  const out: Clash[] = [];
  steps.forEach((step, index) => {
    if (step.kind !== "strike") return;
    // A location takes damage from the Watcher's shadow effect: not one of the three attacks the spotlight shows.
    const zone = prev.cards[step.targetId]?.zone ?? next.cards[step.targetId]?.zone;
    if (zone === "activeLocation" || zone === "secondActiveLocation") return;
    const range = steps.slice(index + 1, endOf(steps, index));
    // The combat damage is the step that follows the strike (the engine places it at once); no damage step, no spotlight.
    const damage = range.find((later) => later.kind === "damage" && later.targetId === step.targetId);
    if (damage?.kind !== "damage") return;
    const attackers = step.side === "enemy" ? [step.enemyId] : attackersOf(prev, steps, index, step.enemyId);
    if (attackers.length === 0) return;
    const target = prev.cards[step.targetId] ?? next.cards[step.targetId];
    out.push({
      attackers,
      target: step.targetId,
      attack: step.attack,
      defense: step.defense,
      damage: Math.max(0, damage.amount),
      destroyed: range.some((later) => later.kind === "destroy" && later.targetId === step.targetId),
      shadow: step.side === "enemy" ? shadowOf(prev, next, step.enemyId) : null,
      undefended: step.undefended,
      hitPoints: target ? modifiedStat(prev.cards[step.targetId] ? prev : next, target, "hitPoints", cards) : 0,
    });
  });
  return out;
}
