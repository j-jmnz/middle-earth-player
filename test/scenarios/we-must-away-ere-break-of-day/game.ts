import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { attackDeclared } from "../../../src/rules/combat/combat.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("the-hobbit");
const day = loadAnyScenario("we-must-away-ere-break-of-day");
const BILBO = "131001";

// Test helper. A whole standalone game of We Must Away, Ere Break of Day played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution.
export const DAY_POLICY: PolicyOptions = { scout: "", prefer: "", protect: BILBO, play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack; "steady": strong attackers with a Willpower of 6, so the quest is slow and the Trolls are destroyed before the encounter deck is.
export type DayDecks = "strong" | "weak" | "brittle" | "steady";

// The loadout deals Bilbo Baggins to the first seat, in front of its three stand-in heroes (hob.bilbo-baggins-ohauh); the second seat has its own three.
export const dayLoadout = (seatCount: 1 | 2): LoadoutSeat[] => fillerLoadout(seatCount).map((seat, index) => (index === 0 ? { ...seat, heroes: [BILBO, ...seat.heroes] } : seat));

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const dayWorld = (decks: DayDecks = "strong") => game.world(decks);
export const dayStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type DayPolicy = {
  // The option a Choose window with these answers takes: the first or the last (the Trolls' "return" and "raise", the target of a Sack card).
  choose: "first" | "last";
  // "all": every character quests; "none": nobody does, so the Trolls are not outquested and engage the players; "stage1": they quest until stage 2B, where the progress would discard the encounter deck, and then do not, so the stage advances only when the Trolls are destroyed.
  quest: "all" | "none" | "stage1";
  // The players engage every enemy they may, one at a time, and every ready character attacks the first enemy any can reach together.
  fight: boolean;
};
export const DEFAULT_POLICY: DayPolicy = { choose: "first", quest: "all", fight: false };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function dayIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DayPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  const intents = legalIntents(state, ctx);
  if (policy.fight) {
    const engage = engageOneEach(state, ctx, 8);
    if (engage) return engage;
    // A Troll is attacked by one character at a time (131034:A:1) and each enemy once a phase: the rest of the ready characters pass on it.
    const attack = attackTogether(state, ctx);
    if (attack?.type === "DeclareAttackers") return attackDeclared(state, state.activeSeat, attack.enemyId) ? { type: "DeclineAttack" } : attack;
  }
  const idle = policy.quest === "none" || (policy.quest === "stage1" && state.cards[state.questStage ?? ""]?.code === "131024");
  if (state.window?.kind === "pass" && state.mode === "questCommit" && idle && intents.some((intent) => intent.type === "Pass")) return { type: "Pass" };
  return nextIntent(state, ctx, DAY_POLICY, memory, intents);
}

export type DayGame = PlayedGame;

// The goldens (src/campaign/scenarios/we-must-away-ere-break-of-day/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type DayGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DayDecks; outcome: "won" | "lost"; policy?: Partial<DayPolicy>; lossReason?: string };

// The games to pin (the first is the longest win: the reader parity test plays it, src/play/reader-play/games.ts; about 160 intents in all, .claude/rules/code-standards.md, Test cost): a win true solo on Easy and one two-handed on Normal (the Trolls engage and are fought, the Sack cards are
// drawn and the encounter deck runs out), and a loss for each way to lose: every player's threat at 50 (heroes too small to quest) and Bilbo Baggins destroyed by a Troll. Nightmare is out of scope.
export const DAY_GOLDENS: readonly DayGolden[] = [
  { name: "solo win on Easy, the Trolls are fought", seatCount: 1, seed: 6, difficulty: "Easy", decks: "steady", outcome: "won", policy: { choose: "last", fight: true } },
  { name: "two-handed win, the Trolls are fought and the Sack cards are drawn", seatCount: 2, seed: 5, difficulty: "Normal", decks: "steady", outcome: "won", policy: { choose: "last", fight: true } },
  { name: "solo loss, the threat reaches 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss, Bilbo Baggins is destroyed", seatCount: 1, seed: 3, difficulty: "Normal", decks: "steady", outcome: "lost", lossReason: "Bilbo Baggins left play", policy: { fight: true } },
];

const game = standaloneGame<DayDecks, DayPolicy>({
  campaign: cycle,
  scenario: day,
  stats: HERO_STATS,
    codes: [...day.cards.map((card) => card.code), BILBO],
  loadout: dayLoadout,
  intent: dayIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: DayGolden, ctx: ReduceContext): DayGame => game.playGolden(golden, ctx);
