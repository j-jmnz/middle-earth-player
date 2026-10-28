// The Maestro fixtures of Journey Along the Anduin (Mirkwood Paths part 2), written into src/campaign/fixtures/journey-along-the-anduin.json by
// scripts/e2e-fixtures.ts: two real games of saved decklists (the Dwarves of Durin and Elves of Lórien lists of data/decks/prebuilt.json), two-handed,
// Easy, from the log the `mirkwood-won` game (scripts/e2e-mirkwood.ts) writes when it is confirmed (Passage Through Mirkwood's earned pool reaches
// this scenario through the Campaign Setup Checklist), played by the auto-player, every intent one the reducer listed.
// `anduin-won`: the first seed that wins, parked on the win (01130's Resolution asks nothing: each Valor and Scarred attached to a hero goes to the
// pool on that hero and the hero with the most damage is the prisoner). `anduin-lost`: the first seed that loses when Mendor leaves play (01130:A:5), parked on the loss.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { inArray } from "drizzle-orm";

import { type CampaignLog } from "../src/campaign/log.ts";
import { cards as cardRows } from "../src/catalog/schema.ts";
import { contextOf, deal, finish, resume } from "../src/campaign/session.ts";
import { newSave, type Save, type StoredLoadout } from "../src/campaign/save.ts";
import { loadWorld, logCodes } from "../src/campaign/world.ts";
import { CATALOG_VERSION } from "../src/catalog/version.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { characters, legalAttackEnemies } from "../src/rules/combat.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";
import { ENGINE_VERSION } from "../src/rules/version.ts";

import { nextIntent } from "./auto-player.ts";
import { loadCampaign, loadScenario } from "./data/load-scenarios.ts";
import type { MirkwoodFixture } from "./e2e-mirkwood.ts";
import { createLog } from "./log.ts";
import { temporaryCatalog } from "./temp-catalog.ts";

const say = createLog("e2e-anduin");

export type AnduinFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog; past: { fixture: string; choices: string[] } };

const campaign = loadCampaign("mirkwood-paths");
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

// The log Passage Through Mirkwood's won game writes: replay the fixture and confirm it.
export function passageLog(won: MirkwoodFixture): CampaignLog {
  const scenario = loadScenario("passage-through-mirkwood");
  const codes = won.loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]);
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, codes);
  const save: Save = { ...newSave("fixture", campaign.id, 2), loadout: won.loadout, active: { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, seed: won.seed, intents: [...won.intents] } };
  const resumed = resume(save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  if (!resumed.state.stageCleared || resumed.state.lost) throw new Error("The mirkwood-won fixture does not replay to a win");
  return finish(save, world, resumed.state).log;
}

// The log Journey Along the Anduin's won game writes: replay the fixture and confirm it (the prisoner is the one its Resolution names).
export function anduinWonLog(won: AnduinFixture): CampaignLog {
  const scenario = loadScenario("journey-along-the-anduin");
  const codes = [...won.loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(won.log)];
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, codes);
  const save: Save = { ...newSave("fixture", campaign.id, 2), log: won.log, loadout: won.loadout, active: { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, seed: won.seed, intents: [...won.intents] } };
  const resumed = resume(save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  if (!resumed.state.stageCleared || resumed.state.lost) throw new Error("The anduin-won fixture does not replay to a win");
  return finish(save, world, resumed.state).log;
}

// The auto-player's answer, except that Mendor ("if Mendor leaves play, the players lose the game", 01130:A:5) is never chosen when another card can be: not as
// a defender, and not as the ally Pursued by Shadow sends back to its owner's hand (a player never would).
function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose") {
    const others = state.window.options.filter((id) => state.cards[id]?.code !== "01135");
    if (others.length > 0 && others.length < state.window.options.length) return { type: "Choose", optionId: others[0] ?? "" };
  }
  if (state.window?.kind === "defense") {
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => state.cards[id]?.code !== "01135");
    const first = defenders.sort((a, b) => ((ctx.cards.get(state.cards[b]?.code ?? "")?.defense ?? 0) - (ctx.cards.get(state.cards[a]?.code ?? "")?.defense ?? 0)))[0];
    if (first && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender")) return { type: "DeclareDefender", defenderId: first };
    // The hero with the most hit points left takes an undefended attack, so no hero dies while another can take it.
    const left = (id: string): number => (ctx.cards.get(state.cards[id]?.code ?? "")?.health ?? 0) - (state.cards[id]?.damage ?? 0);
    const heroes = legalTargets(state, { type: "Undefended" }, ctx).filter((id) => state.cards[id]?.code !== "01135").sort((a, b) => left(b) - left(a));
    if (heroes[0]) return { type: "Undefended", heroId: heroes[0] };
  }
  // The scenario is won by defeating the enemies, which the auto-player alone never attacks: every ready character that can reach the first enemy
  // attacks it together, and each seat engages one enemy at a time in the optional engagement step.
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => state.cards[id]?.code !== "01135" && legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const enemy = ready.map((id) => legalAttackEnemies(state, seat, id, ctx.cards)[0]).find((id) => id != null);
    const attackers = ready.filter((id) => enemy != null && legalAttackEnemies(state, seat, id, ctx.cards).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
    if (enemy && seat && seat.engaged.length < 2) return { type: "Engage", enemyId: enemy };
  }
  return nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
}

