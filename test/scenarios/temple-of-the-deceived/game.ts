import { checklist } from "../../../src/campaign/checklist.ts";
import { emptyLog, poolCard, type CampaignLog } from "../../../src/campaign/log.ts";
import { buildStart } from "../../../src/campaign/start.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { characters, legalAttackEnemies } from "../../../src/rules/combat/combat.ts";
import { expectOk } from "../../../src/rules/core/test-fixture.ts";
import { cellOf } from "../../../src/rules/families/island/map.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { campaign, CODES, temple } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { gameCodes } from "../../../scripts/data/load-scenarios.ts";

// Test helper. A whole game of Temple of the Deceived in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an
// attack) and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to the nearest Cursed Temple, where Temple Guardian
// engages them and its Gate Key falls free; they claim the key, travel to the Temple column (the Gate Key pays for it), and put the progress on The Grotto's Entrance. They engage and attack whatever the engine
// lets them, answer the choices with the first option, and let the first hero defend.
export const HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const TEMPLE_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type TempleDecks = "strong" | "weak" | "brittle";

export function templeLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const filler = Array.from({ length: 30 }, () => "filler");
  const first = { heroes: ["q1", "q2", "q3"], deck: filler };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck: filler }];
}

const STATS = {
  strong: { threat: 3, willpower: 20, attack: 12, defense: 6, health: 100 },
  weak: { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 },
  brittle: { threat: 3, willpower: 20, attack: 12, defense: 0, health: 7 },
} as const;

let LOADED: ReadonlyMap<string, PrintedCard> | null = null;

export async function templeWorld(decks: TempleDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const dealt = campaignScenario(temple);
  const codes = [...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, temple), ...temple.cards.map((card) => card.code), CODES.ominousFate, CODES.sahirAlly, CODES.naasiyahAlly, CODES.guardianOriginal, CODES.gateKeyOriginal];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...STATS[decks] }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  LOADED = cards;
  return { cards, ctx: { effects: EFFECTS, cards } };
}

/** The log of a campaign whose first five parts were won: Ominous Fate in the pool and the XP they gained, marked on a Galdor's Counsel and the Dream-chaser. */
export function afterDepths(seatCount: 1 | 2): CampaignLog {
  if (!LOADED) throw new Error("Build the world first (templeWorld)");
  const base = emptyLog(seatCount);
  return {
    ...base,
    completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller", "the-thing-in-the-depths"],
    campaignPool: [poolCard(LOADED.get(CODES.ominousFate)!, CODES.ominousFate, null, null)],
    xpGained: { "voyage-across-belegaer": 4, "the-fate-of-numenor": 3, "raid-on-the-grey-havens": 5, "flight-of-the-stormcaller": 4, "the-thing-in-the-depths": 4 },
    marks: { "11080": 1, "11172": 2, "11184": 3, "11198": 2 },
  };
}

export function templePlan(seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices?: readonly string[]) {
  if (!LOADED) throw new Error("Build the world first (templeWorld)");
  const plan = checklist({ log, scenario: campaignScenario(temple), seats: templeLoadout(seatCount), effects: EFFECTS, cards: LOADED, ...(choices ? { choices } : {}) });
  if (!plan.ok) throw new Error(plan.errors.join("; ") || "The campaign card asks for a choice");
  return plan;
}

export function templeStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard): StartScenario {
  const plan = templePlan(seatCount, log);
  return buildStart({
    campaign,
    scenario: temple,
    seatCount,
    seed,
    threatModifier: plan.threatModifier,
    seats: plan.seats,
    effects: EFFECTS,
    difficulty,
    poolEncounterCards: plan.poolEncounterCards,
    poolIntoPlay: plan.poolIntoPlay,
    ...(facts ? { facts } : {}),
    ...(modeCard ? { modeCard } : {}),
  });
}

export type TemplePolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The players flip the secret under the active Temple location when they can.
  secrets: boolean;
  // The objective ally who defends every attack, when able (the game is lost if he or she leaves play, 11077:A:4, 11079:A:4).
  defender?: "sahir" | "naasiyah";
};
export const DEFAULT_POLICY: TemplePolicy = { choose: "first", secrets: false };

const nameOf = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";

/** The Gate Key is claimed by a hero. */
export function keyClaimed(state: ScenarioState): boolean {
  return Object.values(state.cards).some((card) => card.code === CODES.gateKey && card.claimed === true && card.host != null && state.cards[card.host]?.zone === "heroes");
}

