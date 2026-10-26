// Rules: rr.step-6-2, rr.step-6-4-2, rr.step-6-4-3, rr.shadow-effects, rr.destroy, mec109.ringbearers-life
// (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/constants.ts";
import { legalIntents, legalTargets } from "../rules/legal.ts";
import type { PlayerIntent, ReduceContext } from "../rules/reduce.ts";
import type { ScenarioState } from "../rules/state.ts";
import { causeProblems } from "../../scripts/cause-check.ts";
import { fordTable, loadFordWorld, type FordLayout, type FordWorld } from "../../scripts/ford-scene.ts";
import { first, SAM, send, start, type Run } from "../../scripts/past-scene.ts";

let world: FordWorld;

beforeAll(async () => {
  world = await loadFordWorld();
});

// An enemy engaged with the first seat attacks in the combat phase with `shadow` dealt to it, and Sam defends. A choice the
// shadow effect asks takes `answer` (the first option when it names none). Returns the state once the attack is over.
function fight(shadow: string, enemy: "brute" | "grunt", layout: FordLayout = {}, answer?: (state: ScenarioState) => PlayerIntent): { run: Run; ctx: ReduceContext; sam: string; frodo: string; seen: ScenarioState[] } {
  const made = fordTable(world, { phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], hand: ["filler", "filler", "filler"], ...layout });
  const state = syncConstants(made.state, made.ctx);
  const sam = first(state, SAM);
  let run: Run = send(start(state), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  expect(run.state.window?.kind).toBe("defense");
  expect(legalTargets(run.state, { type: "DeclareDefender" }, made.ctx)).toContain(sam);
  run = send(run, { type: "DeclareDefender", defenderId: sam }, made.ctx);
  // Every state from the defender's declaration to the end of the attack: the phase goes on to its end once the attack is over.
  const seen: ScenarioState[] = [run.state];
  for (let guard = 0; guard < 30 && (run.state.pendingAttack != null || run.state.stack.length > 0); guard += 1) {
    const window = run.state.window;
    if (window?.kind === "choose") {
      run = send(run, answer?.(run.state) ?? { type: "Choose", optionId: window.options[0] ?? "" }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
    seen.push(run.state);
  }
  return { run, ctx: made.ctx, sam, frodo: made.frodo, seen };
}

describe("shadow effects of the Flight to the Ford burdens and treacheries", () => {
  it("The Enemy is Upon Us! removes all progress from the current quest if the attack destroys a character (141065:A:2)", () => {
    const killed = fight("141065", "brute", { progress: 9 });
    expect(killed.run.state.cards[killed.sam]?.zone).toBe("discard");
    expect(killed.run.state.cards[killed.run.state.questStage ?? ""]?.progress).toBe(0);
    expect(causeProblems(killed.run.steps)).toEqual([]);
    const spared = fight("141065", "grunt", { progress: 9 });
    expect(spared.run.state.cards[spared.sam]?.zone).toBe("heroes");
    expect(spared.run.state.cards[spared.run.state.questStage ?? ""]?.progress).toBe(9);
  });

  it("Pain Assailed Him reduces the Ring-bearer's life by 1 if the attack destroys a character (141066:A:2)", () => {
    const killed = fight("141066", "brute");
    expect(killed.run.state.cards[killed.sam]?.zone).toBe("discard");
    expect(killed.run.state.life).toBe(14);
    const spared = fight("141066", "grunt");
    expect(spared.run.state.life).toBe(15);
  });

  it("Fear of Discovery makes the defending player raise their threat by 3 (141081:A:3)", () => {
    const { run } = fight("141081", "grunt");
    expect(run.state.seats[0].threat).toBe(11);
  });

  it("Eaten Alive! deals 1 damage to the defending character (141082:A:3)", () => {
    const { run, sam } = fight("141082", "grunt");
    // The grunt's 1 Attack against Sam's Defense deals nothing; the shadow card's point is all the damage.
    expect(run.state.cards[sam]?.damage).toBe(1);
  });

  it("Panicked makes the defending player exhaust a character they control (141083:A:3)", () => {
    const { seen, frodo, sam } = fight("141083", "grunt");
    // Sam is exhausted by defending; the shadow card exhausts the ready Ring-bearer, the only other character.
    const both = seen.find((state) => state.cards[frodo]?.exhausted === true);
    expect(both?.cards[sam]?.exhausted).toBe(true);
  });

  it("Overcome by Terror makes the defending player discard 1 card at random from their hand (141084:A:3)", () => {
    const { run } = fight("141084", "grunt");
    expect(run.state.seats[0].hand).toHaveLength(2);
    expect(run.state.seats[0].discard).toHaveLength(1);
  });
});
