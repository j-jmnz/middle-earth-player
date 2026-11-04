import { checklist } from "../../../src/campaign/checklist.ts";
import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { buildStart } from "../../../src/campaign/start.ts";
import { scenarioCards, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { CampaignFacts } from "../../../src/rules/core/campaign-state.ts";
import { characters, legalAttackEnemies } from "../../../src/rules/combat/combat.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { caves, campaign, CHIEFTAIN, NO_TIME, PILLAR, RANGER_SENSE } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { FILLER, fillerCard, fillerLoadout, type PlayedGame, playToEnd } from "../../harness/game-kit.ts";

// Test helper. A whole game of The Caves of Nibin-Dûm in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too
// small to quest, or too brittle to survive an attack), and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on
// player card play. Each seat is dealt a "No Time to Waste!" after its mulligan (the campaign card's Setup), Shiny Distraction is shuffled into the encounter deck,
// and the Cave Torch is attached to a hero by the first quest card's Setup. The policy wears Cracked Pillar down in the combat phase and travels to it (stage 3),
// keeps the Goblin Chieftain from taking progress off the quest, and kills it once stage 4 holds 8 progress.
export const HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const CAVES_POLICY: PolicyOptions = { scout: "", prefer: PILLAR, protect: "", play: true, act: true };
// "strong": big-number heroes. "steady": heroes that quest for little, so the scenario takes many rounds. "weak": heroes too small to quest, so the
// players lose on threat. "brittle": strong quest and attack with a few hit points and no Defense, so an enemy's attack destroys a hero.
// "tense": strong heroes that start the game with a high threat (42), so a win ends with 40 or more.
export type CavesDecks = "strong" | "steady" | "weak" | "brittle" | "tense";

export const cavesLoadout = fillerLoadout;

const WEAK_STATS = { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 } as const;
const STRONG_STATS = { threat: 3, willpower: 20, attack: 12, defense: 6, health: 100 } as const;
const STEADY_STATS = { threat: 3, willpower: 6, attack: 12, defense: 6, health: 100 } as const;
const BRITTLE_STATS = { threat: 3, willpower: 20, attack: 12, defense: 0, health: 7 } as const;
const TENSE_STATS = { threat: 14, willpower: 20, attack: 12, defense: 6, health: 100 } as const;
const STATS = { strong: STRONG_STATS, steady: STEADY_STATS, weak: WEAK_STATS, brittle: BRITTLE_STATS, tense: TENSE_STATS } as const;

export async function cavesWorld(decks: CavesDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const codes = [...scenarioCards(caves).map((card) => card.code), ...caves.campaignPlaced, caves.campaignCard, RANGER_SENSE];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...STATS[decks] }));
  cards.set(FILLER, fillerCard());
  LOADED = cards;
  return { cards, ctx: { effects: EFFECTS, cards } };
}

// The cards of the last world built: the checklist reads the pool cards' printed data.
let LOADED: ReadonlyMap<string, PrintedCard> | null = null;

// The scenario dealt through the Campaign Setup Checklist: each seat's "No Time to Waste!" is added after its mulligan, Shiny Distraction joins the encounter deck,
// and the pool a log carries is dealt with it.
export function cavesPlan(seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) {
  if (!LOADED) throw new Error("Build the world first (cavesWorld)");
  const plan = checklist({ log, scenario: caves, seats: cavesLoadout(seatCount), effects: EFFECTS, cards: LOADED });
  if (!plan.ok) throw new Error(plan.errors.join("; ") || "The campaign card asks for a choice");
  return plan;
}

