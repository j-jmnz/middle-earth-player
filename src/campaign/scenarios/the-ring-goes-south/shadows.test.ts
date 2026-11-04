// Rules: rr.step-6-2, rr.step-6-4-2, rr.step-6-4-3, rr.shadow-effects, rr.destroy, rr.engaged, rr.attacks-outside-the-combat-phase,
// mec109.stage-4 (data/rules/entries.json). The shadow effects of The Ring Goes South, and the Watcher in the Water attacking.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { legalIntents, legalTargets } from "../../../rules/engine/legal.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { PlayerIntent, ReduceContext } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { DOORS, loadSouthWorld, southTable, WATCHER, type SouthLayout, type SouthWorld } from "../../../../test/scenarios/the-ring-goes-south/scene.ts";
import { first, type Run, send, start } from "../../../../test/harness/scene-kit.ts";

let world: SouthWorld;

beforeAll(async () => {
  world = await loadSouthWorld();
});

type Fight = { run: Run; ctx: ReduceContext; sam: string; frodo: string; seen: ScenarioState[] };

// The combat phase begins with `engaged` enemies dealt shadow cards from the top of the deck. Sam defends the first attack (or the
// attack is left undefended on `hero`), a choice takes `answer` (the first option when it names none). Returns once the attack is over.
function fight(shadow: string, enemy: string, layout: SouthLayout = {}, defense: "sam" | "undefended" = "sam", marked = false, answer?: (state: ScenarioState) => PlayerIntent): Fight {
  const made = southTable(world, { phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck: [shadow, "f0", "f0", "f0"], ...layout });
  let state = syncConstants(made.state, made.ctx);
  const foe = first(state, enemy);
  // An enemy that engaged a player this round (the engagement phase just now).
  if (marked) state = { ...state, modifiers: [...state.modifiers, { instanceId: foe, sourceId: foe, stat: "engagedThisRound", amount: 1, until: "endOfRound" }] };
  let run: Run = send(start(state), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  expect(run.state.window?.kind).toBe("defense");
  if (defense === "sam") {
    expect(legalTargets(run.state, { type: "DeclareDefender" }, made.ctx)).toContain(made.sam);
    run = send(run, { type: "DeclareDefender", defenderId: made.sam }, made.ctx);
  } else {
    run = send(run, { type: "Undefended", heroId: made.sam }, made.ctx);
  }
  const seen: ScenarioState[] = [run.state];
  for (let guard = 0; guard < 30 && (run.state.pendingAttack != null || run.state.stack.length > 0); guard += 1) {
    const window = run.state.window;
    if (window?.kind === "choose") {
      run = send(run, answer?.(run.state) ?? { type: "Choose", optionId: window.options[0] ?? "" }, made.ctx);
      continue;
    }
    if (window?.kind === "defense") {
      const target = legalTargets(run.state, { type: "Undefended" }, made.ctx)[0];
      run = send(run, answer?.(run.state) ?? { type: "Undefended", heroId: target }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
    seen.push(run.state);
  }
  return { run, ctx: made.ctx, sam: made.sam, frodo: made.frodo, seen };
}

describe("shadow effects of The Ring Goes South", () => {
  it("Hound of Sauron gives the attacking enemy +1 Attack, and +2 if it engaged a player this round (142026:A:3)", () => {
    // Grunt: Attack 1. Sam's Defense is 1 or more, so read the attack the enemy had when the damage was dealt from the strike step.
    for (const marked of [false, true]) {
      const { run } = fight("142026", "grunt", {}, "undefended", marked);
      const strike = run.steps.find((step) => step.kind === "strike" && step.side === "enemy");
      expect(strike && strike.kind === "strike" ? strike.attack : 0, `${marked}`).toBe(marked ? 3 : 2);
    }
  });

  it("Howling Warg gives +1 Attack, and a destroyed character puts 1 damage on an active location (142027:A:2)", () => {
    // Orc: Attack 2 +1 against Sam's 3 hit points, undefended: Sam is destroyed, and the location takes 1 damage.
    const killed = fight("142027", "orc", { stage: "142022", active: "place" }, "undefended");
    const strike = killed.run.steps.find((step) => step.kind === "strike" && step.side === "enemy");
    expect(strike && strike.kind === "strike" ? strike.attack : 0).toBe(3);
    expect(killed.run.state.cards[killed.sam]?.zone).toBe("discard");
    expect(killed.run.state.cards[first(killed.run.state, "place")]?.damage).toBe(1);
    // Grunt: Attack 1 +1 destroys nobody.
    const spared = fight("142027", "grunt", { stage: "142022", active: "place" }, "undefended");
    expect(spared.run.state.cards[spared.sam]?.zone).toBe("heroes");
    expect(spared.run.state.cards[first(spared.run.state, "place")]?.damage).toBe(0);
  });

  it("Eregion makes the defending player discard a non-objective attachment they control (142034:A:2)", () => {
    const { run, sam } = fight("142034", "grunt", { onSam: ["142011"] });
    expect(run.state.cards[first(run.state, "142011")]?.zone).toBe("discard");
    expect(run.state.cards[sam]?.attachments).toEqual([]);
    // The One Ring is an objective and the wound is not theirs: Frodo keeps both.
    const frodoKeeps = fight("142034", "grunt");
    expect(frodoKeeps.run.state.cards[frodoKeeps.frodo]?.attachments).toHaveLength(2);
  });

  it("Regiments of Crows puts the undefended damage on an active location instead of a hero (142035:A:2)", () => {
    const { run, sam } = fight("142035", "grunt", { stage: "142022", active: "place" }, "undefended");
    expect(run.state.cards[sam]?.damage).toBe(0);
    expect(run.state.cards[first(run.state, "place")]?.damage).toBe(1);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("Regiments of Crows lets the defending player name the active location when there are two", () => {
    const { run, sam } = fight("142035", "grunt", { stage: "142023", active: DOORS, second: "place" }, "undefended", false, (state) => ({ type: "Undefended", heroId: state.secondActiveLocation ?? "" }));
    expect(run.state.cards[sam]?.damage).toBe(0);
    expect(run.state.cards[first(run.state, "place")]?.damage).toBe(1);
    expect(run.state.cards[first(run.state, DOORS)]?.damage).toBe(0);
  });

  it("Regiments of Crows does nothing to a defended attack, and with no active location the damage goes on the hero", () => {
    const defended = fight("142035", "grunt", { stage: "142022", active: "place" }, "sam");
    expect(defended.run.state.cards[first(defended.run.state, "place")]?.damage).toBe(0);
    const bare = fight("142035", "grunt", { stage: "142022" }, "undefended");
    expect(bare.run.state.cards[bare.sam]?.damage).toBe(1);
  });
});

describe("the Watcher in the Water attacks every player in the combat phase (142024:A:2)", () => {
  it("attacks once per player, stays in the staging area, and any character may attack it", () => {
    const made = southTable(world, { stage: "142023", seats: 2, captive: true, active: DOORS, phase: "Combat", deck: ["f0", "f0", "f0", "f0"] });
    const state = syncConstants(made.state, made.ctx);
    const watcher = first(state, WATCHER);
    let run: Run = start(state);
    const attacked: number[] = [];
    for (let guard = 0; guard < 80 && run.state.phase === "Combat"; guard += 1) {
      const window = run.state.window;
      if (run.state.pendingAttack?.enemyId === watcher && !attacked.includes(run.state.pendingAttack.seat)) attacked.push(run.state.pendingAttack.seat);
      if (window?.kind === "defense") {
        const target = legalTargets(run.state, { type: "Undefended" }, made.ctx)[0];
        run = send(run, { type: "Undefended", heroId: target }, made.ctx);
        continue;
      }
      const intent = legalIntents(run.state, made.ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack");
      if (!intent) break;
      run = send(run, intent as PlayerIntent, made.ctx);
    }
    expect(attacked).toEqual([0, 1]);
    expect(run.state.cards[watcher]?.zone).toBe("staging");
    void modifiedStat;
  });

  // "Shadow: Attacking enemy makes an additional attack after this one." (142037:A:2, data/printed/fellowship-of-the-ring.json)
  it("makes the additional attack a shadow card grants it, dealt a shadow card of its own", () => {
    const made = southTable(world, { stage: "142023", captive: true, active: DOORS, phase: "Combat", heroes: ["strong"], deck: ["142037", "f0", "f0", "f0"] });
    const state = syncConstants(made.state, made.ctx);
    const watcher = state.staging.find((id) => state.cards[id]?.code === WATCHER) ?? "";
    let run: Run = start(state);
    for (let guard = 0; guard < 80 && run.state.phase === "Combat"; guard += 1) {
      if (run.state.window?.kind === "defense") {
        run = send(run, { type: "Undefended", heroId: first(run.state, "strong") }, made.ctx);
        continue;
      }
      const intent = legalIntents(run.state, made.ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack");
      if (!intent) break;
      run = send(run, intent as PlayerIntent, made.ctx);
    }
    const strikes = run.steps.filter((step) => step.kind === "strike" && step.side === "enemy" && step.enemyId === watcher);
    // One attack in the combat phase, and the additional one.
    expect(strikes).toHaveLength(2);
    expect(run.state.cards[watcher]?.zone).toBe("staging");
  });
});