// Where the players could travel from a location of the map, read from the codes the cards really are (the policy peeks at the facedown sides, as a test may): the locations next to it, less the one Jagged Cliffs
// shuts out on its right and the two Jungle Path shuts out above and below, and what Winding Caverns reaches within 3.
function movesFrom(state: ScenarioState, id: string): readonly string[] {
  const island = state.uncharted?.island;
  const here = island ? cellOf(island, id) : null;
  if (!island || !here) return [];
  const at = (row: number, col: number): string | null => (row < 0 || row > 2 || col < 0 || col > 4 ? null : (island.cells[row * 5 + col] ?? null));
  const code = state.cards[id]?.code;
  if (code === CODES.windingCaverns) return island.cells.filter((other) => { const there = cellOf(island, other); return other !== id && there != null && Math.abs(there.row - here.row) + Math.abs(there.col - here.col) <= 3; });
  const next = [at(here.row - 1, here.col), at(here.row, here.col - 1), at(here.row, here.col + 1), at(here.row + 1, here.col)];
  const shut = code === CODES.jaggedCliffs ? [at(here.row, here.col + 1)] : code === CODES.junglePath ? [at(here.row - 1, here.col), at(here.row + 1, here.col)] : [];
  return next.filter((other): other is string => other != null && !shut.includes(other));
}

/** The location the players travel to: the first step of the shortest way to the nearest Cursed Temple while Temple Guardian guards the key, then to The Grotto's Entrance (the Temple column is paid with the Gate Key). */
export function templeTravel(state: ScenarioState, targets: readonly string[]): string | undefined {
  const island = state.uncharted?.island;
  const from = state.activeLocation;
  if (!island || !from) return targets[0];
  const goals = new Set(island.cells.filter((id) => state.cards[id]?.code === (keyClaimed(state) ? CODES.grotto : CODES.cursedTemple)));
  // A breadth-first search over the moves; the first step of each path is what is kept.
  const first = new Map<string, string>();
  const queue: string[] = [from];
  const seen = new Set<string>([from]);
  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    for (const next of movesFrom(state, current)) {
      if (seen.has(next)) continue;
      seen.add(next);
      first.set(next, current === from ? next : (first.get(current) ?? next));
      if (goals.has(next)) return targets.includes(first.get(next) ?? "") ? first.get(next) : targets[0];
      queue.push(next);
    }
  }
  return targets[0];
}

// The auto-player's answer (test/harness/auto-player.ts), except: the heroes of a seat that has three quest together, the last one staying out when the table has the strength; the players travel as templeTravel
// says; they claim the Gate Key when it is free; defense falls to the strongest hero; a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function templeIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: TemplePolicy = DEFAULT_POLICY): PlayerIntent {
  // A choice among cards (the location a progress goes on, the hero a Spyglass is attached to) takes the first card; any other takes the first option, or the last as the policy says.
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    const cardsOnly = options.filter((option) => state.cards[option] != null);
    if (policy.choose === "last") return { type: "Choose", optionId: options.at(-1) ?? "" };
    return { type: "Choose", optionId: cardsOnly[0] ?? options[0] ?? "" };
  }
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-1) : [];
      // The objective allies stay home with the last hero: they attack, and the last ready character is the one a Forced effect exhausts.
      const questers = ids.filter((id) => !home.includes(id) && HEROES.includes(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "travel" && intents.some((intent) => intent.type === "Travel")) {
    const pick = templeTravel(state, legalTargets(state, { type: "Travel" }, ctx));
    if (pick) return { type: "Travel", locationId: pick };
  }
  // The Gate Key falls free when its guard is destroyed: a hero claims it (110078:A:1).
  const action = (pattern: RegExp): PlayerIntent | undefined => {
    const found = intents.find((intent) => intent.type === "Trigger" && pattern.test(intent.effectId));
    return found?.type === "Trigger" ? { type: "Trigger", cardId: found.cardId, effectId: found.effectId } : undefined;
  };
  const claim = action(/^110078:action:[13]$/);
  if (claim && !keyClaimed(state)) return claim;
  const flip = policy.secrets ? action(/^11197:action:1$/) : undefined;
  if (flip) return flip;
  if (state.window?.kind === "playerAttack" && intents.some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const reachable = (id: string) => legalAttackEnemies(state, seat, id, ctx.cards);
    const enemy = ready.flatMap(reachable)[0];
    const attackers = ready.filter((id) => enemy != null && reachable(id).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers };
  }
  // The objective ally the policy sends to defend, when able.
  if (state.window?.kind === "defense" && policy.defender) {
    const wanted = policy.defender === "sahir" ? CODES.sahirAlly : CODES.naasiyahAlly;
    const defender = legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => state.cards[id]?.code === wanted);
    if (defender) return { type: "DeclareDefender", defenderId: defender };
  }
  // Nobody defends: the home hero stays ready to attack, and the heroes have the hit points to take what comes undefended.
  if (state.window?.kind === "defense") {
    const target = legalTargets(state, { type: "Undefended" }, ctx)[0];
    if (target) return { type: "Undefended", heroId: target };
  }
  if (state.window?.kind === "optionalEngage") {
    const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
    const seat = state.seats[state.activeSeat];
    if (enemy && seat && seat.engaged.length < 2) return { type: "Engage", enemyId: enemy };
  }
  void nameOf;
  return nextIntent(state, ctx, TEMPLE_POLICY, memory, intents);
}

