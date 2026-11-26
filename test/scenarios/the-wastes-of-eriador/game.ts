import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { angmarIntent, type AngmarPolicy } from "../../harness/angmar-policy.ts";
import { type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

const campaign = loadCampaign("angmar-awakened");
const eriador = loadScenario("the-wastes-of-eriador");
const PACK_LEADER = "10017";
const NIGHTFALL = "10012";

// Test helper. A whole game of The Wastes of Eriador in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players quest with the heroes the policy names (the Time objective is Day when stage 1B's quest places its progress, Night when the
// enemies engage), attack Pack Leader first (stage 3B is won by destroying him once 5 progress is on it), defend as the policy says, and answer each choice with the policy's answer: the safe option of Predatory Wolves is the search, which keeps the
// players' allies and Amarthiúl (his leaving play loses the game). Travel, engagement and the heroes-only commit and defense are the shared Angmar policy's (test/harness/angmar-policy.ts, which Deadmen's Dike plays too): the same auto-player, with Pack Leader in Thaurdir's place.
export const ERIADOR_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type EriadorDecks = "strong" | "weak" | "brittle";

export const eriadorLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const eriadorWorld = (decks: EriadorDecks = "strong") => game.world(decks);
export const afterDike = (seatCount: 1 | 2) => game.after(seatCount);
export const eriadorPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
// `choices`: the Campaign Setup Checklist's answers; `standalone`: the scenario alone, with no campaign card.
export const eriadorStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, extra: { choices?: readonly string[]; standalone?: boolean } = {}) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, ...extra });

export type EriadorPolicy = AngmarPolicy;
// The options that keep what the players have: Predatory Wolves' search for a Warg rather than the discard of an ally (Amarthiúl counts as cost 0 and his leaving play loses the game).
const SAFE_CHOICES = ["search"];
export const DEFAULT_POLICY: EriadorPolicy = { choose: "safe", engage: false, defend: "none", quest: "all" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice is answered as the policy says; the rest is the shared Angmar policy's (the players engage the Wargs of the staging area, the first ready character of each seat attacks, a defender is a hero), with Pack Leader attacked before any other Warg.
// Every intent is one the reducer listed.
export function eriadorIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: EriadorPolicy = DEFAULT_POLICY, options: PolicyOptions = ERIADOR_POLICY): PlayerIntent {
  if (state.window?.kind === "playerAttack") {
    // One character at a time, so the others are left to attack another enemy in the next window; an enemy is attacked once in a phase (the memory holds the round and the enemy). Pack Leader first: stage 3B is won by destroying him.
    const seat = state.seats[state.activeSeat];
    const rank = (enemyId: string) => (state.cards[enemyId]?.code === PACK_LEADER ? 0 : 1);
    const attack = (seat?.heroes ?? []).map((one) => attackTogether(state, ctx, (id) => id === one, rank)).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  // The Time objective: no progress is placed at Night (one hero still commits: the quest needs a character), and Pack Leader exhausts a ready character for each Warg engaged with the player, so the heroes stay ready at Night to attack him (progress from the Day's quest is still on the stage then).
  const night = Object.values(state.cards).some((card) => card.code === NIGHTFALL && card.zone === "staging");
  return angmarIntent(state, ctx, memory, { ...policy, quest: night ? "one" : policy.quest }, options, { safe: SAFE_CHOICES, rank: () => 1 });
}

export type EriadorGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-wastes-of-eriador/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type EriadorGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: EriadorDecks; outcome: "won" | "lost"; policy?: Partial<EriadorPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// Every game is played after Deadmen's Dike's win (`after`): the pool holds Mysterious Omens, Arnor Ravaged, Amarthiúl's Courage and a burden, Determination is added to each hand at the Campaign Setup and Fend Off Despair is shuffled into the encounter deck.
// Wins: true solo and two-handed (the heroes quest at Day, one stays at the quest at Night so the rest can attack Pack Leader once he engages; the players engage nobody, every choice is the safe one), and true solo answering every choice with its
// last option, which makes a side quest the current quest, so Fend Off Despair is defeated and the Resolution notes the starting threat 2 lower. The ways to lose: the players' threat at 50 (heroes too small to quest), every hero destroyed (heroes with too few hit
// points) and Amarthiúl leaving play (every choice the first option: Predatory Wolves discards him as the only ally). Determination is not played by the auto-player: the line tests of pool.test.ts and the campaign test play it and write its mark.
export const ERIADOR_GOLDENS: readonly EriadorGolden[] = [
  { name: "true solo, won, Normal", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, won, Fend Off Despair defeated", seatCount: 1, seed: 96, difficulty: "Normal", decks: "strong", outcome: "won", after: true, policy: { choose: "last" } },
  { name: "two-handed, won, Normal", seatCount: 2, seed: 10, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, lost, threat reaches 50", seatCount: 1, seed: 7, difficulty: "Normal", decks: "weak", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", after: true, lossReason: "No seats remain" },
  { name: "true solo, lost, Amarthiúl leaves play", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", after: true, policy: { choose: "first" }, lossReason: "Amarthiúl left play" },
];

const game = campaignGame<EriadorDecks, EriadorPolicy>({
  campaign,
  scenario: eriador,
  stats: HERO_STATS,
  // The scenario's cards, a double-sided one (the Time objective) with its back; the campaign card's, the cards it places (Determination, Fend Off Despair, the Omens boons) and the campaign's game codes are added by the kit. The pool holds what Deadmen's Dike leaves: Mysterious Omens and its boons, Arnor Ravaged, Amarthiúl's Courage and a burden.
  codes: [...eriador.cards.flatMap((card) => (card.back != null ? [card.code, card.back] : [card.code])), "10160", "10161", "10162", "10163", "10164", "10165", "100158", "10157", "10167", "10168", "10169", "10170"],
  intent: eriadorIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // Intruders in Chetwood, The Weather Hills and Deadmen's Dike were won: no XP in this campaign; in the pool Mysterious Omens, Arnor Ravaged (with the damage the log noted), Amarthiúl's Courage and Thaurdir's Legacy.
  earlier: { xp: [0, 0, 0], pool: [{ code: "10160" }, { code: "100158" }, { code: "10167" }, { code: "10168" }], marks: {} },
});

export const playGolden = (golden: EriadorGolden, ctx: ReduceContext): EriadorGame => game.playGolden(golden, ctx);
