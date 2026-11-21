// The sound of each attack (docs/design-system-table.md, Sound; played by strike-play.ts): at its hit stop while the spotlight plays it,
// or, for the attacks a skip jumped past (a tap, Back, or a spotlight that never played: the Combat spotlight off, reduced motion, a screen reader), the
// strongest of their sounds once as the gate ends, so a fight is never silent. A block when no damage got through, the kill sting when
// the target was destroyed, with the enemy's death at the same moment when the players destroyed an enemy, and a weapon's strike otherwise.
import type { SoundSlot } from "../../ui/sound/slots.ts";
import type { Clash } from "../store/clash.ts";
import type { ClashShape } from "./beats.ts";
import type { SpotlightGate } from "./gate.ts";

export function strikeSounds(clash: { shape: ClashShape; enemyAttack: boolean }): SoundSlot[] {
  if (clash.shape.damage === 0) return ["combat.block"];
  if (!clash.shape.destroyed) return ["combat.strike"];
  return clash.enemyAttack ? ["combat.kill"] : ["combat.kill", "combat.enemy-death"];
}

const STRENGTH: readonly SoundSlot[] = ["combat.block", "combat.strike", "combat.kill"];

/**
 * The sounds of a skipped gate's attacks from `from` on: the strongest one (a kill over a strike over a block), with the enemy's death
 * when an enemy the players attacked was destroyed. An attack's target is an enemy when it was engaged with a seat before the attacks.
 */
export function skippedSounds(gate: SpotlightGate, from: number): SoundSlot[] {
  const left = gate.clashes.slice(from);
  if (left.length === 0) return [];
  const enemy = (clash: Clash) => gate.before?.seats.some((seat) => seat.engaged.includes(clash.target)) === true;
  const sounds = left.flatMap((clash) => strikeSounds({ shape: { damage: clash.damage, destroyed: clash.destroyed, shadow: false, first: false, last: false }, enemyAttack: !enemy(clash) }));
  const strongest = STRENGTH.reduce<SoundSlot | null>((best, slot) => (sounds.includes(slot) ? slot : best), null);
  return [...(strongest ? [strongest] : []), ...(sounds.includes("combat.enemy-death") ? (["combat.enemy-death"] as const) : [])];
}
