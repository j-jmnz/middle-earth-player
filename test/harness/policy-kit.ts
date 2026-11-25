import { characters, legalAttackEnemies } from "../../src/rules/combat/combat.ts";
import type { PlayerIntent } from "../../src/rules/core/intents.ts";
import { legalIntents, legalTargets, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent, triggerPayments, type PolicyOptions } from "./auto-player.ts";
import { attackTogether, engageOneEach } from "./game-kit.ts";

// Test helper. The play policy kit of a scenario's `game.ts` (docs/agents/agent-brief.md, Scenario procedure, Games). A policy is a list of rules tried in order: the first that answers
// a window wins, and a window no rule answers falls to the auto-player (test/harness/auto-player.ts, `nextIntent`) with the scenario's PolicyOptions. A rule is a small function of the window
// it owns: it returns an intent the reducer lists, or null for any other window, so rules compose by order alone. The rules are the ones that three or more of the Against the Shadow and
// Hobbit scenarios' policies wrote out by hand; a scenario-specific answer (a card's option, a stage's target) is a `chooseOption` or a `rank` the scenario passes in. POLICY_KIT_RULES lists
// every rule with its one-line description (the comment of a new game.ts is built from it).

/** The kit's rules, each with what it does in one line. A test keeps the list in step with the exports below. */
export const POLICY_KIT_RULES: readonly (readonly [name: string, says: string])[] = [
  ["chooseFirstOrLast(which)", "a Choose window takes the first or the last option"],
  ["chooseOption(wanted, otherwise)", "a Choose window takes the option `wanted` names for the options offered, else the first or last"],
  ["commitAllBut(reserve, keepHome)", "the quest commit: every character but the last `reserve` heroes (and those `keepHome` names)"],
  ["travelFewestQuestPoints(allow)", "a travel window: the location with the fewest quest points (one `allow` permits), else decline"],
  ["declineTravel()", "a travel window: decline"],
  ["defendFirst(perRound)", "a defense window: the first character who may defends (the first `perRound` attacks of a seat's round), else the first hero is undefended"],
  ["undefendedLeastDamaged(except)", "a defense window: nobody defends, the least damaged hero takes the attack (the others stay ready to attack)"],
  ["archeryLeastDamaged(skip)", "an archery window: all the damage to the least damaged character"],
  ["attackAllTogether(rank, may)", "the player attack window: every ready character attacks the enemy of the lowest `rank` (else the first) together"],
  ["attackEach(options)", "the player attack window: the first ready character attacks alone, so each takes a different enemy when `once`"],
  ["declineAttack()", "the player attack window: decline to attack"],
  ["engageUpTo(most, options)", "the optional engagement step: engage the enemy of the lowest `rank` (`allow` permits) while engaged with fewer than `most`"],
  ["triggerActions(effectIds, oncePerRound)", "an Action or Response of the records named, each time (or once a round) the engine offers it and the seat can pay"],
  ["passCommitWhile(when)", "the quest commit: pass without committing while `when` holds"],
];

export type Rule = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => PlayerIntent | null;
export type Policy = readonly Rule[];

/** The answer of a policy: the first rule that answers, else the auto-player's answer with `fallback`. Every intent is one the reducer listed. */
export function policyIntent(rules: Policy, fallback: PolicyOptions, state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  for (const rule of rules) {
    const intent = rule(state, ctx, memory);
    if (intent) return intent;
  }
  return nextIntent(state, ctx, fallback, memory, legalIntents(state, ctx));
}

const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";
const damageOf = (state: ScenarioState, id: string): number => state.cards[id]?.damage ?? 0;
const leastDamaged = (state: ScenarioState, ids: readonly string[]): string | undefined => [...ids].sort((left, right) => damageOf(state, left) - damageOf(state, right))[0];

export const chooseFirstOrLast = (which: "first" | "last"): Rule => chooseOption(() => undefined, which);

/** A Choose window: the option `wanted` names for the options offered (and the state), else the first or the last. */
export function chooseOption(wanted: (state: ScenarioState, options: readonly string[]) => string | undefined, otherwise: "first" | "last" = "first"): Rule {
  return (state) => {
    if (state.window?.kind !== "choose") return null;
    const options = state.window.options;
    const named = wanted(state, options);
    return { type: "Choose", optionId: (named !== undefined && options.includes(named) ? named : otherwise === "last" ? options.at(-1) : options[0]) ?? "" };
  };
}

/** The quest commit: the seat's characters but the last `reserve` heroes and the ones `keepHome` names. Null outside the commit, or once the seat has committed. */
export function commitAllBut(reserve: number, keepHome: (state: ScenarioState, id: string) => boolean = () => false): Rule {
  return (state, ctx) => {
    if (state.mode !== "questCommit" || state.window?.kind !== "pass") return null;
    if (Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) return null;
    const home = new Set(reserve > 0 ? (state.seats[state.activeSeat]?.heroes ?? []).slice(-reserve) : []);
    const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => !home.has(id) && !keepHome(state, id));
    return ids.length > 0 ? { type: "Commit", cardIds: ids } : null;
  };
}

/** A travel window: the location (that `allow` permits) with the fewest printed quest points (none printed comes last), else no travel. */
export function travelFewestQuestPoints(allow: (state: ScenarioState, id: string) => boolean = () => true): Rule {
  return (state, ctx) => {
    if (state.window?.kind !== "travel") return null;
    const points = (id: string): number => ctx.cards.get(codeOf(state, id))?.questPoints ?? 99;
    const best = legalTargets(state, { type: "Travel" }, ctx).filter((id) => allow(state, id)).sort((left, right) => points(left) - points(right))[0];
    return best ? { type: "Travel", locationId: best } : { type: "DeclineTravel" };
  };
}

