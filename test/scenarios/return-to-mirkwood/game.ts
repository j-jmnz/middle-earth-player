import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { guardianSeat } from "../../../src/rules/families/guardian/seats.ts";
import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const returnmirkwood = loadAnyScenario("return-to-mirkwood");

// Test helper. A whole standalone game of Return to Mirkwood played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players engage and attack together, the travel phase goes to the
// first location offered, and a choice takes the first option (who guards Gollum, whether to change the guard, an exhausted hero).
export const RETURNMIRKWOOD_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type ReturnmirkwoodDecks = "strong" | "weak" | "brittle";

export const returnmirkwoodLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const returnmirkwoodWorld = (decks: ReturnmirkwoodDecks = "strong") => game.world(decks);
export const returnmirkwoodStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

const stageCode = (state: ScenarioState) => state.cards[state.questStage ?? ""]?.code;

export type ReturnmirkwoodPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: ReturnmirkwoodPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says; each seat quests with one hero, so the others stay ready to defend the enemies that engage it (an attack no hero defends is undefended, and damage to the guard from one is dealt to Gollum), engages every enemy it may and the ready characters attack together. Every intent is one the reducer listed.
export function returnmirkwoodIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: ReturnmirkwoodPolicy = DEFAULT_POLICY, options: PolicyOptions = RETURNMIRKWOOD_POLICY): PlayerIntent {
  // Web-spinner's choice (exhaust a hero or gain surge) takes surge: a hero kept ready defends the guard.
  if (state.window?.kind === "choose" && state.window.options.includes("surge")) return { type: "Choose", optionId: "surge" };
  // A character to exhaust (Web-spinner's Shadow, Gollum may be chosen): Gollum, who has nothing to lose by it.
  if (state.window?.kind === "choose") {
    const gollum = state.window.options.find((option) => state.cards[option]?.code === "02130");
    if (gollum) return { type: "Choose", optionId: gollum };
  }
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  if (state.window?.kind === "pass" && state.mode === "questCommit" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    // From stage 3 on the guard of a two-handed game stays home: every enemy in play engages him on the last stage, and each hero ready defends one.
    const home = state.seatCount > 1 && state.activeSeat === guardianSeat(state) && ["02128", "02129"].includes(stageCode(state) ?? "");
    if (home) return { type: "Pass" };
    if (ids.length > 1) return { type: "Commit", cardIds: ids.slice(0, 1) };
  }
  const engage = engageOneEach(state, ctx, 1);
  if (engage) return engage;
  const attack = attackTogether(state, ctx);
  if (attack) return attack;
  return nextIntent(state, ctx, options, memory, legalIntents(state, ctx));
}

export type ReturnmirkwoodGame = PlayedGame;

// The goldens (src/campaign/scenarios/return-to-mirkwood/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type ReturnmirkwoodGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: ReturnmirkwoodDecks; outcome: "won" | "lost"; policy?: Partial<ReturnmirkwoodPolicy>; lossReason?: string };

// The games to pin (the first is the longest Normal win the reader parity test plays, src/play/reader-play/games.ts; about 400 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal, one on Easy and one two-handed on Nightmare,
// and each way to lose: Gollum destroyed, every player's threat at 50 (heroes too weak to quest), every hero destroyed (heroes that die to an attack) and, two-handed, the guard eliminated while the other player stays in the game.
export const RETURNMIRKWOOD_GOLDENS: readonly ReturnmirkwoodGolden[] = [
  { name: "two-handed win", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 107, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: Gollum destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Gollum left play" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 232, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: the guard eliminated", seatCount: 2, seed: 4, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "Gollum left play" },
];

const game = standaloneGame<ReturnmirkwoodDecks, ReturnmirkwoodPolicy>({
  campaign: cycle,
  scenario: returnmirkwood,
  stats: HERO_STATS,
  codes: [...returnmirkwood.cards.map((card) => card.code)],
  intent: returnmirkwoodIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: ReturnmirkwoodGolden, ctx: ReduceContext): ReturnmirkwoodGame => game.playGolden(golden, ctx);
