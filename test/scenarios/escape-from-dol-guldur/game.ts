import { checklist } from "../../../src/campaign/checklist.ts";
import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { buildStart } from "../../../src/campaign/start.ts";
import { scenarioCards, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { CampaignFacts } from "../../../src/rules/core/campaign-state.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { dolGuldur, campaign } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { attackTogether, engageOneEach, FILLER, fillerCard, fillerLoadout, type PlayedGame, playToEnd, STRONG_HEROES } from "../../harness/game-kit.ts";

// Test helper. A whole game of Escape from Dol Guldur in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big
// numbers (or too small to quest), and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on
// player card play. Mendor is put into play by the campaign card's Setup; Appointed by Fate is attached to a hero of the first player's choice
// by the checklist (here: the first seat's first hero); no saga setup runs.
export { STRONG_HEROES };
export const DOL_GULDUR_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: true, act: true };
// "strong": big-number heroes. "weak": heroes too small to quest, so the players lose on threat. "brittle": strong quest and attack with 3 hit points
// and no Defense, so an enemy's attack destroys a hero.
export type DolGuldurDecks = "strong" | "weak" | "brittle";

export const dolGuldurLoadout = fillerLoadout;

const WEAK_STATS = { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 } as const;
const STRONG_STATS = { threat: 3, willpower: 20, attack: 12, defense: 6, health: 100 } as const;
const BRITTLE_STATS = { threat: 3, willpower: 20, attack: 12, defense: 0, health: 7 } as const;

export async function dolGuldurWorld(decks: DolGuldurDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const codes = [...scenarioCards(dolGuldur).map((card) => card.code), ...dolGuldur.campaignPlaced, dolGuldur.campaignCard, "01133", "01138"];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of STRONG_HEROES) {
    cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...(decks === "weak" ? WEAK_STATS : decks === "brittle" ? BRITTLE_STATS : STRONG_STATS) }));
  }
  cards.set(FILLER, fillerCard());
  LOADED = cards;
  return { cards, ctx: { effects: EFFECTS, cards } };
}

// The prisoner the Campaign Log names (Journey Along the Anduin's Resolution), when the game has one: a hero of the first seat.
export const LOGGED_PRISONER: CampaignFacts = { prisoner: "q2", usedOnce: [], counters: {} };

// The cards of the last world built: the checklist reads the pool cards' printed data.
let LOADED: ReadonlyMap<string, PrintedCard> | null = null;

// The scenario dealt through the Campaign Setup Checklist: the first player attaches Appointed by Fate (01131:A:2) to the first seat's first hero
// (q1), and the pool a log carries (a log of Journey Along the Anduin's win) is dealt with it.
export function dolGuldurStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: CampaignFacts, log: CampaignLog = emptyLog(seatCount)): StartScenario {
  if (!LOADED) throw new Error("Build the world first (dolGuldurWorld)");
  const plan = checklist({ log, scenario: dolGuldur, seats: dolGuldurLoadout(seatCount), effects: EFFECTS, cards: LOADED, choices: ["01134>q1"] });
  if (!plan.ok) throw new Error(plan.errors.join("; ") || "The campaign card asks for a choice");
  return buildStart({
    campaign,
    scenario: dolGuldur,
    seatCount,
    seed,
    threatModifier: plan.threatModifier,
    seats: plan.seats,
    effects: EFFECTS,
    difficulty,
    poolEncounterCards: plan.poolEncounterCards,
    poolIntoPlay: plan.poolIntoPlay,
    ...(facts ? { facts } : {}),
  });
}

// The auto-player's answer (test/harness/auto-player.ts), except where the auto-player alone always declines: in a player attack window
// every ready character that can attack the first enemy it can reach attacks it together, and in the optional engagement step the
// seat engages one enemy at a time. Every intent is one the reducer listed.
export function dolGuldurIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    // With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack (the prisoner is not among them).
    const heroes = ids.filter((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-2) : heroes.length === 2 ? heroes.slice(-1) : [];
      const questers = ids.filter((id) => !home.includes(id));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  // A choice among heroes (the host of a claimed objective, the hero a card picks): the hero with the fewest attachments, so the Restricted
  // objectives are shared out (a hero holds two).
  if (state.window?.kind === "choose" && state.window.options.length > 1 && state.window.options.every((id) => state.cards[id]?.zone === "heroes")) {
    const options = [...state.window.options].sort((left, right) => (state.cards[left]?.attachments.length ?? 0) - (state.cards[right]?.attachments.length ?? 0));
    return { type: "Choose", optionId: options[0] ?? "" };
  }
  // With the strong loadout no hero defends; the undefended damage goes on the least wounded hero.
  if (state.window?.kind === "defense") {
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const heroes = targets.filter((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...(heroes.length > 0 ? heroes : targets)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  const engaging = engageOneEach(state, ctx);
  if (engaging) return engaging;
  // Dungeon Torch raises its hero's controller's threat by 2 every round: the players claim it last, once the prisoner is rescued.
  const stage = state.cards[state.questStage ?? ""]?.code;
  const wait = stage === "01123" || Object.values(state.cards).some((card) => card.zone === "captive" && card.prisoner === true && card.host == null);
  const intents = legalIntents(state, ctx).filter((intent) => !(wait && intent.type === "Trigger" && intent.effectId === "01109:action:1"));
  return nextIntent(state, ctx, DOL_GULDUR_POLICY, memory, intents);
}

export type DolGuldurGame = PlayedGame;

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playDolGuldur(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, facts?: CampaignFacts, limit = 8000): DolGuldurGame {
  const start = dolGuldurStart(seatCount, seed, difficulty, facts);
  return playToEnd(start, ctx, (state, memory) => dolGuldurIntent(state, ctx, memory), limit);
}

// The goldens (src/campaign/scenarios/escape-from-dol-guldur/golden.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution;
// a loss writes nothing.
export type DolGuldurGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DolGuldurDecks; outcome: "won" | "lost"; facts?: CampaignFacts; lossReason?: string };

const THREAT_LOST = "No seats remain";

export const DOL_GULDUR_GOLDENS: readonly DolGuldurGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, the Campaign Log's prisoner, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", facts: LOGGED_PRISONER },
  { name: "true solo, Mendor lost, won", seatCount: 1, seed: 13, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, brittle heroes, won", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "won" },
  { name: "two-handed, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, Easy, won", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "two-handed, the Campaign Log's prisoner, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", facts: LOGGED_PRISONER },
  { name: "two-handed, brittle heroes, Mendor lost, won", seatCount: 2, seed: 12, difficulty: "Normal", decks: "brittle", outcome: "won" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, brittle heroes, lost", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
];

export function playGolden(golden: DolGuldurGolden, ctx: ReduceContext): DolGuldurGame {
  return playDolGuldur(golden.seatCount, golden.seed, golden.difficulty, ctx, golden.facts);
}