export const declineTravel = (): Rule => (state) => (state.window?.kind === "travel" ? { type: "DeclineTravel" } : null);

/** A defense window: the first character who may defends while the seat has defended fewer than `perRound` attacks this round, else the first hero is undefended. */
export function defendFirst(perRound = Number.POSITIVE_INFINITY): Rule {
  return (state, ctx, memory) => {
    if (state.window?.kind !== "defense") return null;
    const key = `defended:${state.round}:${state.activeSeat}`;
    const used = [...memory].filter((entry) => entry.startsWith(key)).length;
    const defender = used < perRound && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx)[0] : undefined;
    if (defender) {
      memory.add(`${key}:${used}`);
      return { type: "DeclareDefender", defenderId: defender };
    }
    const heroes = legalTargets(state, { type: "Undefended" }, ctx);
    return heroes[0] ? { type: "Undefended", heroId: heroes[0] } : null;
  };
}

/** A defense window where nobody defends: the damage of the attack goes to the seat's least damaged hero the engine offers (the ones `except` names never), so the others stay ready to attack. Null when the engine offers none. */
export function undefendedLeastDamaged(except: (state: ScenarioState, id: string) => boolean = () => false): Rule {
  return (state, ctx) => {
    if (state.window?.kind !== "defense") return null;
    const least = leastDamaged(state, legalTargets(state, { type: "Undefended" }, ctx).filter((id) => !except(state, id)));
    return least ? { type: "Undefended", heroId: least } : null;
  };
}

/** An archery window: all the damage to the least damaged character the engine lists (the ones `skip` names never). */
export function archeryLeastDamaged(skip: (state: ScenarioState, id: string) => boolean = () => false): Rule {
  return (state, ctx) => {
    if (state.window?.kind !== "archery") return null;
    const least = leastDamaged(state, legalTargets(state, { type: "Distribute" }, ctx).filter((id) => !skip(state, id)));
    return least ? { type: "Distribute", assignments: [{ cardId: least, amount: state.window.total }] } : null;
  };
}

/** The player attack window: every ready character (that `may` allows) attacks together the reachable enemy of the lowest `rank` (else the first). */
export const attackAllTogether = (rank?: (state: ScenarioState, enemyId: string) => number, may?: (state: ScenarioState, id: string) => boolean): Rule => (state, ctx) =>
  attackTogether(state, ctx, may ? (id) => may(state, id) : undefined, rank ? (enemyId) => rank(state, enemyId) : undefined);

/** The player attack window: the first ready character that can reach an enemy attacks it alone; with `once` an enemy a seat's attack already declared this phase is left to the next character. */
export function attackEach(options: { may?: (state: ScenarioState, id: string) => boolean; once?: boolean } = {}): Rule {
  return (state, ctx) => {
    if (state.window?.kind !== "playerAttack" || !legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) return null;
    for (const id of characters(state, state.activeSeat, ctx.cards)) {
      if (options.may && !options.may(state, id)) continue;
      if (legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length === 0) continue;
      const enemy = legalAttackEnemies(state, state.activeSeat, id, ctx.cards).find((enemyId) => !options.once || !state.declaredAttacks.includes(`${state.activeSeat}:${enemyId}`));
      if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [id] };
    }
    return null;
  };
}

/** The player attack window: decline to attack (the rule to put after the attack rules, so a window they leave open ends). */
export const declineAttack = (): Rule => (state) => (state.window?.kind === "playerAttack" ? { type: "DeclineAttack" } : null);

/** The optional engagement step: the enemy of the lowest `rank` (that `allow` permits; else the first) while the seat is engaged with fewer than `most` (by default its hero count). */
export function engageUpTo(most?: number, options: { allow?: (state: ScenarioState, id: string) => boolean; rank?: (state: ScenarioState, id: string) => number } = {}): Rule {
  const { allow, rank } = options;
  return (state, ctx) => engageOneEach(state, ctx, most, allow ? (id) => allow(state, id) : undefined, rank ? (id) => rank(state, id) : undefined);
}

/** An Action or Response of the records named, each time the engine offers it (once a round with `oncePerRound`) and its cost can be paid; never while a choice of the frame is open. */
export function triggerActions(effectIds: readonly string[], oncePerRound = false): Rule {
  return (state, ctx, memory) => {
    if (state.window?.kind === "choose" || state.window?.kind === "chooseEnemy") return null;
    for (const intent of legalIntents(state, ctx)) {
      if (intent.type !== "Trigger" || !effectIds.includes(intent.effectId)) continue;
      const key = `action:${state.round}:${intent.effectId}`;
      if (oncePerRound && memory.has(key)) continue;
      const paid = triggerPayments(state, ctx, intent);
      if (!paid) continue;
      if (oncePerRound) memory.add(key);
      return paid.length > 0 ? { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId, payments: paid } : { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId };
    }
    return null;
  };
}

/** The quest commit: pass with no character committed while `when` holds. */
export const passCommitWhile = (when: (state: ScenarioState) => boolean): Rule => (state) =>
  state.mode === "questCommit" && state.window?.kind === "pass" && when(state) ? { type: "Pass" } : null;
