// When the table plays its combat loop: a fight, not the Combat phase alone; and when an enemy engaging sounds (docs/design-system-table.md, Sound).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../rules/core/state.ts";
import { combatMusic, newlyEngaged } from "./combat-music.ts";

type Shape = { phase: string; mode: string; pendingAttack: object | null; engaged: readonly string[]; lost?: boolean; stageCleared?: boolean };

// The few fields combatMusic reads, on two seats.
const state = ({ phase, mode, pendingAttack, engaged, lost = false, stageCleared = false }: Shape): ScenarioState =>
  ({ phase, mode, pendingAttack, lost, stageCleared, seats: [{ engaged }, { engaged: [] }] }) as unknown as ScenarioState;

describe("combat music", () => {
  it("stays calm through a Combat phase with no enemy engaged", () => {
    expect(combatMusic(state({ phase: "Combat", mode: "combatActions", pendingAttack: null, engaged: [] }))).toBe(false);
  });

  it("plays while an enemy is engaged in the Combat phase, and not in the other phases", () => {
    expect(combatMusic(state({ phase: "Combat", mode: "combatActions", pendingAttack: null, engaged: ["e1"] }))).toBe(true);
    expect(combatMusic(state({ phase: "Planning", mode: "planningActions", pendingAttack: null, engaged: ["e1"] }))).toBe(false);
  });

  it("plays for an attack resolving or waiting to, in any phase", () => {
    expect(combatMusic(state({ phase: "Quest", mode: "staging", pendingAttack: { enemyId: "e1" }, engaged: [] }))).toBe(true);
    expect(combatMusic(state({ phase: "Combat", mode: "enemyAttacks", pendingAttack: null, engaged: [] }))).toBe(true);
  });

  it("stays calm once the game has ended", () => {
    expect(combatMusic(state({ phase: "Combat", mode: "enemyAttacks", pendingAttack: null, engaged: ["e1"], lost: true }))).toBe(false);
  });
});

describe("engagement sound", () => {
  const engaged = (first: readonly string[], second: readonly string[], lost = false) => ({ lost, stageCleared: false, seats: [{ engaged: first }, { engaged: second }] }) as unknown as ScenarioState;

  it("sounds for an enemy that engages a seat, in any phase or from any effect", () => {
    expect(newlyEngaged(engaged([], []), engaged(["e1"], []))).toBe(true);
    expect(newlyEngaged(engaged(["e1"], []), engaged([], ["e1"]))).toBe(true);
  });

  it("is quiet when no enemy is newly engaged, or once the game has ended", () => {
    expect(newlyEngaged(engaged(["e1"], []), engaged(["e1"], []))).toBe(false);
    expect(newlyEngaged(engaged(["e1", "e2"], []), engaged(["e1"], []))).toBe(false);
    expect(newlyEngaged(engaged([], []), engaged(["e1"], [], true))).toBe(false);
  });
});
