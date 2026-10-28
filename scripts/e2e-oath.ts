// The Maestro fixtures of The Oath (The Dark of Mirkwood part 1), written into src/campaign/fixtures/the-oath.json by scripts/e2e-fixtures.ts: two real
// games of saved decklists (the Defenders of Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, from the blank log a new
// `the-dark-of-mirkwood` playthrough starts on (tdom.mini-campaign), so each is a real save. Each seat chose an Adaptation at the Campaign Setup
// Checklist (the first seat's first hero carries The Fervor of Lore, the second seat's The Might of Tactics). Played by the auto-player, every intent one the
// reducer listed.
// `oath-won`: the first seed that wins and has used an Adaptation (so the Campaign Log shows what is used once), parked on the win (41050's Resolution asks
// nothing: 6 or more tokens on the campaign card earn Guilty Conscience). `oath-lost`: the first seed that loses, parked on the loss.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { type CampaignLog } from "../src/campaign/log.ts";
import { contextOf, deal, finish, resume } from "../src/campaign/session.ts";
import { newSave, type Save, type StoredLoadout } from "../src/campaign/save.ts";
import { loadWorld } from "../src/campaign/world.ts";
import { CATALOG_VERSION } from "../src/catalog/version.ts";
import { ENGINE_VERSION } from "../src/rules/version.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { characters, legalAttackEnemies } from "../src/rules/combat.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";

import prebuilt from "../data/decks/prebuilt.json" with { type: "json" };
import { nextIntent } from "./auto-player.ts";
import { loadCampaign, loadScenario } from "./data/load-scenarios.ts";
import { createLog } from "./log.ts";
import { temporaryCatalog } from "./temp-catalog.ts";

const say = createLog("e2e-oath");
const DECKS = ["defenders-of-gondor", "swords-of-the-noldor"] as const;
const ADAPTATIONS = ["41044", "41045"] as const;

// The log The Oath's won game writes: replay the fixture and confirm it (6 or more tokens earn Guilty Conscience; the Adaptations and Stalking Goblin join the pool).
export function oathWonLog(won: OathFixture): CampaignLog {
  const scenario = loadScenario("the-oath");
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const codes = [...won.loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...ADAPTATIONS];
  const world = loadWorld(catalog, loadCampaign(won.campaignId), scenario, EFFECTS, codes);
  const save: Save = { ...newSave("fixture", won.campaignId, 2), loadout: won.loadout, active: { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, seed: won.seed, intents: [...won.intents] } };
  const resumed = resume(save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  if (!resumed.state.stageCleared || resumed.state.lost) throw new Error("The oath-won fixture does not replay to a win");
  return finish(save, world, resumed.state).log;
}

export type OathFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };

function listed(id: string): { heroes: string[]; deck: string[] } {
  const found = prebuilt.find((entry) => entry.id === id);
  if (!found) throw new Error(`No prebuilt deck ${id}`);
  return { heroes: [...found.heroes], deck: found.cards.flatMap((row) => Array.from({ length: row.count }, () => row.code)) };
}

// The auto-player's answer, with what the scenario asks of the players: the second stage's search takes Goblin Trail (the stage cannot be defeated without
// it), a hero stays home to attack and one defends, and every ready character attacks the first enemy it can reach (Goblin Troop must be defeated).
function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose" && state.window.options.length > 1) {
    const trail = state.window.options.find((id) => state.cards[id]?.code === "41014");
    if (trail) return { type: "Choose", optionId: trail };
    if (state.window.options.every((id) => state.cards[id]?.zone === "heroes")) {
      const options = [...state.window.options].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0));
      return { type: "Choose", optionId: options[0] ?? "" };
    }
  }
  if (state.window?.kind === "defense") {
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx);
    const strongest = [...defenders].sort((a, b) => (ctx.cards.get(state.cards[b]?.code ?? "")?.defense ?? 0) - (ctx.cards.get(state.cards[a]?.code ?? "")?.defense ?? 0))[0];
    if (strongest && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender")) return { type: "DeclareDefender", defenderId: strongest };
    const left = (id: string): number => (ctx.cards.get(state.cards[id]?.code ?? "")?.health ?? 0) - (state.cards[id]?.damage ?? 0);
    const heroes = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((a, b) => left(b) - left(a));
    if (heroes[0]) return { type: "Undefended", heroId: heroes[0] };
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const enemy = ready.map((id) => legalAttackEnemies(state, seat, id, ctx.cards)[0]).find((id) => id != null);
    const attackers = ready.filter((id) => enemy != null && legalAttackEnemies(state, seat, id, ctx.cards).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
    if (enemy && seat && seat.engaged.length < 3) return { type: "Engage", enemyId: enemy };
  }
  // Each seat keeps its last hero out of the quest, ready to attack.
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => state.cards[id]?.zone === "heroes");
    const home = heroes.length > 1 ? heroes.at(-1) : undefined;
    const questers = ids.filter((id) => id !== home);
    if (questers.length > 0) return { type: "Commit", cardIds: questers };
  }
  return nextIntent(state, ctx, { scout: "", prefer: "41014", protect: "", play: true, act: true }, memory);
}

function play(seed: number): { loadout: StoredLoadout; intents: PlayerIntent[]; state: ScenarioState } {
  const campaign = loadCampaign("the-dark-of-mirkwood");
  const scenario = loadScenario("the-oath");
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const seats = DECKS.map((id) => ({ deckId: id, ...listed(id) }));
  // Each seat's Adaptation goes on its first hero (the answers to the campaign card's Setup choices, in seat order).
  const choices = seats.map((seat, index) => `${ADAPTATIONS[index]}>${seat.heroes[0]}`);
  const loadout: StoredLoadout = { scenarioId: scenario.id, difficulty: "Easy", seats, ringBearer: null, choices, acceptPenalty: false };
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, [...seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...ADAPTATIONS]);
  const dealt = deal(newSave("fixture", campaign.id, 2), world, loadout, seed, CATALOG_VERSION);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  const ctx = contextOf(world);
  let state = resumed.state;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < 8000 && !state.lost && !state.stageCleared; turn += 1) {
    const intent = intentFor(state, ctx, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  return { loadout, intents, state };
}

function firstSeed(wanted: (state: ScenarioState) => boolean, label: string): OathFixture | null {
  const limit = Number(process.env.OATH_SEEDS ?? 200);
  for (let seed = 1; seed <= limit; seed += 1) {
    const game = play(seed);
    say.debug(`seed ${seed}: ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : game.state.stageCleared ? "won" : "stalled"}`);
    if (!wanted(game.state)) continue;
    say.info(`${label}: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : "won"}, used ${JSON.stringify(game.state.campaignFacts?.usedOnce ?? [])}`);
    return { campaignId: "the-dark-of-mirkwood", seatCount: 2, loadout: game.loadout, seed, intents: game.intents };
  }
  say.warn(`no ${label} game found in ${limit} seeds`);
  return null;
}

export function oathFixtures(): Partial<Record<"oath-won" | "oath-lost", OathFixture>> {
  const won = firstSeed((state) => state.stageCleared && !state.lost && (state.campaignFacts?.usedOnce.length ?? 0) > 0, "oath-won") ?? firstSeed((state) => state.stageCleared && !state.lost, "oath-won");
  const lost = firstSeed((state) => state.lost, "oath-lost");
  return { ...(won ? { "oath-won": won } : {}), ...(lost ? { "oath-lost": lost } : {}) };
}
