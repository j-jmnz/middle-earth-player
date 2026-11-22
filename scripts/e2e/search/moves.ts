import { questPointsOf, questStatOf } from "../../../src/rules/quest/quest.ts";
import { modifiedStat } from "../../../src/rules/core/keywords.ts";
import type { LegalIntent, PlayerIntent } from "../../../src/rules/core/intents.ts";
import { hideCommitLimit } from "../../../src/rules/families/nightmare/guards.ts";
import { escapeCommitLimit } from "../../../src/rules/families/escape/commit.ts";
import { legalIntents, legalTargets, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { withinCommitLimit } from "../../../test/harness/auto-player.ts";
import { archeryOptions, attackOptions, defenseOptions, enemyOptions, engageOptions, type AttackStyle, type EngageStyle } from "./moves-combat.ts";
import { playOptions, triggerOptions } from "./moves-play.ts";
import { mustSurvive } from "./score.ts";

// The move generator of the fixture search: for the window the table is in, a short ordered list of distinct legal intents (the first is the
// one the style prefers) built from `legalIntents` and `legalTargets`, never a number the engine computes. The same state, memory and style
// always give the same list. A branch of the search picks among the options with its own seeded noise (beam.ts).

export type QuestStyle = "all" | "keepDefender" | "keepTwo" | "heroes" | "half";

/** One way to play a round: the kind of option each window puts first. */
export type Style = { quest: QuestStyle; engage: EngageStyle; attack: AttackStyle; travel: "easiest" | "stay" };

/** The styles the branches of a line take in turn: a spread from careful to bold. */
export const STYLES: readonly Style[] = [
  { quest: "keepDefender", engage: "none", attack: "always", travel: "easiest" },
  { quest: "all", engage: "weak", attack: "always", travel: "easiest" },
  { quest: "keepTwo", engage: "weak", attack: "always", travel: "easiest" },
  { quest: "all", engage: "all", attack: "always", travel: "easiest" },
  { quest: "heroes", engage: "none", attack: "never", travel: "stay" },
  { quest: "half", engage: "weak", attack: "always", travel: "stay" },
  { quest: "keepDefender", engage: "all", attack: "always", travel: "easiest" },
  { quest: "all", engage: "none", attack: "never", travel: "easiest" },
];

/** The most options a decision lists. */
const MOST = 6;

const kinds = (legal: readonly LegalIntent[]): Set<string> => new Set(legal.map((intent) => intent.type));

/** How well a character holds the line: defense first, then the hit points it has left. */
function guard(state: ScenarioState, ctx: ReduceContext, id: string): number {
  const card = state.cards[id];
  if (!card) return 0;
  return modifiedStat(state, card, "defense", ctx.cards) * 10 + modifiedStat(state, card, "hitPoints", ctx.cards) - card.damage;
}

/** The sets of characters that may commit to the quest, the style's first: all of them, all but the best defender (or two), heroes only, the strongest half. */
function commitSets(state: ScenarioState, ctx: ReduceContext, style: QuestStyle): string[][] {
  const ids = legalTargets(state, { type: "Commit" }, ctx);
  const byGuard = [...ids].sort((left, right) => guard(state, ctx, right) - guard(state, ctx, left));
  const power = (id: string) => {
    const card = state.cards[id];
    return card ? modifiedStat(state, card, questStatOf(state, id, ctx.cards), ctx.cards) : 0;
  };
  const byPower = [...ids].sort((left, right) => power(right) - power(left));
  const sets: Record<QuestStyle, readonly string[]> = {
    all: ids,
    keepDefender: byGuard.slice(1),
    keepTwo: byGuard.slice(2),
    heroes: ids.filter((id) => state.cards[id]?.zone === "heroes"),
    half: byPower.slice(0, Math.max(1, Math.ceil(ids.length / 2))),
  };
  const order: QuestStyle[] = [style, "all", "keepDefender", "keepTwo", "heroes", "half"];
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const name of order) {
    const set = withinCommitLimit(state, ids.filter((id) => sets[name].includes(id)), ctx);
    const key = [...set].sort().join(",");
    if (set.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(set);
  }
  return out;
}

/** The Commit options of the quest window, and what the seat does when it commits nothing. */
function commitOptions(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], style: Style): PlayerIntent[] {
  const sets = commitSets(state, ctx, style.quest).map((cardIds): PlayerIntent => ({ type: "Commit", cardIds }));
  return legal.some((intent) => intent.type === "Pass") ? [...sets, { type: "Pass" }] : sets;
}

