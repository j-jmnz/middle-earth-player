import { buildStart } from "../../../src/campaign/start.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { scenarioCards, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import { legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { BALROG, BRIDGE, campaign, CHAMBER, moria } from "./scene.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { attackTogether, engageOneEach, FILLER, fillerCard, type PlayedGame, playToEnd, STRONG_HEROES } from "../../harness/game-kit.ts";

// Test helper. A whole game of Journey in the Dark played by the auto-player, true solo or two-handed. The loadouts are the ones the Ring Goes South
// goldens use (test/scenarios/the-ring-goes-south/game.ts): the saga Frodo beside big-number heroes and a deck of free events, so the outcome depends on the engine and the
// seed, not on card play. The policy engages every enemy it can (each optional engagement takes a damage token off Doom, Doom, Doom), attacks every enemy
// engaged with the first seat, travels to Chamber of Mazarbul and the Great Bridge first, and never gives a hero up for the Bridge's damage.
export const RING_BEARER = "141001";
export { STRONG_HEROES };
export const MORIA_POLICY: PolicyOptions = { scout: "", prefer: CHAMBER, protect: RING_BEARER, play: true, act: false };
// "strong": big-number heroes. "weak": heroes too small to quest, so the players lose on threat. "brittle": strong quest and attack with a few hit points and no
// Defense, so an attack destroys every hero. "slow": heroes that quest for little, so the Doom countdown runs out and the Balrog arrives. "fragile": slow
// heroes with 30 hit points, so the Balrog's attacks destroy them.
export type MoriaDecks = "strong" | "weak" | "brittle" | "slow" | "fragile";

function slot(seatCount: 1 | 2): LoadoutSeat[] {
  const filler = Array.from({ length: 30 }, () => "filler");
  const first = { heroes: [RING_BEARER, "q1", "q2", "q3"], deck: filler };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck: filler }];
}

export function moriaLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  return slot(seatCount);
}

const WEAK_STATS = { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 } as const;
const STRONG_STATS = { threat: 8, willpower: 20, attack: 12, defense: 6, health: 100 } as const;
const BRITTLE_STATS = { threat: 8, willpower: 20, attack: 12, defense: 0, health: 9 } as const;
const SLOW_STATS = { threat: 8, willpower: 5, attack: 12, defense: 6, health: 100 } as const;
const FRAGILE_STATS = { threat: 8, willpower: 5, attack: 12, defense: 6, health: 30 } as const;
const STATS = { strong: STRONG_STATS, weak: WEAK_STATS, brittle: BRITTLE_STATS, slow: SLOW_STATS, fragile: FRAGILE_STATS } as const;

export async function moriaWorld(decks: MoriaDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const codes = [...scenarioCards(moria).map((card) => card.code), ...moria.campaignPlaced, moria.campaignCard, ...campaign.prelude.map((card) => card.code), RING_BEARER];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of STRONG_HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...STATS[decks] }));
  cards.set(FILLER, fillerCard());
  return { cards, ctx: { effects: EFFECTS, cards } };
}

export function moriaStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, decks: MoriaDecks = "strong"): StartScenario {
  void decks;
  return buildStart({ campaign, scenario: moria, seatCount, seed, threatModifier: 0, seats: moriaLoadout(seatCount), effects: EFFECTS, difficulty });
}

// With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
const STRONG_QUESTERS = new Set([RING_BEARER, "q1", "q2", "q4", "q5"]);

// The code of the location the policy travels to first: Chamber of Mazarbul while it is in play, the Great Bridge at stage 3.
function preferred(state: ScenarioState): string {
  const stage = state.cards[state.questStage ?? ""]?.code;
  return stage === "142042" ? BRIDGE : CHAMBER;
}

// The auto-player's answer (test/harness/auto-player.ts), except where the auto-player alone always declines: in a player attack window every ready character
// that can attack the first enemy it can reach attacks it together, and in the optional engagement step the seat engages one enemy at a time. Every intent
// is one the reducer listed.
export function moriaIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.some((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""))) {
      const questers = ids.filter((id) => STRONG_QUESTERS.has(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const together = attackTogether(state, ctx, (id) => state.cards[id]?.code !== RING_BEARER);
  if (together) return together;
  // With the strong loadout no hero defends; the undefended damage goes on the least wounded strong hero.
  if (state.window?.kind === "defense") {
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const heroes = targets.filter((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...(heroes.length > 0 ? heroes : targets)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Archery damage goes on a strong hero, never the Ring-bearer.
  if (state.window?.kind === "archery") {
    const recipient = legalTargets(state, { type: "Distribute" }, ctx).find((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""));
    if (recipient) return { type: "Distribute", assignments: [{ cardId: recipient, amount: state.window.total }] };
  }
  // A choice among cards (the locations the Setup finds, the damage a treachery assigns): never the Ring-bearer.
  if (state.window?.kind === "choose") {
    const other = state.window.options.find((id) => state.cards[id] != null && state.cards[id]?.code !== RING_BEARER);
    if (other) return { type: "Choose", optionId: other };
  }
  const engaging = engageOneEach(state, ctx);
  if (engaging) return engaging;
  if (state.window?.kind === "travel") {
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const wanted = targets.find((id) => state.cards[id]?.code === preferred(state));
    if (wanted) return { type: "Travel", locationId: wanted };
  }
  return nextIntent(state, ctx, MORIA_POLICY, memory);
}

export type MoriaGame = PlayedGame;

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playMoria(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, decks: MoriaDecks = "strong", limit = 8000): MoriaGame {
  const start = moriaStart(seatCount, seed, difficulty, decks);
  return playToEnd(start, ctx, (state, memory) => moriaIntent(state, ctx, memory), limit);
}

// The goldens (src/campaign/scenarios/journey-in-the-dark/golden.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution (the Balrog
// still in play earns all four burdens, else the first player chooses one of each pair); a loss writes nothing.
export type MoriaGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: MoriaDecks; outcome: "won" | "lost"; lossReason?: string; balrog?: "in play" | "not in play" };

const THREAT = "No seats remain";
const RING = "The One Ring left play";

export const MORIA_GOLDENS: readonly MoriaGolden[] = [
  { name: "true solo, strong, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", balrog: "not in play" },
  { name: "two-handed, strong, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", balrog: "not in play" },
  { name: "two-handed, strong, won with the Balrog in play", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", balrog: "in play" },
  { name: "true solo, slow, won with the Balrog in play", seatCount: 1, seed: 3, difficulty: "Normal", decks: "slow", outcome: "won", balrog: "in play" },
  { name: "true solo, strong, Easy, won", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", balrog: "not in play" },
  { name: "two-handed, strong, Easy, won with the Balrog in play", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", balrog: "in play" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT },
  { name: "true solo, fragile, lost to the Balrog", seatCount: 1, seed: 1, difficulty: "Normal", decks: "fragile", outcome: "lost", lossReason: RING, balrog: "in play" },
  { name: "two-handed, brittle, lost with the One Ring", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: RING, balrog: "not in play" },
];

export function playGolden(golden: MoriaGolden, ctx: ReduceContext): MoriaGame {
  return playMoria(golden.seatCount, golden.seed, golden.difficulty, ctx, golden.decks);
}

export { BALROG };
