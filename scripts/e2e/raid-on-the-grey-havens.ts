// The Maestro fixtures of Raid on the Grey Havens (Dream-chaser part 3), written into src/campaign/fixtures/raid-on-the-grey-havens.json by scripts/e2e/fixtures.ts: real games of saved decklists (the
// Defenders of Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `raid-won` is the first seed that wins, parked on the win (the Resolution
// waits); `raid-lost` the first that loses, parked on the loss. A game not found in the seeds is left out.
// The log has parts 1 and 2 recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it (a blank log keeps Raid locked and the path opens Voyage Across Belegaer): it is the log
// the won game of Voyage Across Belegaer's golden writes (src/campaign/scenarios/voyage-across-belegaer/golden.test.ts, "two-handed, won"), and on top of it the one of The Fate of Númenor's golden (src/campaign/scenarios/the-fate-of-numenor/golden.test.ts,
// "two-handed, won"), each run through the same `applyResolution` that writes it in the app, with the goldens' plain-number heroes taken out (the fixture's seats play real decklists). `voyage-won` and
// `fate-won`, real-decklist wins, are open (docs/phases/STATUS.md). The Campaign Setup's offer of a Galdor's Counsel is answered in the loadout: neither player takes one.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { applyResolution, emptyLog, type CampaignLog } from "../../src/campaign/log.ts";
import { newSave, type StoredLoadout } from "../../src/campaign/save.ts";
import { loadWorld, logCodes } from "../../src/campaign/world.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { characters, legalAttackEnemies } from "../../src/rules/combat/combat.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { FATE_GOLDENS, playGolden as playFate, fateWorld } from "../../test/scenarios/the-fate-of-numenor/game.ts";
import { loadCampaign, loadScenario } from "../data/load-scenarios.ts";
import { createLog } from "../log.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import { VOYAGE_GOLDENS, playGolden as playVoyage, voyageWorld } from "../../test/scenarios/voyage-across-belegaer/game.ts";
import { playDealt, prebuiltDeck } from "./seed-kit.ts";
import { engageOneEach } from "../../test/harness/game-kit.ts";

const say = createLog("e2e-raid");
const DECKS = ["defenders-of-gondor", "swords-of-the-noldor"] as const;
const CAMPAIGN = "dream-chaser";

export type RaidFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type RaidFixtureName = "raid-won" | "raid-lost";

// The log of a playthrough whose first two parts were won: the Voyage golden's two-handed win resolved onto a new log, then the Fate golden's, their heroes and what hangs on them left out.
export async function fateWonLog(): Promise<CampaignLog> {
  const voyage = VOYAGE_GOLDENS.find((item) => item.name === "two-handed, won");
  if (!voyage) throw new Error("The Voyage golden \"two-handed, won\" is gone");
  const voyageWorldLoaded = await voyageWorld(voyage.decks);
  const first = playVoyage(voyage, voyageWorldLoaded.ctx);
  if (!first.state.stageCleared || first.state.lost) throw new Error("The Voyage golden no longer wins");
  const afterVoyage = applyResolution(emptyLog(2), first.state.scenarioId, first.state, voyageWorldLoaded.cards);
  const fate = FATE_GOLDENS.find((item) => item.name === "two-handed, won");
  if (!fate) throw new Error("The Fate golden \"two-handed, won\" is gone");
  const fateWorldLoaded = await fateWorld(fate.decks);
  const second = playFate(fate, fateWorldLoaded.ctx);
  if (!second.state.stageCleared || second.state.lost) throw new Error("The Fate golden no longer wins");
  const written = applyResolution(afterVoyage, second.state.scenarioId, second.state, fateWorldLoaded.cards);
  const blank = emptyLog(2);
  return { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) };
}

// The auto-player's answer with what the scenario asks: damage the players assign falls on the least wounded hero, the heroes attack together (Graxar alone), and the first location the travel phase
// offers is travelled to.
export function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
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
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const reachable = (id: string) => legalAttackEnemies(state, seat, id, ctx.cards);
    const enemy = ready.flatMap(reachable)[0];
    const attackers = ready.filter((id) => enemy != null && reachable(id).includes(enemy));
    const limited = enemy != null && ctx.cards.get(state.cards[enemy]?.code ?? "")?.name === "Graxar";
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: limited ? attackers.slice(0, 1) : attackers };
  }
  if (state.window?.kind === "optionalEngage") return engageOneEach(state, ctx, 2) ?? { type: "DeclineEngage" };
  return nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory, legalIntents(state, ctx));
}

type Game = { loadout: StoredLoadout; intents: PlayerIntent[]; state: ScenarioState };

function play(seed: number, log: CampaignLog): Game {
  const campaign = loadCampaign(CAMPAIGN);
  const scenario = loadScenario("raid-on-the-grey-havens");
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const seats = DECKS.map((id) => ({ deckId: id, ...prebuiltDeck(id) }));
  // Neither player takes a Galdor's Counsel at the Campaign Setup.
  const loadout: StoredLoadout = { scenarioId: scenario.id, difficulty: "Easy", seats, ringBearer: null, choices: ["skip", "skip"], acceptPenalty: false };
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, [...seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)]);
  return { loadout, ...playDealt(world, { ...newSave("fixture", campaign.id, 2), log }, loadout, seed, 8000, intentFor) };
}

function firstSeed(log: CampaignLog, wanted: (state: ScenarioState) => boolean, label: string): RaidFixture | null {
  const limit = Number(process.env.RAID_SEEDS ?? 100);
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

export async function raidFixtures(): Promise<Partial<Record<RaidFixtureName, RaidFixture>>> {
  const log = await fateWonLog();
  const won = firstSeed(log, (state) => state.stageCleared && !state.lost, "raid-won");
  const lost = firstSeed(log, (state) => state.lost, "raid-lost");
  return { ...(won ? { "raid-won": won } : {}), ...(lost ? { "raid-lost": lost } : {}) };
}
