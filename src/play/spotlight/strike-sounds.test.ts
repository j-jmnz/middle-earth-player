// The sound of each attack at its hit stop (docs/design-system-table.md, Sound).
import { describe, expect, it } from "vitest";

import { strikeSounds } from "./strike-sounds.ts";

const shape = (damage: number, destroyed: boolean) => ({ damage, destroyed, shadow: false, first: true, last: true });

describe("strike sounds", () => {
  it("blocks, strikes and kills", () => {
    expect(strikeSounds({ shape: shape(0, false), enemyAttack: true })).toEqual(["combat.block"]);
    expect(strikeSounds({ shape: shape(2, false), enemyAttack: true })).toEqual(["combat.strike"]);
    expect(strikeSounds({ shape: shape(3, true), enemyAttack: true })).toEqual(["combat.kill"]);
  });

  it("adds the enemy's death when the players destroy an enemy", () => {
    expect(strikeSounds({ shape: shape(4, true), enemyAttack: false })).toEqual(["combat.kill", "combat.enemy-death"]);
  });
});
