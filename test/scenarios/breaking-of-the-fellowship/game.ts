import { checklist } from "../../../src/campaign/checklist.ts";
import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { buildStart } from "../../../src/campaign/start.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { scenarioCards, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import { legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { ARGONATH, breaking, campaign, PARTH_GALEN, SARN_GEBIR, STAGES_3A } from "./scene.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { attackTogether, engageOneEach, FILLER, fillerCard, playToEnd } from "../../harness/game-kit.ts";

// Test helper. A whole game of Breaking of the Fellowship played by the auto-player, true solo or two-handed. The loadouts are the ones the Journey in the Dark goldens use
// (test/scenarios/journey-in-the-dark/game.ts): the saga Frodo beside big-number heroes and a deck of free events, so the outcome depends on the engine and the seed, not on card play. The
// policy travels to Sarn Gebir, The Argonath and Parth Galen when it can (stage 1 cannot advance while The Argonath is in play, the players cannot win while Parth Galen is),
// engages every enemy it can in the optional engagement step, attacks every enemy engaged with the seat, answers a stage choice with the title it was given and never puts the
// Ring-bearer in the way of damage.
export const RING_BEARER = "141001";
export const HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const BREAKING_POLICY: PolicyOptions = { scout: "", prefer: "", protect: RING_BEARER, play: true, act: false };
// "strong": big-number heroes. "weak": heroes too small to quest, so the players lose on threat. "brittle": strong quest and attack with a few hit points and no Defense, so the
// enemies destroy every hero. "slow": heroes that quest for little, so the game runs long.
export type BreakingDecks = "strong" | "weak" | "brittle" | "slow";

export function breakingLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const filler = Array.from({ length: 30 }, () => "filler");
  const first = { heroes: [RING_BEARER, "q1", "q2", "q3"], deck: filler };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck: filler }];
}

const STATS = {
  strong: { threat: 8, willpower: 20, attack: 12, defense: 6, health: 100 },
  weak: { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 },
  brittle: { threat: 8, willpower: 20, attack: 12, defense: 0, health: 9 },
  slow: { threat: 8, willpower: 5, attack: 12, defense: 6, health: 100 },
} as const;

export async function breakingGameWorld(decks: BreakingDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const codes = [...scenarioCards(breaking).map((card) => card.code), ...breaking.campaignPlaced, "142015", "142016", "142017", "142018", "142083", breaking.campaignCard, ...campaign.prelude.map((card) => card.code), RING_BEARER];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...STATS[decks] }));
  cards.set(FILLER, fillerCard());
  return { cards, ctx: { effects: EFFECTS, cards } };
}

export function breakingStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty = "Normal"): StartScenario {
  return buildStart({ campaign, scenario: breaking, seatCount, seed, threatModifier: 0, seats: breakingLoadout(seatCount), effects: EFFECTS, difficulty });
}

// The campaign log when scenario 6 starts: scenarios 1 to 5 won, no hero listed yet (the checklist lists them).
export const PRIOR = ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south", "journey-in-the-dark"];
export function breakingLog(seatCount: 1 | 2): CampaignLog {
  return { ...emptyLog(seatCount), completed: PRIOR };
}

// The campaign card's Setup (142060:A:2), through the Campaign Setup Checklist: the first seat takes the Phial of Galadriel onto q1, the second seat Three Golden Hairs onto q4.
export const BOON_CHOICES = ["142015>q1", "142016>q4"];

// The game as a campaign scenario starts: the checklist deals the boons onto heroes, and the burdens go into the encounter deck.
export function breakingCampaignStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, cards: ReadonlyMap<string, PrintedCard>): { start: StartScenario; log: CampaignLog } {
  const log = breakingLog(seatCount);
  const plan = checklist({ log, scenario: breaking, seats: breakingLoadout(seatCount), effects: EFFECTS, cards, choices: BOON_CHOICES.slice(0, seatCount) });
  if (!plan.ok) throw new Error(JSON.stringify(plan));
  const start = buildStart({ campaign, scenario: breaking, seatCount, seed, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, mode: "campaign", difficulty });
  return { start, log: plan.log };
}

// The location codes the policy travels to, first choice first.
const TRAVEL_TO = [SARN_GEBIR, ARGONATH, PARTH_GALEN];
// With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
const STRONG_QUESTERS = new Set([RING_BEARER, "q1", "q2", "q4", "q5"]);

