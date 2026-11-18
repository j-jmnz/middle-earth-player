import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const rhosgobel = loadAnyScenario("a-journey-to-rhosgobel");
const ATHELAS = "02063";
const WILYADOR = "02064";

// Test helper. A whole standalone game of A Journey to Rhosgobel played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution.
export const RHOSGOBEL_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type RhosgobelDecks = "strong" | "weak" | "brittle";

export const rhosgobelLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const rhosgobelWorld = (decks: RhosgobelDecks = "strong") => game.world(decks);
export const rhosgobelStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type RhosgobelPolicy = {
  // The option a Choose window with these answers takes: the first or the last (Athelas, when a choice offers it, always).
  choose: "first" | "last";
  // "all": every character quests; "none": nobody does, so the staging area never raises the threat much and the round passes on Wilyador's damage alone.
  quest: "all" | "none";
  // Radagast's Request (02061:B:1) is used while Wilyador holds at most this much damage: each use places damage on him, and the top card it reveals is Athelas when it is there.
  radagast: number;
};
export const DEFAULT_POLICY: RhosgobelPolicy = { choose: "first", quest: "all", radagast: 0 };

// The players look for Athelas and claim it. Every character quests (a hero that is ready in the planning phase claims an Athelas that nothing guards: the auto-player's Actions); each seat engages every enemy it may, one at a time, and every ready character
// attacks the first enemy any can reach together (Wilyador, an Eagle, is the one who may attack a Mirkwood Flock or Black Forest Bats); a defender takes every attack he can. Radagast's Request is used while Wilyador can afford its damage, and its look reveals Athelas
// when it is among the top 3 cards. `options` are the auto-player's for everything else (the fixtures play real decklists with `play: true`).
export function rhosgobelIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: RhosgobelPolicy = DEFAULT_POLICY, options: PolicyOptions = RHOSGOBEL_POLICY): PlayerIntent {
  const window = state.window;
  if (window?.kind === "choose") {
    const athelas = window.options.find((id) => state.cards[id]?.code === ATHELAS);
    return { type: "Choose", optionId: athelas ?? (policy.choose === "last" ? window.options.at(-1) : window.options[0]) ?? "" };
  }
  const wilyador = Object.values(state.cards).find((card) => card.code === WILYADOR);
  const intents = legalIntents(state, ctx).filter((intent) => !(intent.type === "Trigger" && intent.effectId === "02061:response:1" && (wilyador?.damage ?? 0) > policy.radagast));
  const engage = engageOneEach(state, ctx, 8);
  if (engage) return engage;
  const attack = attackTogether(state, ctx);
  if (attack) return attack;
  if (window?.kind === "pass" && state.mode === "questCommit" && policy.quest === "none" && intents.some((intent) => intent.type === "Pass")) return { type: "Pass" };
  return nextIntent(state, ctx, options, memory, intents);
}

export type RhosgobelGame = PlayedGame;

// The goldens (src/campaign/scenarios/a-journey-to-rhosgobel/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type RhosgobelGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: RhosgobelDecks; outcome: "won" | "lost"; policy?: Partial<RhosgobelPolicy>; lossReason?: string };

// The games to pin (the first is the longest win: the reader parity test plays it, src/play/reader-play/games.ts; about 350 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal, one on Easy and one two-handed on Nightmare (Radagast's Request is used in the first), and each way the scenario is lost: every
// player's threat at 50 (heroes with a high threat and no Willpower), every hero destroyed, Wilyador destroyed by the damage he takes each round, the seat that controls him eliminated while the other lives on, and stage 3 reached with Wilyador not healed.
export const RHOSGOBEL_GOLDENS: readonly RhosgobelGolden[] = [
  { name: "two-handed win", seatCount: 2, seed: 97, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo win", seatCount: 1, seed: 41, difficulty: "Normal", decks: "strong", outcome: "won", policy: { radagast: 20 } },
  { name: "Easy solo win", seatCount: 1, seed: 82, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 104, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", policy: { quest: "none" }, lossReason: "No seats remain" },
  { name: "solo loss: Wilyador destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { quest: "none" }, lossReason: "Wilyador left play" },
  { name: "two-handed loss: the seat that controls Wilyador eliminated", seatCount: 2, seed: 6, difficulty: "Normal", decks: "brittle", outcome: "lost", policy: { quest: "none" }, lossReason: "Wilyador left play" },
  { name: "solo loss: Wilyador not healed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Wilyador was not healed" },
];

const game = standaloneGame<RhosgobelDecks, RhosgobelPolicy>({
  campaign: cycle,
  scenario: rhosgobel,
  // "weak": heroes with a high starting threat (14 each) and no Willpower, so the players' threat reaches 50 while Wilyador still stands; "brittle": heroes with 2 hit points and no Defense, who die to the first attack that lands.
  stats: { ...HERO_STATS, weak: { threat: 14, willpower: 0, attack: 0, defense: 0, health: 100 }, brittle: { threat: 3, willpower: 20, attack: 0, defense: 0, health: 2 } },
  codes: [...rhosgobel.cards.map((card) => card.code)],
  intent: rhosgobelIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: RhosgobelGolden, ctx: ReduceContext): RhosgobelGame => game.playGolden(golden, ctx);