function play(log: CampaignLog, loadout: StoredLoadout, seed: number): { intents: PlayerIntent[]; state: ScenarioState } {
  const scenario = loadScenario("journey-along-the-anduin");
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, [...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)]);
  const dealt = deal({ ...newSave("fixture", campaign.id, 2), log }, world, loadout, seed, CATALOG_VERSION);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  const ctx = contextOf(world);
  let state = resumed.state;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < 6000 && !state.lost && !state.stageCleared; turn += 1) {
    const intent = intentFor(state, ctx, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  return { intents, state };
}

// A Core Set hero of each sphere, in place of a hero that fell in Passage Through Mirkwood (checklist step 2: a fallen hero cannot start; a
// player who changes heroes takes the threat penalty, step 3).
const REPLACEMENT: Readonly<Record<string, string>> = { leadership: "01001", tactics: "01004", spirit: "01007", lore: "01010" };

export function replaced(loadout: StoredLoadout, log: CampaignLog): StoredLoadout {
  const fallen = log.fallenHeroesBySeat.flat();
  const spheres = new Map(catalog.select().from(cardRows).where(inArray(cardRows.code, fallen)).all().map((row) => [row.code, row.sphereCode]));
  const taken = new Set(loadout.seats.flatMap((seat) => seat.heroes));
  const seats = loadout.seats.map((seat, index) => ({
    ...seat,
    heroes: seat.heroes.map((code) => {
      if (!(log.fallenHeroesBySeat[index] ?? []).includes(code)) return code;
      const sphere = spheres.get(code) ?? "neutral";
      const candidate = [REPLACEMENT[sphere] ?? "01001", "01002", "01005", "01008", "01011"].find((hero) => !taken.has(hero)) ?? "01001";
      taken.add(candidate);
      say.info(`${code} fell in Passage Through Mirkwood: seat ${index + 1} starts ${candidate} in its place`);
      return candidate;
    }),
  }));
  return { ...loadout, seats, acceptPenalty: fallen.length > 0 };
}

// A fixture whose game is not found is left out (a name whose fixture is absent is not offered, `hasFixture`).
export function anduinFixtures(passage: MirkwoodFixture): Partial<Record<"anduin-won" | "anduin-lost", AnduinFixture>> {
  const log = passageLog(passage);
  const loadout: StoredLoadout = replaced({ ...passage.loadout, scenarioId: "journey-along-the-anduin" }, log);
  const past = { fixture: "mirkwood-won", choices: [] as string[] };
  const first = (wanted: (state: ScenarioState) => boolean, label: string): AnduinFixture | null => {
    for (let seed = 1; seed <= Number(process.env.ANDUIN_SEEDS ?? 60); seed += 1) {
      const game = play(log, loadout, seed);
      say.debug(`seed ${seed}: ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : game.state.stageCleared ? "won" : "stalled"}`);
      if (!wanted(game.state)) continue;
      say.info(`${label}: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : `prisoner ${game.state.resolutionLog.prisoner}`}`);
      return { campaignId: "mirkwood-paths", seatCount: 2, loadout, seed, intents: game.intents, log, past };
    }
    say.warn(`no ${label} game found in ${process.env.ANDUIN_SEEDS ?? 60} seeds`);
    return null;
  };
  const won = first((state) => state.stageCleared && !state.lost, "anduin-won");
  const lost = first((state) => state.lost && (state.lossReason ?? "").includes("Mendor left play"), "anduin-lost");
  return { ...(won ? { "anduin-won": won } : {}), ...(lost ? { "anduin-lost": lost } : {}) };
}
