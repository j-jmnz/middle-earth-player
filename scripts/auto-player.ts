import { expectOk } from "../src/rules/fixture.ts";
import type { EngineStep, LegalIntent, PlayerIntent } from "../src/rules/intents.ts";
import { legalIntents, legalTargets, reduce, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";

// Test helper. A fixed policy that answers every window from the legal intents the reducer offers, so a
// whole scenario can run in Vitest. It never types a number: it only sends intents the reducer listed.

export type PolicyOptions = {
  // A hero kept out of the quest commit so it can answer the Hide tests.
  scout: string;
  // Location code to travel to when it can be chosen.
  prefer: string;
  // A hero the policy never puts in the way of an attack (the Ring-bearer).
  protect: string;
};

function has(intents: readonly LegalIntent[], type: LegalIntent["type"]): boolean {
  return intents.some((intent) => intent.type === type);
}

export function nextIntent(state: ScenarioState, ctx: ReduceContext, options: PolicyOptions): PlayerIntent {
  const intents = legalIntents(state, ctx);
  const window = state.window;
  const scoutIds = new Set(Object.values(state.cards).filter((card) => card.code === options.scout).map((card) => card.id));
  switch (window?.kind) {
    case "mulligan":
      return { type: "Keep" };
    case "pass": {
      const quested = Object.values(state.cards).some((card) => card.committed);
      if (state.mode === "questCommit" && !quested && has(intents, "Commit")) {
        const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => !scoutIds.has(id));
        if (ids.length > 0) return { type: "Commit", cardIds: ids };
      }
      return { type: "Pass" };
    }
    case "hideCommit":
      return { type: "CommitHide", cardIds: legalTargets(state, { type: "CommitHide" }, ctx) };
    case "choose":
    case "resolution": {
      const first = intents[0];
      if (first?.type === "Choose") return { type: "Choose", optionId: first.optionId };
      if (first?.type === "ChooseResolution") return { type: "ChooseResolution", optionId: first.optionId };
      throw new Error("A choice window offered nothing");
    }
    case "travel": {
      const targets = legalTargets(state, { type: "Travel" }, ctx);
      const wanted = targets.find((id) => state.cards[id]?.code === options.prefer) ?? targets[0];
      return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
    }
    case "optionalEngage":
      return { type: "DeclineEngage" };
    case "chooseEnemy": {
      const enemy = legalTargets(state, { type: "ChooseEnemy" }, ctx)[0];
      if (!enemy) throw new Error("No enemy to choose");
      return { type: "ChooseEnemy", enemyId: enemy };
    }
    case "defense": {
      const defenders = has(intents, "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
      const defender = defenders.find((id) => state.cards[id]?.code !== options.protect);
      if (defender) return { type: "DeclareDefender", defenderId: defender };
      const heroes = legalTargets(state, { type: "Undefended" }, ctx);
      return { type: "Undefended", heroId: heroes.find((id) => state.cards[id]?.code !== options.protect) ?? heroes[0] };
    }
    case "archery": {
      const recipient = legalTargets(state, { type: "Distribute" }, ctx)[0];
      if (!recipient) throw new Error("No archery recipient");
      return { type: "Distribute", assignments: [{ cardId: recipient, amount: window.total }] };
    }
    case "playerAttack":
      return { type: "DeclineAttack" };
    default:
      return { type: "Pass" };
  }
}

export type Played = { state: ScenarioState; intents: PlayerIntent[]; rounds: number; steps: EngineStep[] };

// Plays until the scenario is lost, or won and every reward group is answered.
export function playOut(start: ScenarioState, ctx: ReduceContext, options: PolicyOptions, limit = 4000): Played {
  let state = start;
  const intents: PlayerIntent[] = [];
  const steps: EngineStep[] = [];
  for (let turn = 0; turn < limit; turn += 1) {
    if (state.lost) break;
    if (state.stageCleared && state.window == null) break;
    const intent = nextIntent(state, ctx, options);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
  }
  return { state, intents, rounds: state.round, steps };
}