export function cavesStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: CampaignFacts, log: CampaignLog = emptyLog(seatCount)): StartScenario {
  const plan = cavesPlan(seatCount, log);
  return buildStart({
    campaign,
    scenario: caves,
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

// The auto-player's answer (test/harness/auto-player.ts), except where the auto-player alone always declines: in a player attack window every ready character that
// can attack the target attacks together (Cracked Pillar until it holds 4 damage on stage 3, else the first enemy it can reach), and in the optional engagement
// step the seat engages one enemy at a time. Every intent is one the reducer listed.
// `boon: "play"`: each seat plays its "No Time to Waste!" in the quest phase, before it commits (the first Action offered: threat down by 3, a card revealed, the card
// gone from the game and the Campaign Pool); `"keep"`: it stays in hand.
export type CavesPolicy = { boon: "play" | "keep" };

export function cavesIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: CavesPolicy = { boon: "keep" }): PlayerIntent {
  if (policy.boon === "play" && state.mode === "questCommit" && state.window?.kind === "pass") {
    const play = legalIntents(state, ctx).find((intent) => intent.type === "PlayCard" && state.cards[intent.cardId]?.code === NO_TIME);
    if (play?.type === "PlayCard") return { type: "PlayCard", cardId: play.cardId, payments: [] };
  }
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
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const reachable = (id: string) => legalAttackEnemies(state, seat, id, ctx.cards);
    const pillar = Object.values(state.cards).find((card) => card.code === PILLAR && card.zone === "staging");
    const wearDown = pillar != null && pillar.damage < 4 && ready.some((id) => reachable(id).includes(pillar.id));
    // Goblin Chieftain, once it can take damage, comes first.
    const chieftain = Object.values(state.cards).find((card) => card.code === CHIEFTAIN && card.zone === "engaged" && ready.some((id) => reachable(id).includes(card.id)));
    const killable = chieftain != null && (state.cards[state.questStage ?? ""]?.progress ?? 0) >= 8;
    const enemy = wearDown ? pillar.id : killable ? chieftain.id : ready.map((id) => reachable(id).find((target) => target !== pillar?.id))?.find((id) => id != null);
    const attackers = ready.filter((id) => enemy != null && reachable(id).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers };
  }
  // A choice among heroes (the hero the Cave Torch goes to, a hero a card picks): the least wounded one.
  if (state.window?.kind === "choose" && state.window.options.length > 1 && state.window.options.every((id) => state.cards[id]?.zone === "heroes")) {
    const options = [...state.window.options].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0));
    return { type: "Choose", optionId: options[0] ?? "" };
  }
  // The Goblin Chieftain's Forced effect: it stays engaged, to be killed in the player attack step, when the stage keeps 8 progress after X come off; else it goes
  // back to the staging area.
  if (state.window?.kind === "choose" && state.window.options.includes("staging") && state.window.options.includes("progress")) {
    const stage = state.cards[state.questStage ?? ""];
    return { type: "Choose", optionId: (stage?.progress ?? 0) - 4 >= 8 ? "progress" : "staging" };
  }
  // "No Time to Waste!": the second Action only draws; the policy lowers threat when it is offered the choice.
  // With the strong loadout no hero defends; the undefended damage goes on the least wounded hero.
  if (state.window?.kind === "defense") {
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const heroes = targets.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...(heroes.length > 0 ? heroes : targets)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const targets = legalTargets(state, { type: "Engage" }, ctx);
    // The Goblin Chieftain is engaged once the stage holds 8 progress, so it can be killed.
    const chieftain = targets.find((id) => state.cards[id]?.code === CHIEFTAIN);
    if (chieftain && (state.cards[state.questStage ?? ""]?.progress ?? 0) >= 8) return { type: "Engage", enemyId: chieftain };
    const enemy = targets.find((id) => state.cards[id]?.code !== CHIEFTAIN);
    if (enemy && seat && seat.engaged.length < seat.heroes.length) return { type: "Engage", enemyId: enemy };
  }
  return nextIntent(state, ctx, CAVES_POLICY, memory, legalIntents(state, ctx));
}

export type CavesGame = PlayedGame;

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playCaves(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, facts?: CampaignFacts, log: CampaignLog = emptyLog(seatCount), policy: CavesPolicy = { boon: "keep" }, limit = 8000): CavesGame {
  const start = cavesStart(seatCount, seed, difficulty, facts, log);
  return playToEnd(start, ctx, (state, memory) => cavesIntent(state, ctx, memory, policy), limit);
}

// The goldens (src/campaign/scenarios/the-caves-of-nibin-dum/golden.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution; a loss writes nothing.
export type CavesGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: CavesDecks; outcome: "won" | "lost"; boon?: "play" | "keep"; facts?: CampaignFacts; lossReason?: string };

const THREAT_LOST = "No seats remain";

export const CAVES_GOLDENS: readonly CavesGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, \"No Time to Waste!\" played, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", boon: "play" },
  { name: "true solo, threat 40 or higher at the end, won", seatCount: 1, seed: 2, difficulty: "Normal", decks: "tense", outcome: "won" },
  { name: "two-handed, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, Easy, \"No Time to Waste!\" played, won", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", boon: "play" },
  { name: "two-handed, threat 40 or higher at the end, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "tense", outcome: "won" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, steady heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "steady", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, steady heroes, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "steady", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
];

export function playGolden(golden: CavesGolden, ctx: ReduceContext): CavesGame {
  return playCaves(golden.seatCount, golden.seed, golden.difficulty, ctx, golden.facts, undefined, { boon: golden.boon ?? "keep" });
}

export { CHIEFTAIN };
