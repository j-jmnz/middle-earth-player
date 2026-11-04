import { buildStart } from "../../../src/campaign/start.ts";
import { scenarioCards, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import { legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { anduin, campaign } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { attackTogether, engageOneEach, FILLER, fillerCard, fillerLoadout, type PlayedGame, playToEnd, STRONG_HEROES } from "../../harness/game-kit.ts";

// Test helper. A whole game of Journey Along the Anduin in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are
// big numbers (or too small to quest), and the decks free events, so the outcome depends on the engine, the seed and the encounter deck,
// not on player card play. Mendor is put into play by the campaign card's Setup; Valor and Scarred are set aside by it; no saga setup runs.
export { STRONG_HEROES };
export const ANDUIN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: true, act: true };
// "strong": big-number heroes. "weak": heroes too small to quest, so the players lose on threat. "brittle": strong quest and attack with 3 hit
// points and no Defense, so a Hill Troll's attack destroys a hero (Scarred, a prisoner chosen among the heroes left).
export type AnduinDecks = "strong" | "weak" | "brittle";

export const anduinLoadout = fillerLoadout;

const WEAK_STATS = { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 } as const;
const STRONG_STATS = { threat: 8, willpower: 20, attack: 12, defense: 6, health: 100 } as const;
const BRITTLE_STATS = { threat: 8, willpower: 20, attack: 12, defense: 0, health: 7 } as const;

export async function anduinWorld(decks: AnduinDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const codes = [...scenarioCards(anduin).map((card) => card.code), ...anduin.campaignPlaced, anduin.campaignCard];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of STRONG_HEROES) {
    cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...(decks === "weak" ? WEAK_STATS : decks === "brittle" ? BRITTLE_STATS : STRONG_STATS) }));
  }
  cards.set(FILLER, fillerCard());
  return { cards, ctx: { effects: EFFECTS, cards } };
}

export function anduinStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty): StartScenario {
  return buildStart({ campaign, scenario: anduin, seatCount, seed, threatModifier: 0, seats: anduinLoadout(seatCount), effects: EFFECTS, difficulty });
}

// With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
const STRONG_QUESTERS = new Set(["q1", "q2", "q4", "q5"]);

// The auto-player's answer (test/harness/auto-player.ts), except where the auto-player alone always declines: in a player attack window
// every ready character that can attack the first enemy it can reach attacks it together, and in the optional engagement step the
// seat engages one enemy at a time. Every intent is one the reducer listed.
export function anduinIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.some((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""))) {
      const questers = ids.filter((id) => STRONG_QUESTERS.has(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  // With the strong loadout no hero defends; the undefended damage goes on the least wounded hero.
  if (state.window?.kind === "defense") {
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const heroes = targets.filter((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...(heroes.length > 0 ? heroes : targets)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  const engaging = engageOneEach(state, ctx);
  if (engaging) return engaging;
  return nextIntent(state, ctx, ANDUIN_POLICY, memory);
}

export type AnduinGame = PlayedGame;

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playAnduin(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, limit = 8000): AnduinGame {
  const start = anduinStart(seatCount, seed, difficulty);
  return playToEnd(start, ctx, (state, memory) => anduinIntent(state, ctx, memory), limit);
}

// The goldens (src/campaign/scenarios/journey-along-the-anduin/golden.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution; a
// loss writes nothing.
export type AnduinGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: AnduinDecks; outcome: "won" | "lost"; lossReason?: string };

const MENDOR_LOST = "Mendor left play";
const THREAT_LOST = "No seats remain";

export const ANDUIN_GOLDENS: readonly AnduinGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, brittle heroes, won after a hero was lost", seatCount: 1, seed: 5, difficulty: "Normal", decks: "brittle", outcome: "won" },
  { name: "two-handed, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, Easy, won", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "two-handed, brittle heroes, won with a Valor and a Scarred", seatCount: 2, seed: 20, difficulty: "Normal", decks: "brittle", outcome: "won" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, brittle heroes, lost when Mendor leaves play", seatCount: 2, seed: 4, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: MENDOR_LOST },
];

export function playGolden(golden: AnduinGolden, ctx: ReduceContext): AnduinGame {
  return playAnduin(golden.seatCount, golden.seed, golden.difficulty, ctx);
}
