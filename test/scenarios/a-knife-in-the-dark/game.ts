import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { expectOk } from "../../../src/rules/core/test-fixture.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { attackTogether, dealtGame, engageOneEach, fellowshipLoadout, HERO_STATS_8, type PlayedGame, playToEnd, RING_BEARER, STRONG_HEROES } from "../../harness/game-kit.ts";

// Test helper. A whole game of A Knife in the Dark played by the auto-player, true solo or two-handed. With the seeded
// starter decks, true solo is Stealth and Steadfastness with the saga Frodo as a fourth hero (the Ring-bearer does not
// count against the hero limit) and two-handed adds Wisdom and Wizardry as the second seat. The scenario starts from an
// empty Campaign Log (no pool cards), so the game depends only on the scenario, the decks, the engine and the seed.
export { RING_BEARER };
export const campaign = loadCampaign();
export const knife = loadScenario("a-knife-in-the-dark");

// "starter": the seeded starter decks. "strong": the scenario 1 golden's loadout (src/campaign/scenarios/a-shadow-of-the-past/golden.test.ts) for each
// seat: in-memory heroes with big numbers beside the saga Frodo and a deck of free events, so the outcome depends on the
// engine and the seed, not on card play.
export type KnifeDecks = "starter" | "strong";

export const knifeLoadout = (seatCount: 1 | 2, decks: KnifeDecks = "starter"): LoadoutSeat[] => fellowshipLoadout(campaign, seatCount, decks !== "strong");

export { STRONG_HEROES };

const game = dealtGame<KnifeDecks>({
  campaign,
  scenario: knife,
  stats: { starter: HERO_STATS_8.strong, strong: HERO_STATS_8.strong },
  codes: [...campaign.prelude.map((card) => card.code), ...knifeLoadout(2).flatMap((seat) => [...seat.heroes, ...seat.deck])],
  loadout: knifeLoadout,
});

export const knifeWorld = (): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> => game.world("strong");
export const knifeStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, decks: KnifeDecks = "starter"): StartScenario => game.start(seatCount, seed, difficulty, decks);

export const KNIFE_POLICY: PolicyOptions = { scout: "", prefer: "", protect: RING_BEARER, play: true, act: true };

// With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
const STRONG_QUESTERS = new Set([RING_BEARER, "q1", "q2", "q4", "q5"]);

// The auto-player's answer (test/harness/auto-player.ts), except where the auto-player alone always declines and stage 3B is won
// only when no Nazgûl is in play: in a player attack window every ready character that can attack the first enemy it can
// reach attacks it together, and in the optional engagement step the seat engages one enemy at a time. Every intent is one
// the reducer listed.