/** The locations the players may travel to, the one with the fewest quest points first. */
function travelOptions(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], style: Style): PlayerIntent[] {
  const points = (id: string) => {
    const card = state.cards[id];
    return (card ? questPointsOf(state, card, ctx.cards) : null) ?? 99;
  };
  const targets = legal.some((intent) => intent.type === "Travel") ? [...legalTargets(state, { type: "Travel" }, ctx)].sort((left, right) => points(left) - points(right)).slice(0, 3) : [];
  const go: PlayerIntent[] = targets.map((locationId) => ({ type: "Travel", locationId }));
  const stay: PlayerIntent[] = legal.some((intent) => intent.type === "DeclineTravel") ? [{ type: "DeclineTravel" }] : [];
  return style.travel === "stay" ? [...stay, ...go] : [...go, ...stay];
}

/** A commit to a test (Hide, Fortitude, Escape): every character that may, within the limit, and the strongest half. */
function testCommit(type: "CommitHide" | "CommitFortitude" | "CommitEscape", state: ScenarioState, ctx: ReduceContext): PlayerIntent[] {
  const ids = legalTargets(state, { type }, ctx);
  const limit = type === "CommitHide" ? hideCommitLimit(state) : type === "CommitEscape" && state.window?.kind === "escapeCommit" ? escapeCommitLimit(state, state.window.seat) : null;
  const all = ids.slice(0, limit ?? undefined);
  const half = all.slice(0, Math.max(1, Math.ceil(all.length / 2)));
  return [{ type, cardIds: all }, ...(half.length < all.length ? [{ type, cardIds: half } satisfies PlayerIntent] : [])];
}

/** The ids of an option window, a card the game is lost with last. */
function choiceOptions(state: ScenarioState, ctx: ReduceContext, ids: readonly string[], make: (id: string) => PlayerIntent): PlayerIntent[] {
  return [...ids].sort((left, right) => Number(mustSurvive(state, ctx, left)) - Number(mustSurvive(state, ctx, right))).slice(0, MOST).map(make);
}

/** The pass window and the action windows: the quest commitment, then cards to play (planning only) and Actions to use, then passing; in the resource phase passing comes first. */
function passOptions(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], memory: ReadonlySet<string>, style: Style): PlayerIntent[] {
  const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
  const has = kinds(legal);
  if (state.mode === "questCommit" && state.window?.kind === "pass" && has.has("Commit") && (!quested || !has.has("Pass"))) {
    const commit = commitOptions(state, ctx, legal, style);
    if (commit.length > 0) return commit;
  }
  const pass: PlayerIntent[] = has.has("Pass") ? [{ type: "Pass" }] : [];
  const triggers = triggerOptions(state, ctx, legal, memory);
  if (state.mode === "resourceActions") return [...pass, ...triggers].slice(0, MOST);
  const plays = state.mode === "planning" ? playOptions(state, ctx, legal) : [];
  return [...plays, ...triggers, ...pass].slice(0, MOST);
}

/** The options of the window the table is in, the preferred first; empty when the game is over or no intent is open. */
export function movesOf(state: ScenarioState, ctx: ReduceContext, memory: ReadonlySet<string>, style: Style): PlayerIntent[] {
  const legal = legalIntents(state, ctx);
  if (legal.length === 0) return [];
  const window = state.window;
  switch (window?.kind) {
    case "mulligan":
      return [{ type: "Keep" }, ...(kinds(legal).has("Mulligan") ? [{ type: "Mulligan" } satisfies PlayerIntent] : [])];
    case "pass":
    case "frameAction":
      return passOptions(state, ctx, legal, memory, style);
    case "response":
    case "cancelOffer": {
      const pass: PlayerIntent[] = window.kind === "response" || kinds(legal).has("Pass") ? [{ type: "Pass" }] : [];
      return [...triggerOptions(state, ctx, legal, memory), ...pass].slice(0, MOST);
    }
    case "look":
      return [{ type: "Pass" }];
    case "hideCommit":
      return testCommit("CommitHide", state, ctx);
    case "fortitudeCommit":
      return testCommit("CommitFortitude", state, ctx);
    case "escapeCommit":
      return testCommit("CommitEscape", state, ctx);
    case "choose":
      return choiceOptions(state, ctx, legal.flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : [])), (optionId) => ({ type: "Choose", optionId }));
    case "resolution":
      return legal.flatMap((intent) => (intent.type === "ChooseResolution" ? [{ type: "ChooseResolution", optionId: intent.optionId } satisfies PlayerIntent] : [])).slice(0, MOST);
    case "travel":
      return travelOptions(state, ctx, legal, style);
    case "optionalEngage":
      return engageOptions(state, ctx, legal, style.engage);
    case "chooseEnemy":
      return enemyOptions(state, ctx);
    case "defense":
      return defenseOptions(state, ctx, legal);
    case "archery":
      return archeryOptions(state, ctx);
    case "playerAttack":
      return attackOptions(state, ctx, legal, style.attack);
    default:
      return [];
  }
}

// The key a sent Action or Response is remembered by (`memory` of `movesOf`).
export { usedKey } from "./moves-play.ts";
