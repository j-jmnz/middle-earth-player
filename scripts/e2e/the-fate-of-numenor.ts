// The Maestro fixtures of The Fate of Númenor (Dream-chaser part 2), written into src/campaign/fixtures/the-fate-of-numenor.json by scripts/e2e/fixtures.ts: real games of saved decklists (the
// Defenders of Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `fate-won` is the first seed that wins, parked on the win (the
// Resolution waits); `fate-lost` the first that loses, parked on the loss. A game not found in the seeds is left out.
// The log has part 1 recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it (a blank log keeps the Fate locked and the path opens Voyage Across
// Belegaer): it is the log the won game of Voyage Across Belegaer's golden writes (src/campaign/scenarios/voyage-across-belegaer/golden.test.ts, "two-handed, won"), run through the same `applyResolution` that
// writes it in the app, with the golden's plain-number heroes taken out (the fixture's seats play real decklists). `voyage-won`, a real-decklist win, is open (docs/phases/STATUS.md).
// The Campaign Setup (damage traded for threat) is answered in the game by the auto-player: no damage is traded.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { applyResolution, emptyLog, type CampaignLog } from "../../src/campaign/log.ts";
import { newSave, type StoredLoadout } from "../../src/campaign/save.ts";
import { loadWorld, logCodes } from "../../src/campaign/world.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { loadCampaign, loadScenario } from "../data/load-scenarios.ts";
import { createLog } from "../log.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import { VOYAGE_GOLDENS, playGolden as playVoyage, voyageWorld } from "../../test/scenarios/voyage-across-belegaer/game.ts";
import { playDealt, prebuiltDeck } from "./seed-kit.ts";
import { attackTogether, engageOneEach } from "../../test/harness/game-kit.ts";

const say = createLog("e2e-fate");
const DECKS = ["defenders-of-gondor", "swords-of-the-noldor"] as const;
const CAMPAIGN = "dream-chaser";

export type FateFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type FateFixtureName = "fate-won" | "fate-lost";

// The log of a playthrough whose first part was won: the Voyage golden's two-handed win resolved onto a new log, its heroes and what hangs on them left out.
async function voyageWonLog(): Promise<CampaignLog> {
  const golden = VOYAGE_GOLDENS.find((item) => item.name === "two-handed, won");
  if (!golden) throw new Error("The Voyage golden \"two-handed, won\" is gone");
  const world = await voyageWorld(golden.decks);
  const game = playVoyage(golden, world.ctx);
  if (!game.state.stageCleared || game.state.lost) throw new Error("The Voyage golden no longer wins");
  const written = applyResolution(emptyLog(2), game.state.scenarioId, game.state, world.cards);
  const blank = emptyLog(2);
  return { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) };
}

// The auto-player's answer with what the scenario asks: no damage is traded for threat, damage the players assign falls on the least wounded hero, the heroes attack together, and the
// first location the travel phase offers is travelled to.
function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose" && state.window.options.every((option) => option === "trade" || option === "keep")) return { type: "Choose", optionId: "keep" };
  if (state.window?.kind === "choose") {
    const heroes = state.window.options.filter((option) => state.cards[option]?.zone === "heroes");
    const least = [...heroes].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (least && heroes.length < state.window.options.length) return { type: "Choose", optionId: least };
  }
  if (state.window?.kind === "defense") {
    const defenders = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const least = [...targets].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  if (state.window?.kind === "optionalEngage") return engageOneEach(state, ctx, 2) ?? { type: "DeclineEngage" };
  return nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory, legalIntents(state, ctx));
}

type Game = { loadout: StoredLoadout; intents: PlayerIntent[]; state: ScenarioState };

function play(seed: number, log: CampaignLog): Game {
  const campaign = loadCampaign(CAMPAIGN);
  const scenario = loadScenario("the-fate-of-numenor");
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const seats = DECKS.map((id) => ({ deckId: id, ...prebuiltDeck(id) }));
  const loadout: StoredLoadout = { scenarioId: scenario.id, difficulty: "Easy", seats, ringBearer: null, choices: [], acceptPenalty: false };
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, [...seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)]);
  return { loadout, ...playDealt(world, { ...newSave("fixture", campaign.id, 2), log }, loadout, seed, 8000, intentFor) };
}

function firstSeed(log: CampaignLog, wanted: (state: ScenarioState) => boolean, label: string): FateFixture | null {
  const limit = Number(process.env.FATE_SEEDS ?? 100);
  for (let seed = 1; seed <= limit; seed += 1) {
    const game = play(seed, log);
    say.debug(`seed ${seed}: ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : game.state.stageCleared ? "won" : "stalled"}`);
    if (!wanted(game.state)) continue;
    say.info(`${label}: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : "won"}`);
    return { campaignId: CAMPAIGN, seatCount: 2, loadout: game.loadout, seed, intents: game.intents, log };
  }
  say.warn(`no ${label} game found in ${limit} seeds`);
  return null;
}

export async function fateFixtures(): Promise<Partial<Record<FateFixtureName, FateFixture>>> {
  const log = await voyageWonLog();
  const won = firstSeed(log, (state) => state.stageCleared && !state.lost, "fate-won");
  const lost = firstSeed(log, (state) => state.lost, "fate-lost");
  return { ...(won ? { "fate-won": won } : {}), ...(lost ? { "fate-lost": lost } : {}) };
}