export type TempleGame = { start: StartScenario; kept: ScenarioState; state: ScenarioState; intents: PlayerIntent[]; steps: EngineStep[] };

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playTemple(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), policy: TemplePolicy = DEFAULT_POLICY, modeCard?: ModeCard, limit = 6000): TempleGame {
  const start = templeStart(seatCount, seed, difficulty, facts, log, modeCard);
  const opened = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx));
  const kept = opened.state;
  const steps: EngineStep[] = [...opened.steps];
  let state = kept;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const intent = templeIntent(state, ctx, memory, policy);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
  }
  return { start, kept, state, intents, steps };
}

// The goldens (src/campaign/scenarios/temple-of-the-deceived/golden.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution and awards its XP; a loss writes nothing.
// `after`: the log of a campaign whose first five parts were won (the pool, XP and marks reach this part). `upgraded`: the Upgraded sides (Black Key, Gate Key). `mode`: the Hard or Expert Mode card.
export type TempleGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: TempleDecks; outcome: "won" | "lost"; policy?: Partial<TemplePolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

export const UPGRADED_CODES = [CODES.blackKey, CODES.gateKey];
const THREAT_LOST = "No seats remain";

const SAHIR_LOST = "Captain Sahír left play";
const NAASIYAH_LOST = "Na'asiyah left play";

export const TEMPLE_GOLDENS: readonly TempleGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 6, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, after Thing in the Depths, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, the last option of each choice, won", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last" } },
  { name: "true solo, the secrets flipped, won", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { secrets: true } },
  { name: "true solo, Hard Mode card, won", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", mode: "hard" },
  { name: "true solo, Upgraded Black Key and Gate Key, won", seatCount: 1, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won", upgraded: true },
  { name: "two-handed, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, the secrets flipped, won", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: { secrets: true } },
  { name: "two-handed, Easy, after Thing in the Depths, won", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, Expert Mode card, Upgraded Black Key and Gate Key, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", mode: "expert", upgraded: true },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, Captain Sahír destroyed, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { defender: "sahir" }, lossReason: SAHIR_LOST },
  { name: "true solo, Easy, Na'asiyah destroyed, lost", seatCount: 1, seed: 6, difficulty: "Easy", decks: "strong", outcome: "lost", policy: { defender: "naasiyah" }, lossReason: NAASIYAH_LOST },
  { name: "two-handed, Captain Sahír destroyed, lost", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { defender: "sahir" }, lossReason: SAHIR_LOST },
  { name: "two-handed, Na'asiyah destroyed, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { defender: "naasiyah" }, lossReason: NAASIYAH_LOST },
];

export function playGolden(golden: TempleGolden, ctx: ReduceContext): TempleGame {
  const facts = golden.upgraded ? { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES } : golden.after ? { prisoner: null, usedOnce: [], counters: {}, levels: { [CODES.starla]: 2 } } : undefined;
  const log = golden.after ? afterDepths(golden.seatCount) : undefined;
  return playTemple(golden.seatCount, golden.seed, golden.difficulty, ctx, facts, log, { ...DEFAULT_POLICY, ...golden.policy }, golden.mode);
}
export { NAASIYAH_LOST, SAHIR_LOST, THREAT_LOST };
