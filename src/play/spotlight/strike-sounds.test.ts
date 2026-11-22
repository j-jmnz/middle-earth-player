// The sound of each attack at its hit stop (docs/design-system-table.md, Sound).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../rules/core/state.ts";
import type { Clash } from "../store/clash.ts";
import type { SpotlightGate } from "./gate.ts";
import { skippedSounds, strikeSounds } from "./strike-sounds.ts";

const shape = (damage: number, destroyed: boolean) => ({ damage, destroyed, shadow: false, first: true, last: true });

describe("strike sounds", () => {
  it("blocks, strikes and kills", () => {
    expect(strikeSounds({ shape: shape(0, false), enemyAttack: true })).toEqual(["combat.block"]);
    expect(strikeSounds({ shape: shape(2, false), enemyAttack: true })).toEqual(["combat.strike"]);
    expect(strikeSounds({ shape: shape(3, true), enemyAttack: true })).toEqual(["combat.kill"]);
  });

  it("misses when the players' attack deals no damage, and blocks when an enemy's attack does not", () => {
    expect(strikeSounds({ shape: shape(0, false), enemyAttack: false })).toEqual(["combat.miss"]);
    expect(strikeSounds({ shape: shape(0, false), enemyAttack: true })).toEqual(["combat.block"]);
  });

  it("adds the enemy's death when the players destroy an enemy", () => {
    expect(strikeSounds({ shape: shape(4, true), enemyAttack: false })).toEqual(["combat.kill", "combat.enemy-death"]);
  });

  it("plays a skipped gate's strongest sound once, from the first attack not yet heard", () => {
    const clash = (target: string, damage: number, destroyed: boolean): Clash => ({ attackers: ["x"], target, attack: 3, defense: 1, damage, destroyed, shadow: null, undefended: false, hitPoints: 3 });
    // e1 was engaged with a seat: the players' attack on it destroyed an enemy. The enemy's attack destroyed the ally a1.
    const before = { seats: [{ engaged: ["e1"] }, { engaged: [] }] } as unknown as ScenarioState;
    const gate = (clashes: Clash[]): SpotlightGate => ({ seq: 4, clashes, ended: "skipped", leaving: true, before, after: before });
    expect(skippedSounds(gate([clash("a1", 0, false), clash("a1", 2, true)]), 0)).toEqual(["combat.kill"]);
    expect(skippedSounds(gate([clash("h1", 0, false), clash("e1", 4, true)]), 0)).toEqual(["combat.kill", "combat.enemy-death"]);
    expect(skippedSounds(gate([clash("h1", 2, false), clash("h1", 0, false)]), 0)).toEqual(["combat.strike"]);
    expect(skippedSounds(gate([clash("e1", 0, false)]), 0)).toEqual(["combat.miss"]);
    expect(skippedSounds(gate([clash("e1", 0, false), clash("h1", 0, false)]), 0)).toEqual(["combat.block"]);
    expect(skippedSounds(gate([clash("a1", 2, true), clash("h1", 0, false)]), 1)).toEqual(["combat.block"]);
    expect(skippedSounds(gate([clash("a1", 2, true)]), 1)).toEqual([]);
  });
});
