import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { campaign, upanduin } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, engageOneEach, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of Journey Up the Anduin in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players engage the enemies and attack the Evil Creatures first (they keep the stages shut), one hero quests, nobody defends, a choice takes
// the first option (or the last, as the policy says), and the Resolution's offer is answered by the policy.
export const UPANDUIN_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat.
export type UpanduinDecks = "strong" | "weak";

export const upanduinLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const upanduinWorld = (decks: UpanduinDecks = "strong") => game.world(decks);
export const upanduinPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const upanduinStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type UpanduinPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The Resolution's offer: the ally for the first hero (first) or the oath line (last).
  resolve: "first" | "last";
  // Uses each Action it can once a round and answers each Response offered (the campaign card's: a resource for each location explored, and the treasure at players + 3).
  act: boolean;
};
export const DEFAULT_POLICY: UpanduinPolicy = { choose: "first", resolve: "first", act: false };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// `options`: the auto-player's own policy for the answers this one does not give; the Maestro fixtures (scripts/e2e/journey-up-the-anduin.ts) play real decklists, so they turn card play on.
export function upanduinIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: UpanduinPolicy = DEFAULT_POLICY, options: PolicyOptions = UPANDUIN_POLICY): PlayerIntent {
  // The Resolution's offer (Turayn joins the pool for a player, or the oath line): the first option is the ally, the last the line.
  if (state.window?.kind === "resolution") {
    const options = legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    return { type: "ChooseResolution", optionId: (policy.resolve === "last" ? options.at(-1) : options[0]) ?? "" };
  }
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  // The Evil Creatures keep the stages shut while any is in play (18066:B:3), so the players engage the enemies and attack them together.
  // One hero quests (20 Willpower against a staging area of a few enemies); the others stay ready to attack.
  if (state.window?.kind === "pass" && state.mode === "questCommit" && legalIntents(state, ctx).some((intent) => intent.type === "Commit")) {
    const first = state.seats[state.activeSeat]?.heroes[0];
    if (first && legalTargets(state, { type: "Commit" }, ctx).includes(first) && !state.cards[first]?.committed) return { type: "Commit", cardIds: [first] };
  }
  // Nobody defends (a defender exhausts and could not attack), and the heroes are too sturdy to mind: the hero with the least damage takes each attack.
  if (state.window?.kind === "defense") {
    const heroes = (state.seats[state.window.seat]?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Each hero attacks alone, an Evil Creatures enemy first: the stages stay shut while one is in play.
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
      const enemies = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx);
      const enemy = enemies.find((id) => state.cards[id]?.deck === "evilCreatures") ?? enemies[0];
      if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
    }
  }
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  return nextIntent(state, ctx, { ...options, act: policy.act }, memory, legalIntents(state, ctx));
}

export type UpanduinGame = PlayedGame;

// The goldens (src/campaign/scenarios/journey-up-the-anduin/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type UpanduinGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: UpanduinDecks; outcome: "won" | "lost"; policy?: Partial<UpanduinPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// The pinned games: wins (true solo and two-handed, Normal and Easy, both Resolution offers, treasures) and losses on threat, each on a fixed seed.
export const UPANDUIN_GOLDENS: readonly UpanduinGolden[] = [
  { name: "true solo, won, Turayn joins the pool", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won, the oath line", seatCount: 1, seed: 8, difficulty: "Easy", decks: "strong", outcome: "won", policy: { resolve: "last" } },
  { name: "true solo, won, a treasure claimed and lost with its character", seatCount: 1, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won", policy: { act: true } },
  { name: "two-handed, won, a treasure discovered, Turayn joins the pool", seatCount: 2, seed: 26, difficulty: "Normal", decks: "strong", outcome: "won", policy: { act: true } },
  { name: "two-handed, Easy, won, a treasure discovered, the oath line", seatCount: 2, seed: 25, difficulty: "Easy", decks: "strong", outcome: "won", policy: { act: true, resolve: "last" } },
  { name: "two-handed, won, no Response used", seatCount: 2, seed: 13, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
];

const game = campaignGame<UpanduinDecks, UpanduinPolicy>({
  campaign,
  scenario: upanduin,
  stats: HERO_STATS,
  // The scenario's cards, the cards its campaign card places, Haldan and the treasures the campaign card can attach.
  codes: [...upanduin.cards.map((card) => card.code), ...upanduin.campaignPlaced, "18070", "12196", "12197", "12198", "12199", "12200", "12201", "12202", "12203", "12204"],
  intent: upanduinIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
});

export const playGolden = (golden: UpanduinGolden, ctx: ReduceContext): UpanduinGame => game.playGolden(golden, ctx);
