import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("the-hobbit");
const mountain = loadAnyScenario("the-lonely-mountain");

// Test helper. A whole standalone game of The Lonely Mountain played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The auto-player travels, engages and defends as it does everywhere; each Choose takes its first option (advance to the next stage, discard the matching cards, spend the Baggins resources), or its last as the policy says.
export const MOUNTAIN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type MountainDecks = "strong" | "weak" | "brittle";

// The first seat holds Bilbo Baggins in front, as the briefing's loadout deals him (src/campaign/loadout.ts, the saga hero 132001): his printed numbers are the data's, the other heroes are the stand-ins of `decks`. Every seat has the filler deck.
export const mountainLoadout = (seatCount: 1 | 2) => {
  const seats = fillerLoadout(seatCount);
  return seats.map((seat, index) => (index === 0 ? { ...seat, heroes: ["132001", ...seat.heroes.slice(0, 2)] } : seat));
};

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
// Bilbo Baggins has the stand-in numbers of `decks` (the data's hit points of 3 would end every solo game on the first attack), except in "brittle", where he keeps his printed 3 hit points and is the hero that dies first (the loss "Bilbo Baggins left play").
export async function mountainWorld(decks: MountainDecks = "strong") {
  const world = await game.world(decks);
  const bilbo = world.cards.get("132001");
  if (bilbo && decks !== "brittle") world.cards.set("132001", { ...bilbo, ...HERO_NUMBERS[decks] });
  return world;
}
const HERO_NUMBERS = { strong: { threat: HERO_STATS.strong.threat, willpower: HERO_STATS.strong.willpower, attack: HERO_STATS.strong.attack, defense: HERO_STATS.strong.defense, health: HERO_STATS.strong.health }, weak: { threat: HERO_STATS.weak.threat, willpower: 0, attack: 0, defense: 0, health: HERO_STATS.weak.health } } as const;
export const mountainStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type MountainPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: MountainPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function mountainIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: MountainPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, MOUNTAIN_POLICY, memory, legalIntents(state, ctx));
}

export type MountainGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-lonely-mountain/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type MountainGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: MountainDecks; outcome: "won" | "lost"; policy?: Partial<MountainPolicy>; lossReason?: string };

// The games to pin (about 300 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal and true solo on Easy (each makes stage 2B's burgle attempt, advances to stage 3 and wins by the progress that sets Smaug the Magnificent
// aside), and the ways to lose: every player's threat at 50 (heroes too weak to quest; the solo game reaches stage 4A through Pretending to Sleep before it ends) and Bilbo Baggins leaving play (brittle heroes). The scenario has no Nightmare deck in play (out of scope).
export const MOUNTAIN_GOLDENS: readonly MountainGolden[] = [
  { name: "solo win", seatCount: 1, seed: 9, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 5, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: Bilbo Baggins leaves play", seatCount: 2, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "Bilbo Baggins left play" },
];

const game = standaloneGame<MountainDecks, MountainPolicy>({
  campaign: cycle,
  scenario: mountain,
  stats: HERO_STATS,
  // Bilbo Baggins is no pile's card: the loadout deals him.
  codes: [...mountain.cards.map((card) => card.code), "132001"],
  loadout: mountainLoadout,
  intent: mountainIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: MountainGolden, ctx: ReduceContext): MountainGame => game.playGolden(golden, ctx);