// The auto-player's answer (test/harness/auto-player.ts), except where it alone always declines or takes the first option: the heroes that quest, a stage 3A (`stages` lists each
// seat's preference, first first), a player attack window in which every ready character attacks, the optional engagement step and the travel window. Every intent is one
// the reducer listed.
export function breakingIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, stages: readonly (readonly string[])[]): PlayerIntent {
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.some((id) => HEROES.includes(state.cards[id]?.code ?? ""))) {
      const questers = ids.filter((id) => STRONG_QUESTERS.has(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const together = attackTogether(state, ctx, (id) => state.cards[id]?.code !== RING_BEARER);
  if (together) return together;
  // Undefended damage goes on the least wounded strong hero.
  if (state.window?.kind === "defense") {
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const heroes = targets.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...(heroes.length > 0 ? heroes : targets)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Archery damage goes on a strong hero, never the Ring-bearer.
  if (state.window?.kind === "archery") {
    const recipient = legalTargets(state, { type: "Distribute" }, ctx).find((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    if (recipient) return { type: "Distribute", assignments: [{ cardId: recipient, amount: state.window.total }] };
  }
  if (state.window?.kind === "choose") {
    // A stage 3A: the seat's preferred title among the options it is offered.
    const wanted = (stages[state.activeSeat] ?? []).find((code) => (state.window?.kind === "choose" ? state.window.options : []).includes(code));
    if (wanted) return { type: "Choose", optionId: wanted };
    // A choice among cards (a hero to attach to, a player): never the Ring-bearer.
    const other = state.window.options.find((id) => state.cards[id] != null && state.cards[id]?.code !== RING_BEARER);
    if (other) return { type: "Choose", optionId: other };
  }
  const engaging = engageOneEach(state, ctx);
  if (engaging) return engaging;
  if (state.window?.kind === "travel") {
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const wanted = TRAVEL_TO.map((code) => targets.find((id) => state.cards[id]?.code === code)).find((id) => id != null);
    if (wanted) return { type: "Travel", locationId: wanted };
  }
  return nextIntent(state, ctx, BREAKING_POLICY, memory);
}

export type BreakingGame = { start: StartScenario; log: CampaignLog; kept: ScenarioState; state: ScenarioState; intents: PlayerIntent[]; steps: EngineStep[] };

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playBreaking(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, stages: readonly (readonly string[])[] = [], limit = 8000): BreakingGame {
  const { start, log } = breakingCampaignStart(seatCount, seed, difficulty, ctx.cards);
  return { ...playToEnd(start, ctx, (state, memory) => breakingIntent(state, ctx, memory, stages), limit), log };
}

export { STAGES_3A };

// The goldens (src/campaign/scenarios/breaking-of-the-fellowship/golden.test.ts), also played by the causes and replay tests. `stages` is each seat's preferred stage 3A. A win runs the campaign card's
// Resolution (the first player takes the first burden of the pair, each seat names a captive and a hero that Fallen Into Evil still holds is logged as fallen); a loss writes nothing.
export type BreakingGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: BreakingDecks; stages: readonly (readonly string[])[]; outcome: "won" | "lost"; lossReason?: string; separate: boolean };

const THREAT = "No seats remain";

export const BREAKING_GOLDENS: readonly BreakingGolden[] = [
  { name: "true solo, strong, won on The Seat of Amon Hen", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", stages: [["142065"]], outcome: "won", separate: true },
  { name: "two-handed, strong, won on Searching the Woods and Orc Hunting", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", stages: [["142063"], ["142066"]], outcome: "won", separate: true },
  { name: "two-handed, strong, won with a hero fallen into evil", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", stages: [["142064"], ["142065"]], outcome: "won", separate: true },
  { name: "two-handed, strong, won in a long game", seatCount: 2, seed: 14, difficulty: "Normal", decks: "strong", stages: [["142066"], ["142065"]], outcome: "won", separate: true },
  { name: "two-handed, strong, Easy, won", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", stages: [["142064"], ["142066"]], outcome: "won", separate: true },
  { name: "true solo, strong, Easy, won", seatCount: 1, seed: 4, difficulty: "Easy", decks: "strong", stages: [["142066"]], outcome: "won", separate: true },
  { name: "true solo, weak, lost on threat before the Fellowship breaks", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", stages: [["142063"]], outcome: "lost", lossReason: THREAT, separate: false },
  { name: "two-handed, weak, lost on threat before the Fellowship breaks", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", stages: [["142063"], ["142064"]], outcome: "lost", lossReason: THREAT, separate: false },
  { name: "true solo, slow, lost on threat at the separate stages", seatCount: 1, seed: 2, difficulty: "Normal", decks: "slow", stages: [["142064"]], outcome: "lost", lossReason: THREAT, separate: true },
  { name: "two-handed, slow, lost on threat at the separate stages", seatCount: 2, seed: 2, difficulty: "Normal", decks: "slow", stages: [["142063"], ["142065"]], outcome: "lost", lossReason: THREAT, separate: true },
  { name: "two-handed, brittle, lost when the heroes are destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", stages: [["142063"], ["142066"]], outcome: "lost", lossReason: THREAT, separate: true },
];

export function playGolden(golden: BreakingGolden, ctx: ReduceContext): BreakingGame {
  return playBreaking(golden.seatCount, golden.seed, golden.difficulty, ctx, golden.stages);
}
