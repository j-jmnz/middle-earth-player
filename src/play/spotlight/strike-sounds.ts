// The sound of one attack at its hit stop (docs/design-system-table.md, Sound): a block when no damage got through, the kill sting
// when the target was destroyed, with the enemy's death after it when the players destroyed an enemy, and a weapon's strike otherwise.
import type { SoundSlot } from "../../ui/sound/slots.ts";
import type { ClashShape } from "./beats.ts";

export function strikeSounds(clash: { shape: ClashShape; enemyAttack: boolean }): SoundSlot[] {
  if (clash.shape.damage === 0) return ["combat.block"];
  if (!clash.shape.destroyed) return ["combat.strike"];
  return clash.enemyAttack ? ["combat.kill"] : ["combat.kill", "combat.enemy-death"];
}
