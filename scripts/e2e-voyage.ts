// The Maestro fixtures of Voyage Across Belegaer (Dream-chaser part 1), written into src/campaign/fixtures/voyage-across-belegaer.json by scripts/e2e-fixtures.ts:
// real games of saved decklists (the Defenders of Gondor and Swords of the Noldor lists of data/decks/prebuilt.json) from the blank log a new `dream-chaser`
// playthrough starts on, so each is a real save. The Campaign Setup (a ship each, a Modification boon, the damage trade) is answered in the game by the auto-player.
// `sea-solo`: true solo, parked on the first Sailing test's commit. `sea-duo`: two-handed, parked on the first player's planning window of round 1.
// `voyage-won` and `voyage-lost`: two-handed, Easy, parked on the win (the Resolution waits) and on the loss. A game not found in the seeds is left out.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { contextOf, deal, resume } from "../src/campaign/session.ts";
import { newSave, type StoredLoadout } from "../src/campaign/save.ts";
import { loadWorld } from "../src/campaign/world.ts";
import { CATALOG_VERSION } from "../src/catalog/version.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { characters, legalAttackEnemies } from "../src/rules/combat/combat.ts";
import { askingToCommit } from "../src/rules/families/sea/sailing-legal.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/engine/reduce.ts";

import prebuilt from "../data/decks/prebuilt.json" with { type: "json" };
import { nextIntent } from "./auto-player.ts";
import { loadCampaign, loadScenario } from "./data/load-scenarios.ts";
import { createLog } from "./log.ts";
import { temporaryCatalog } from "./temp-catalog.ts";

const say = createLog("e2e-voyage");
const DECKS = ["defenders-of-gondor", "swords-of-the-noldor"] as const;
const CAMPAIGN = "dream-chaser";

export type VoyageFixture = { campaignId: string; seatCount: 1 | 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };
export type VoyageFixtureName = "sea-solo" | "sea-duo" | "voyage-won" | "voyage-lost";

function listed(id: string): { heroes: string[]; deck: string[] } {
  const found = prebuilt.find((entry) => entry.id === id);
  if (!found) throw new Error(`No prebuilt deck ${id}`);
  return { heroes: [...found.heroes], deck: found.cards.flatMap((row) => Array.from({ length: row.count }, () => row.code)) };
}

// The auto-player's answer with what the sea asks: the damage on a ship is kept, the ships sail and defend, damage the players assign falls on the least wounded hero,
// the heroes attack together, and the first stage offered is chosen.
function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose" && state.window.options.every((option) => option === "trade" || option === "keep")) return { type: "Choose", optionId: "keep" };
  if (state.window?.kind === "choose") {
    const heroes = state.window.options.filter((option) => state.cards[option]?.zone === "heroes");
    const least = [...heroes].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (least && heroes.length < state.window.options.length) return { type: "Choose", optionId: least };
  }
  if (askingToCommit(state)) {
    const ships = legalTargets(state, { type: "Commit" }, ctx).filter((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.ship === "objective");
    if (ships.length > 0) return { type: "Commit", cardIds: ships };
    return { type: "Pass" };
  }
  if (state.window?.kind === "defense") {
    const defenders = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const least = [...targets].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Corsair Pursuit (stage 3) when it is offered: the shortest road to the win.
  if (state.window?.kind === "choose") {
    const pursuit = state.window.options.find((option) => state.cards[option]?.code === "11021");
    if (pursuit) return { type: "Choose", optionId: pursuit };
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const reachable = (id: string) => legalAttackEnemies(state, seat, id, ctx.cards);
    const enemy = ready.flatMap(reachable)[0];
    const attackers = ready.filter((id) => enemy != null && reachable(id).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers };
  }
  if (state.window?.kind === "optionalEngage") {
    const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
    const seat = state.seats[state.activeSeat];
    if (enemy && seat && seat.engaged.length < 2) return { type: "Engage", enemyId: enemy };
    return { type: "DeclineEngage" };
  }
  return nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory, legalIntents(state, ctx));
}

type Game = { loadout: StoredLoadout; intents: PlayerIntent[]; state: ScenarioState };

// Plays seed `seed` until `stop` says so (checked before each intent), or the game ends.
function play(seatCount: 1 | 2, seed: number, stop: (state: ScenarioState, intents: number) => boolean): Game {
  const campaign = loadCampaign(CAMPAIGN);
  const scenario = loadScenario("voyage-across-belegaer");
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const seats = DECKS.slice(0, seatCount).map((id) => ({ deckId: id, ...listed(id) }));
  const loadout: StoredLoadout = { scenarioId: scenario.id, difficulty: "Easy", seats, ringBearer: null, choices: [], acceptPenalty: false };
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, seats.flatMap((seat) => [...seat.heroes, ...seat.deck]));
  const dealt = deal(newSave("fixture", campaign.id, seatCount), world, loadout, seed, CATALOG_VERSION);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  const ctx = contextOf(world);
  let state = resumed.state;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < 8000 && !state.lost && !state.stageCleared && !stop(state, intents.length); turn += 1) {
    const intent = intentFor(state, ctx, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  return { loadout, intents, state };
}

function firstSeed(seatCount: 1 | 2, stop: (state: ScenarioState, intents: number) => boolean, wanted: (state: ScenarioState) => boolean, label: string): VoyageFixture | null {
  const limit = Number(process.env.VOYAGE_SEEDS ?? 100);
  for (let seed = 1; seed <= limit; seed += 1) {
    const game = play(seatCount, seed, stop);
    say.debug(`seed ${seed}: ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : game.state.stageCleared ? "won" : "parked"}`);
    if (!wanted(game.state)) continue;
    say.info(`${label}: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : game.state.stageCleared ? "won" : "parked"}`);
    return { campaignId: CAMPAIGN, seatCount, loadout: game.loadout, seed, intents: game.intents };
  }
  say.warn(`no ${label} game found in ${limit} seeds`);
  return null;
}

const never = (): boolean => false;
const atCommit = (state: ScenarioState): boolean => askingToCommit(state);
const atPlanning = (state: ScenarioState): boolean => state.mode === "planning" && state.activeSeat === 0;

export function voyageFixtures(): Partial<Record<VoyageFixtureName, VoyageFixture>> {
  const solo = firstSeed(1, atCommit, (state) => !state.lost && !state.stageCleared && atCommit(state), "sea-solo");
  const duo = firstSeed(2, atPlanning, (state) => !state.lost && atPlanning(state), "sea-duo");
  const won = firstSeed(2, never, (state) => state.stageCleared && !state.lost, "voyage-won");
  const lost = firstSeed(2, never, (state) => state.lost, "voyage-lost");
  return { ...(solo ? { "sea-solo": solo } : {}), ...(duo ? { "sea-duo": duo } : {}), ...(won ? { "voyage-won": won } : {}), ...(lost ? { "voyage-lost": lost } : {}) };
}
