// Rules: rr.damage, rr.forced, rr.engaged (data/rules/entries.json); ledger line 19053:A:2.
// Urdug's immediate attack at the beginning of the quest phase: "If this attack deals damage, return Urdug and Tiny to the staging area."
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { CODES, idOf, legalIntents, loadRhovanionWorld, rhovanionTable, send, start, type PlayerIntent, type RhovanionWorld, type Run } from "../../../../test/scenarios/roam-across-rhovanion/scene.ts";

let world: RhovanionWorld;
beforeAll(async () => {
  world = await loadRhovanionWorld();
}, 120_000);

type Layout = Parameters<typeof rhovanionTable>[1];

// At the beginning of the quest phase an engaged Urdug attacks at once; the hero defends. `tweak` changes the table before the attack, given the hero's id.
function questAttack(layout: Layout, tweak?: (state: ScenarioState, hero: string) => ScenarioState): Run {
  const t = rhovanionTable(world, { phase: "Planning", deck: ["f0", "f3", "f0"], engaged: [{ code: CODES.urdugEnemy, seat: 0 }, { code: CODES.tinyEnemy, seat: 0 }], ...layout });
  let run = send(start(tweak ? tweak(t.state, t.hero) : t.state), { type: "Pass" }, t.ctx);
  for (let guard = 0; guard < 12 && run.state.phase === "Quest" && (run.state.pendingAttack != null || run.state.window?.kind === "defense" || run.state.window?.kind === "choose"); guard += 1) {
    const window = run.state.window;
    if (window?.kind === "defense") run = send(run, { type: "DeclareDefender", defenderId: t.hero }, t.ctx);
    else if (window?.kind === "choose") run = send(run, { type: "Choose", optionId: window.options[0] ?? "" }, t.ctx);
    else {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, t.ctx);
    }
  }
  return run;
}

const zoneOf = (run: Run, code: string): string | undefined => run.state.cards[idOf(run.state, code)]?.zone;

describe("19053 Urdug's attack at the beginning of the quest phase", () => {
  it("19053:A:2 engaged, Urdug makes an immediate attack at the beginning of the quest phase; if it deals damage Urdug and Tiny return to the staging area", () => {
    const hurt = questAttack({});
    expect(hurt.steps.some((step) => step.kind === "attack")).toBe(true);
    expect(zoneOf(hurt, CODES.urdugEnemy)).toBe("staging");
    expect(zoneOf(hurt, CODES.tinyEnemy)).toBe("staging");
  });

  // The record that heard "characterDestroyedByAttack" is gone: the one record on `damagedByAttack` covers a hero the damage destroys, so this test fails if that event stops being announced for it.
  it("19053:A:2 pins the removal of the second record: an attack whose damage destroys the hero returns Urdug and Tiny to the staging area through damagedByAttack alone", () => {
    let heroId = "";
    const killed = questAttack({}, (state, hero) => {
      heroId = hero;
      return updateCard(state, hero, { damage: 5 });
    });
    const hero = killed.state.cards[heroId];
    expect(hero?.zone, "the hero took 3 or more damage on top of 5 and is destroyed").toBe("discard");
    expect(hero?.damage, "the damage was placed before the hero was destroyed").toBeGreaterThan(5);
    expect(zoneOf(killed, CODES.urdugEnemy)).toBe("staging");
    expect(zoneOf(killed, CODES.tinyEnemy)).toBe("staging");
  });

  it("19053:A:2 an attack that deals no damage leaves Urdug and Tiny engaged", () => {
    const armored = questAttack({}, (state, hero) => ({ ...state, modifiers: [...state.modifiers, { instanceId: hero, sourceId: hero, stat: "defense", amount: 10, until: "endOfRound" }] }));
    expect(armored.steps.some((step) => step.kind === "attack")).toBe(true);
    expect(zoneOf(armored, CODES.urdugEnemy)).toBe("engaged");
    expect(zoneOf(armored, CODES.tinyEnemy)).toBe("engaged");
  });

  it("19053:A:2 Urdug in the staging area does not attack", () => {
    const staged = questAttack({ engaged: [], staging: [CODES.urdugEnemy, CODES.tinyEnemy] });
    expect(staged.steps.some((step) => step.kind === "attack")).toBe(false);
  });
});
