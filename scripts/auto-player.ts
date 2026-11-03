import { costOfKind } from "../src/catalog/costs.ts";
import { playCost } from "../src/rules/attach.ts";
import { expectOk } from "../src/rules/fixture.ts";
import { heroPays } from "../src/rules/payments.ts";
import { printedOf } from "../src/rules/printed.ts";
import { costPayer } from "../src/rules/usage.ts";
import type { EngineStep, LegalIntent, PlayerIntent } from "../src/rules/intents.ts";
import { hideCommitLimit } from "../src/rules/families/nightmare/guards.ts";
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
  // Plays the first card in hand it can pay for, in the planning pass window, before it passes. A card with no legal host is skipped.
  play?: boolean;
  // Uses each Action it can once per round and answers each Response offered to it, when it can pay.
  act?: boolean;
};

// What the policy has done this round, so an Action with no limit is not used over and over.
type Memory = Set<string>;

// Resources the seat can pay for a card of this sphere, taken from its heroes in order, or null when it cannot pay.
export function paymentsFor(state: ScenarioState, ctx: ReduceContext, seat: number, cardId: string, cost: number): { heroId: string; amount: number }[] | null {
  const sphere = printedOf(ctx.cards, state.cards[cardId]?.code ?? "").sphere;
  const out: { heroId: string; amount: number }[] = [];
  let left = cost;
  for (const heroId of state.seats[seat]?.heroes ?? []) {
    if (left === 0) break;
    const hero = state.cards[heroId];
    if (!hero || hero.resources === 0 || !heroPays(state, heroId, sphere, ctx, cardId)) continue;
    const amount = Math.min(left, hero.resources);
    out.push({ heroId, amount });
    left -= amount;
  }
  return left === 0 ? out : null;
}

function playable(state: ScenarioState, ctx: ReduceContext, intents: readonly LegalIntent[]): PlayerIntent | null {
  const seat = state.activeSeat;
  for (const intent of intents) {
    if (intent.type !== "PlayCard") continue;
    const printed = printedOf(ctx.cards, state.cards[intent.cardId]?.code ?? "");
    // An attachment's cost can depend on its host (a discount for the first restricted attachment on a hero): the host comes first.
    const host = printed.type === "attachment" ? legalTargets(state, { type: "PlayCard", cardId: intent.cardId }, ctx)[0] : undefined;
    if (printed.type === "attachment" && !host) continue;
    const cost = playCost(state, intent.cardId, seat, ctx, host ?? null);
    if (cost == null) continue;
    const paid = paymentsFor(state, ctx, seat, intent.cardId, cost);
    if (!paid) continue;
    return host ? { type: "PlayCard", cardId: intent.cardId, payments: paid, hostId: host } : { type: "PlayCard", cardId: intent.cardId, payments: paid };
  }
  return null;
}

function has(intents: readonly LegalIntent[], type: LegalIntent["type"]): boolean {
  return intents.some((intent) => intent.type === type);
}

function triggerFor(state: ScenarioState, ctx: ReduceContext, memory: Memory, intents: readonly LegalIntent[]): PlayerIntent | null {
  for (const intent of intents) {
    if (intent.type !== "Trigger") continue;
    const key = `${state.round}:${intent.cardId}:${intent.effectId}`;
    if (memory.has(key)) continue;
    const effect = ctx.effects.find((entry) => entry.id === intent.effectId);
    const source = state.cards[intent.cardId];
    if (!effect || !source) continue;
    const seat = state.activeSeat;
    let paid: { heroId: string; amount: number }[] | null = [];
    const resources = costOfKind(effect, "resources");
    if (costOfKind(effect, "playEvent")) {
      const cost = playCost(state, intent.cardId, seat, ctx);
      paid = cost == null ? null : paymentsFor(state, ctx, seat, intent.cardId, cost);
    } else if (resources) {
      const payer = costPayer(state, resources, source);
      paid = payer === null ? null : payer !== undefined ? [{ heroId: payer, amount: resources.amount }] : paymentsFor(state, ctx, seat, intent.cardId, resources.amount);
    }
    if (!paid) continue;
    memory.add(key);
    return paid.length > 0 ? { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId, payments: paid } : { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId };
  }
  return null;
}

// `intents` is legalIntents(state, ctx), when the caller already has it.
export function nextIntent(
  state: ScenarioState,
  ctx: ReduceContext,
  options: PolicyOptions,
  memory: Memory = new Set(),
  intents: readonly LegalIntent[] = legalIntents(state, ctx),
): PlayerIntent {
  const window = state.window;
  const scoutIds = new Set(Object.values(state.cards).filter((card) => card.code === options.scout).map((card) => card.id));
  switch (window?.kind) {
    case "mulligan":
      return { type: "Keep" };
    case "response": {
      const answer = options.act ? triggerFor(state, ctx, memory, intents) : null;
      return answer ?? { type: "Pass" };
    }
    case "pass": {
      if (options.act) {
        const action = triggerFor(state, ctx, memory, intents);
        if (action) return action;
      }
      if (options.play && state.mode === "planning") {
        const play = playable(state, ctx, intents);
        if (play) return play;
      }
      // Each seat commits once, its own characters: a card committed by another seat does not count (a policy, not a rule).
      const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
      if (state.mode === "questCommit" && !quested && has(intents, "Commit")) {
        const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => !scoutIds.has(id));
        if (ids.length > 0) return { type: "Commit", cardIds: ids };
      }
      return { type: "Pass" };
    }
    case "hideCommit":
      return { type: "CommitHide", cardIds: legalTargets(state, { type: "CommitHide" }, ctx).slice(0, hideCommitLimit(state) ?? undefined) };
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
  const memory: Memory = new Set();
  for (let turn = 0; turn < limit; turn += 1) {
    if (state.lost) break;
    if (state.stageCleared && state.window == null) break;
    const intent = nextIntent(state, ctx, options, memory);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
  }
  return { state, intents, rounds: state.round, steps };
}