export function knifeIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  // Each seat commits its own questers once (a policy, not a rule): another seat's committed card does not count.
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.some((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""))) {
      const questers = ids.filter((id) => STRONG_QUESTERS.has(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const together = attackTogether(state, ctx, (id) => state.cards[id]?.code !== RING_BEARER);
  if (together) return together;
  // With the strong loadout no hero defends, so the one kept out of the quest is ready to attack; the undefended damage goes
  // on the least wounded strong hero (100 hit points), never on the Ring-bearer.
  if (state.window?.kind === "defense") {
    const heroes = legalTargets(state, { type: "Undefended" }, ctx).filter((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Optional engagement: one enemy at a time, while the seat has fewer engaged than heroes.
  const engaging = engageOneEach(state, ctx);
  if (engaging) return engaging;
  return nextIntent(state, ctx, KNIFE_POLICY, memory);
}

export type KnifeGame = PlayedGame;

// Plays until the scenario is lost, or won and every Resolution choice is answered. `steps` are the engine steps of the
// Keep and of every intent after it.
export function playKnife(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, decks: KnifeDecks = "starter", limit = 6000): KnifeGame {
  const start = knifeStart(seatCount, seed, difficulty, decks);
  return playToEnd(start, ctx, (state, memory) => knifeIntent(state, ctx, memory), limit);
}

// The A Knife in the Dark goldens (src/campaign/scenarios/a-knife-in-the-dark/golden.test.ts).
// The wins use the strong loadout. The auto-player lost every starter-deck game it played in phase 12 (Easy and Normal,
// seeds 1 to 12, true solo and two-handed), and the seeded beam search below (searchKnifeWin, Easy) found no win either:
// true solo seeds 1 to 4 and two-handed seed 1 at width 12 and 10 tries a round, after earlier runs at widths 4 to 16 on
// seeds 1 to 3; the best lines died on stage 2 with threat near 50. Two-handed seed 1 lost until an out-of-play Ringwraith
// could come from the encounter discard pile (rr.in-play-and-out-of-play); on the same seed and policy it now wins, so it is
// labeled won and the two-handed losses are the starter-deck game. The strong deck's filler is an event with no record, which
// stopped being playable on 2026-10-26 (rr.triggered-ability) and so stopped opening action windows; the strong games were
// played again and new seeds chosen: true solo 35 wins, two-handed 4 wins with both seats, and two-handed 10 wins with one
// seat eliminated.
export type KnifeGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: KnifeDecks; outcome: "won" | "lost" };

export const KNIFE_GOLDENS: readonly KnifeGolden[] = [
  { name: "true solo, strong, won", seatCount: 1, seed: 35, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, strong, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost" },
  { name: "two-handed, strong, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, strong, a seat eliminated, won", seatCount: 2, seed: 10, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, starter decks, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "starter", outcome: "lost" },
  { name: "two-handed, starter decks, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "starter", outcome: "lost" },
];

export function playGolden(golden: KnifeGolden, ctx: ReduceContext): KnifeGame {
  return playKnife(golden.seatCount, golden.seed, golden.difficulty, ctx, golden.decks);
}

// A small deterministic generator, so a search finds the same game every run (the one scripts/e2e/fixtures.ts uses).
export function generator(start: number): () => number {
  let value = start;
  return () => {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    return value / 0x7fffffff;
  };
}

// The searched answer: still only intents the reducer listed, with varied commits, defenders, attacks and travel.
export function variedIntent(state: ScenarioState, ctx: ReduceContext, random: () => number, memory: Set<string>): PlayerIntent {
  const base = knifeIntent(state, ctx, memory);
  const window = state.window?.kind;
  if (base.type === "Commit") {
    const ids = legalTargets(state, { type: "Commit" }, ctx).filter(() => random() < 0.7);
    return ids.length > 0 ? { type: "Commit", cardIds: ids } : base;
  }
  if (window === "defense" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender")) {
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => state.cards[id]?.code !== RING_BEARER);
    const pick = defenders[Math.floor(random() * defenders.length)];
    if (pick && random() < 0.9) return { type: "DeclareDefender", defenderId: pick };
  }
  if (window === "playerAttack" && base.type === "DeclareAttackers") {
    if (random() < 0.15) return { type: "DeclineAttack" };
    const attackers = base.attackerIds.filter(() => random() < 0.8);
    return attackers.length > 0 ? { ...base, attackerIds: attackers } : base;
  }
  if (window === "travel") {
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const pick = targets[Math.floor(random() * targets.length)];
    return pick && random() < 0.85 ? { type: "Travel", locationId: pick } : { type: "DeclineTravel" };
  }
  if (window === "choose") {
    const options = legalIntents(state, ctx).filter((intent) => intent.type === "Choose");
    const pick = options[Math.floor(random() * options.length)];
    if (pick?.type === "Choose") return { type: "Choose", optionId: pick.optionId };
  }
  if (window === "optionalEngage") {
    const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
    return enemy && random() < 0.3 ? { type: "Engage", enemyId: enemy } : { type: "DeclineEngage" };
  }
  return base;
}

type Branch = { state: ScenarioState; intents: PlayerIntent[]; memory: Set<string> };

function finished(state: ScenarioState): boolean {
  return state.lost || (state.stageCleared && state.window == null);
}

// Plays one round (until the round number changes or the game ends) with the varied answers.
function playRound(branch: Branch, ctx: ReduceContext, random: () => number): Branch {
  let { state } = branch;
  const intents = [...branch.intents];
  const memory = new Set(branch.memory);
  const round = state.round;
  for (let turn = 0; turn < 600 && !finished(state) && state.round === round; turn += 1) {
    const intent = state.window?.kind === "resolution" ? knifeIntent(state, ctx, memory) : variedIntent(state, ctx, random, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The search sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  return { state, intents, memory };
}

// How promising a position is: a later stage, more progress, lower threat, fewer wounds, fewer enemies in play.
function score(state: ScenarioState, ctx: ReduceContext): number {
  if (state.lost) return Number.NEGATIVE_INFINITY;
  if (state.stageCleared) return Number.POSITIVE_INFINITY;
  const stage = state.cards[state.questStage ?? ""];
  const active = state.cards[state.activeLocation ?? ""];
  let total = knife.stages.indexOf(stage?.code ?? "") * 1000 + (stage?.progress ?? 0) * 25 + (active?.progress ?? 0) * 10;
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    const seated = state.seats[seat];
    if (!seated || seated.eliminated) {
      total -= 2000;
      continue;
    }
    total -= seated.threat * 10 + seated.engaged.length * 10;
    for (const id of seated.heroes) {
      const hero = state.cards[id];
      total += 40 - (hero?.damage ?? 0) * (hero?.code === RING_BEARER ? 15 : 4);
    }
  }
  const enemies = Object.values(state.cards).filter((card) => (card.zone === "staging" || card.zone === "engaged") && ctx.cards.get(card.code)?.type === "enemy");
  return total - enemies.length * 10;
}

// A seeded search for a won game: from the kept opening hand, each round is played `tries` ways with the varied answers
// and the `width` best positions go on to the next round. Every intent is one the reducer listed and accepted, and the
// search is deterministic (a fixed generator, a stable sort). Returns the first won game, or null.
export function searchKnifeWin(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, options: { randomSeed: number; width: number; tries: number; rounds: number; trace?: (round: number, best: ScenarioState | null, alive: number) => void }): KnifeGame | null {
  const random = generator(options.randomSeed);
  const start = knifeStart(seatCount, seed, difficulty);
  const kept = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
  let beam: Branch[] = [{ state: kept, intents: [], memory: new Set() }];
  for (let round = 0; round < options.rounds && beam.length > 0; round += 1) {
    const next: { branch: Branch; value: number }[] = [];
    for (const branch of beam) {
      for (let attempt = 0; attempt < options.tries; attempt += 1) {
        const played = playRound(branch, ctx, random);
        if (!played.state.lost && played.state.stageCleared) {
          // Answer the Resolution with the auto-player and stop.
          let { state } = played;
          const intents = [...played.intents];
          while (!finished(state)) {
            const intent = knifeIntent(state, ctx, played.memory);
            state = expectOk(reduce(state, intent, ctx)).state;
            intents.push(intent);
          }
          return { start, kept, state, intents, steps: [] };
        }
        if (!played.state.lost) next.push({ branch: played, value: score(played.state, ctx) });
      }
    }
    beam = next.sort((left, right) => right.value - left.value).slice(0, options.width).map((item) => item.branch);
    options.trace?.(round, beam[0]?.state ?? null, next.length);
  }
  return null;
}
