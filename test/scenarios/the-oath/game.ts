import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { ADAPTATIONS, campaign, oath } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, engageOneEach, fillerLoadout, HERO_STATS, type PlayedGame, STRONG_HEROES as HEROES } from "../../harness/game-kit.ts";

// Test helper. A whole game of The Oath in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small
// to quest, or too brittle to survive an attack), and the decks free events, so the outcome depends on the engine, the seed and the encounter deck,
// not on player card play. Each seat chooses an Adaptation boon at the Campaign Setup Checklist and attaches it to its first hero; the Stalking
// Goblin burden is shuffled into the encounter deck. The Oath's Response (a token at the end of each round) is taken or declined by the golden.
export { HEROES };
export const OATH_POLICY: PolicyOptions = { scout: "", prefer: "41014", protect: "", play: true, act: true };
// "strong": big-number heroes. "steady": heroes that quest for little, so the scenario takes many rounds. "weak": heroes too small to quest, so the
// players lose on threat. "brittle": strong quest and attack with a few hit points and no Defense, so an enemy's attack destroys a hero.
export type OathDecks = "strong" | "steady" | "weak" | "brittle";

export const oathLoadout = fillerLoadout;

export type Adaptations = readonly (typeof ADAPTATIONS)[number][];
export const DEFAULT_ADAPTATIONS: Adaptations = ["41044", "41045"];

export function oathChoices(seatCount: 1 | 2, adaptations: Adaptations = DEFAULT_ADAPTATIONS): string[] {
  return Array.from({ length: seatCount }, (_, seat) => `${adaptations[seat] ?? "41044"}>${seat === 0 ? "q1" : "q4"}`);
}

// The scenario dealt through the Campaign Setup Checklist: each seat's chosen Adaptation goes on its first hero, Stalking Goblin joins the encounter deck
// and the pool a log carries is dealt with it.
const game = campaignGame<OathDecks, OathPolicy>({ campaign, scenario: oath, stats: HERO_STATS, codes: ADAPTATIONS, intent: oathIntent, policy: { tokens: "take" }, limit: 8000, upgraded: [] });

export const oathWorld = (decks: OathDecks = "strong") => game.world(decks);
export const oathPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), adaptations: Adaptations = DEFAULT_ADAPTATIONS) => game.plan(seatCount, log, oathChoices(seatCount, adaptations));
export const oathStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: CampaignFacts, log: CampaignLog = emptyLog(seatCount), adaptations: Adaptations = DEFAULT_ADAPTATIONS): StartScenario => game.start(seatCount, seed, difficulty, facts, log, undefined, oathChoices(seatCount, adaptations));

export type OathPolicy = { tokens: "take" | "skip" };

// The auto-player's answer (test/harness/auto-player.ts), except where the auto-player alone always declines: in a player attack window every ready
// character that can attack the first enemy it can reach attacks it together, and in the optional engagement step the seat engages one enemy at a
// time. Every intent is one the reducer listed.
export function oathIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: OathPolicy = { tokens: "take" }): PlayerIntent {
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    // With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
    const heroes = ids.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-2) : heroes.length === 2 ? heroes.slice(-1) : [];
      const questers = ids.filter((id) => !home.includes(id));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  // A choice among heroes (the hero a card picks): the least wounded one.
  if (state.window?.kind === "choose" && state.window.options.length > 1 && state.window.options.every((id) => state.cards[id]?.zone === "heroes")) {
    const options = [...state.window.options].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0));
    return { type: "Choose", optionId: options[0] ?? "" };
  }
  // A search for a Forest location (stage 2B): Goblin Trail, which the second stage cannot be defeated without.
  if (state.window?.kind === "choose" && state.window.options.length > 1) {
    const trail = state.window.options.find((id) => state.cards[id]?.code === "41014");
    if (trail) return { type: "Choose", optionId: trail };
  }
  // With the strong loadout no hero defends; the undefended damage goes on the least wounded hero.
  if (state.window?.kind === "defense") {
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const heroes = targets.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...(heroes.length > 0 ? heroes : targets)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  const engaging = engageOneEach(state, ctx);
  if (engaging) return engaging;
  // The Oath's Response: placed when the golden takes the token, passed when it declines.
  const refused = policy.tokens === "skip" && state.window?.kind === "response";
  const intents = legalIntents(state, ctx).filter((intent) => !(refused && intent.type === "Trigger" && intent.effectId === "41050:response:1"));
  return nextIntent(state, ctx, OATH_POLICY, memory, intents);
}

export type OathGame = PlayedGame;

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playOath(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, facts?: CampaignFacts, policy: OathPolicy = { tokens: "take" }, adaptations: Adaptations = DEFAULT_ADAPTATIONS, limit = 8000): OathGame {
  return game.play(seatCount, seed, difficulty, ctx, { facts, policy, choices: oathChoices(seatCount, adaptations), limit });
}

// The goldens (src/campaign/scenarios/the-oath/golden.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution; a loss writes
// nothing.
export type OathGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: OathDecks; outcome: "won" | "lost"; tokens?: "take" | "skip"; adaptations?: Adaptations; facts?: CampaignFacts; lossReason?: string };

const THREAT_LOST = "No seats remain";
// The Fervor of Lore was used in an earlier scenario of the campaign: the Campaign Log's `usedOnce` fact.
const FERVOR_USED: CampaignFacts = { prisoner: null, usedOnce: ["41044"], counters: {} };

export const OATH_GOLDENS: readonly OathGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, the Fervor of Lore already used, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", facts: FERVOR_USED },
  { name: "true solo, steady heroes, 6 tokens placed, won with Guilty Conscience", seatCount: 1, seed: 1, difficulty: "Normal", decks: "steady", outcome: "won" },
  { name: "true solo, steady heroes, tokens declined, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "steady", outcome: "won", tokens: "skip" },
  { name: "two-handed, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", adaptations: ["41046", "41047"] },
  { name: "two-handed, Easy, won", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "two-handed, steady heroes, 6 tokens placed, won with Guilty Conscience", seatCount: 2, seed: 3, difficulty: "Normal", decks: "steady", outcome: "won" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, steady heroes, lost", seatCount: 1, seed: 2, difficulty: "Normal", decks: "steady", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, steady heroes, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "steady", outcome: "lost", lossReason: THREAT_LOST },
];

export function playGolden(golden: OathGolden, ctx: ReduceContext): OathGame {
  return playOath(golden.seatCount, golden.seed, golden.difficulty, ctx, golden.facts, { tokens: golden.tokens ?? "take" }, golden.adaptations);
}
