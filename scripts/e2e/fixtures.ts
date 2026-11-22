// Writes src/campaign/fixtures/scenario-1.json (saves parked on a moment of A Shadow of the Past), a-knife-in-the-dark.json
// (A Knife in the Dark) and the file of every other scenario in the registry. Run it again when
// src/campaign/fixtures.test.ts reports that a fixture no longer reaches its moment:
//
//   pnpm scenario fixtures                 # `lost` and `duo`, then every other scenario's file
//   pnpm scenario fixtures --won           # also search for `won`, then write `knife-lost` (only when the user asks)
//   pnpm scenario fixtures <scenario-id>   # only that scenario's file (scenario 1's block for its two ids)
//   pnpm scenario fixtures <scenario-id> --search [--seeds=1-6] [--budget=600] [--plain=0] [--out=<folder>]
//                                          # a won game the fixed policy never reaches is searched for (scripts/e2e/search/options.ts lists the flags; only when the user asks)
//
// With a scenario id, a part after the first takes the earlier parts' won games from their committed files, so the other files are not rewritten.
//
// No agent searches for a won game: a scenario's goldens prove its win, and a seed finder plays for a `-won` name only while the
// registry holds it (docs/architecture.md, Tests). `won` and `knife-lost` are the two names not committed: with the rules as the sources
// state them, the search has found no legal win of the two decks it played, and the tests that replay them are skipped until they are.
//
// `won`: the two-handed fixture decks (scripts/e2e/seed-kit.ts, `FIXTURE_DECKS`; the first seat takes the saga Frodo), Easy, parked on the first Resolution choice. The naive auto-player loses every
// game with those decks, so a seeded beam search plays varied (still legal) answers a round at a time and keeps the
// games that got furthest until one is won; every intent is one the reducer listed or accepted, and the search is
// deterministic. `lost`: the solo fixture deck (`SOLO_FIXTURE_DECK`) with the saga
// Frodo, true solo, Normal, every intent up to the loss.
//
// `duo`: the same two decks, two-handed, Easy, parked on the first player's planning window of round 1 (the opening hands kept, the
// first resource and the quest of nothing yet), for the flows that need two dials and a seat that is not acting (the peek,
// the seat-peek feature). Nothing in it is a win or a loss: it is the auto-player's answers up to that window.
//
// Every other scenario's fixtures (the names are in src/campaign/fixtures/registry.ts) are written by the scenario's own seed finder
// in this folder, to src/campaign/fixtures/<scenario-id>.json, in campaign order (data/campaigns): a part after the first is dealt from
// the log the earlier part's won game writes (its golden's, or its won fixture where one is committed). A game the seeds did not find
// is left out of its file, and its name leaves the registry. A scenario of a cycle (a registry entry of kind "standalone", Shadows of Mirkwood) has no log and no earlier part: its finder writes
// one open standalone game for each name (a loadout of saved decks, a seed and the intents), and the e2e route opens it on its table.
//
// `knife-lost`: A Knife in the Dark from the log the `won` game writes when its Resolution is answered with Gandalf's Delay
// (141078) and Gildor Inglorion (141077), as the scenario-1 tests answer it. Each seat plays its list with
// a hero of the same sphere in place of each hero that fell in that game (REPLACEMENT), and the briefing's threat
// penalty when one did. Two-handed, Easy, the auto-player's answers, every intent up to the loss.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { deal, finish, resume, contextOf } from "../../src/campaign/session.ts";
import { resolutionView } from "../../src/campaign/resolution-view.ts";
import type { CampaignLog } from "../../src/campaign/log.ts";
import { newSave, type Save, type StoredLoadout } from "../../src/campaign/save.ts";
import { loadWorld, logCodes } from "../../src/campaign/world.ts";
import { CATALOG_VERSION } from "../../src/catalog/version.ts";
import { ENGINE_VERSION } from "../../src/rules/engine/version.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { hideCommitLimit } from "../../src/rules/families/nightmare/guards.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { loadAnyScenario, loadCampaign, loadCampaignsInOrder, loadScenario, scenarioOrder } from "../data/load-scenarios.ts";
import { FIXTURE_DECKS, SOLO_FIXTURE_DECK, prebuiltDeck } from "./seed-kit.ts";
import { searchFlags } from "./search/options.ts";
import { WRITERS, isChained, type Chained, type Written } from "./writers.ts";
import { pastShowcase } from "./showcase-past.ts";
import { FIXTURE_REGISTRY, fixtureFile, fixtureKindOf, type FixtureScenarioId } from "../../src/campaign/fixtures/registry.ts";
import { createLog, runScript } from "../log.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";

const say = createLog("e2e-fixtures");
const FRODO = "141001";
const campaign = loadCampaign();
const scenario = loadScenario("a-shadow-of-the-past");
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

// The fixture decks (scripts/e2e/seed-kit.ts): a two-handed game plays the pair, the first seat taking the saga Frodo as its Ring-bearer; a true solo game plays the solo deck.
const solo = { deckId: SOLO_FIXTURE_DECK, ...prebuiltDeck(SOLO_FIXTURE_DECK) };
const pair = FIXTURE_DECKS.map((id) => ({ deckId: id, ...prebuiltDeck(id) }));

function opened(seatCount: 1 | 2, loadout: StoredLoadout, seed: number): { state: ScenarioState; ctx: ReduceContext } {
  const codes = [FRODO, ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, codes);
  const dealt = deal(newSave("fixture", campaign.id, seatCount), world, loadout, seed);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world);
  if (!resumed.ok) throw new Error(resumed.reason);
  return { state: resumed.state, ctx: contextOf(world) };
}

// A small deterministic generator, so the search finds the same game every run.
function generator(start: number): () => number {
  let value = start;
  return () => {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    return value / 0x7fffffff;
  };
}

function varied(state: ScenarioState, ctx: ReduceContext, random: () => number, memory: Set<string>): PlayerIntent {
  const base = nextIntent(state, ctx, { scout: "", prefer: "141035", protect: FRODO, play: true, act: true }, memory);
  // Frodo's cancel (141001:response:1) exhausts The One Ring, which the scenario punishes: the search saves it for the
  // cards that start an attack (the Black Rider, Hunting for the Ring).
  if (base.type === "Trigger" && base.effectId === "141001:response:1") {
    const revealed = [...state.stack].reverse().find((frame) => frame.frame === "reveal")?.cardId;
    const code = revealed ? state.cards[revealed]?.code : undefined;
    if (code !== "141039" && code !== "141042") return { type: "Pass" };
  }
  if (base.type === "Commit") {
    // How many characters quest varies by decision, but one or two always stay ready: a Hide test is passed with the
    // willpower of ready characters (mec109.hide-tests), and an exhausted table cannot defend.
    const share = [0.4, 0.65, 0.9][Math.floor(random() * 3)] ?? 0.65;
    const all = legalTargets(state, { type: "Commit" }, ctx);
    const kept = new Set([...all].sort(() => random() - 0.5).slice(0, 1 + Math.floor(random() * 2)));
    const ids = all.filter((id) => !kept.has(id) && random() < share);
    return ids.length > 0 ? { type: "Commit", cardIds: ids } : { type: "Pass" };
  }
  // An Action in the resource phase spends its cost for nothing the phase uses (a stat bonus that ends with it, an
  // exhausted ally): the search keeps its actions for planning and the quest.
  if (base.type === "Trigger" && state.mode === "resourceActions") return { type: "Pass" };
  // A choice that could land on the Ring-bearer (a host for Have You Seen Baggins?) takes another option when there is one.
  if (base.type === "Choose" && state.cards[base.optionId]?.code === FRODO) {
    const other = legalIntents(state, ctx).find((intent) => intent.type === "Choose" && state.cards[intent.optionId]?.code !== FRODO);
    if (other?.type === "Choose") return { type: "Choose", optionId: other.optionId };
  }
  if (base.type === "CommitFortitude") return { type: "CommitFortitude", cardIds: legalTargets(state, { type: "CommitFortitude" }, ctx) };
  if (base.type === "CommitHide") return { type: "CommitHide", cardIds: legalTargets(state, { type: "CommitHide" }, ctx).slice(0, hideCommitLimit(state) ?? undefined) };
  // On A Shortcut to Mushrooms each ally adds 1 to every Hide test's threat (141023:B:2), so the search holds allies back.
  const stage = state.cards[state.questStage ?? ""]?.code;
  if (base.type === "PlayCard" && stage === "141023" && ctx.cards.get(state.cards[base.cardId]?.code ?? "")?.type === "ally") return { type: "Pass" };
  if (state.window?.kind === "defense" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender")) {
    // Never the Ring-bearer: his 2 hit points hold The One Ring.
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => state.cards[id]?.code !== FRODO);
    const pick = defenders[Math.floor(random() * defenders.length)];
    if (pick && random() < 0.85) return { type: "DeclareDefender", defenderId: pick };
  }
  if (state.window?.kind === "travel") {
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const pick = targets[Math.floor(random() * targets.length)];
    return pick && random() < 0.8 ? { type: "Travel", locationId: pick } : { type: "DeclineTravel" };
  }
  return base;
}

function searchWin(): { seed: number; loadout: StoredLoadout; intents: PlayerIntent[] } {
  const loadout: StoredLoadout = {
    scenarioId: scenario.id,
    difficulty: "Easy",
    seats: pair,
    ringBearer: FRODO,
    choices: [],
    acceptPenalty: false,
  };
  // A beam search over varied games: each game is played on one round at a time in several ways, and the games that got
  // furthest (stage, then progress, then lower threat) carry on. Every branch replays the same reducer.
  const random = generator(12345);
  type Line = { seed: number; state: ScenarioState; intents: PlayerIntent[]; memory: Set<string>; ctx: ReduceContext };
  const stageAt = (state: ScenarioState) => scenario.stages.indexOf(state.cards[state.questStage ?? ""]?.code ?? "");
  const heroes = (state: ScenarioState) => state.seats.slice(0, state.seatCount).reduce((sum, seat) => sum + seat.heroes.length, 0);
  const threat = (state: ScenarioState) => Math.max(...state.seats.slice(0, state.seatCount).map((seat) => seat.threat));
  const score = (state: ScenarioState) =>
    stageAt(state) * 1000 + (state.cards[state.questStage ?? ""]?.progress ?? 0) * 20 + state.victory.length * 30 + heroes(state) * 60 - threat(state);
  // The safest games: every hero standing, low threat. Half the beam keeps them, so a strong table is not dropped for one
  // that ran ahead and cannot survive the next stage.
  const safety = (state: ScenarioState) => heroes(state) * 100 - threat(state) * 3 + (state.cards[state.questStage ?? ""]?.progress ?? 0);
  let beam: Line[] = [];
  for (let seed = 1; seed <= 40; seed += 1) {
    const { state, ctx } = opened(2, loadout, seed);
    beam.push({ seed, state, intents: [], memory: new Set(), ctx });
  }
  let retries = 0;
  for (let depth = 0; depth < 40 && beam.length > 0; depth += 1) {
    const children: Line[] = [];
    for (const line of beam) {
      for (let branch = 0; branch < 10; branch += 1) {
        let state = line.state;
        const intents = [...line.intents];
        const memory = new Set(line.memory);
        const round = state.round;
        for (let turn = 0; turn < 400 && !state.lost && state.window?.kind !== "resolution" && state.round === round; turn += 1) {
          const intent = varied(state, line.ctx, random, memory);
          const result = reduce(state, intent, line.ctx);
          if (!result.ok) throw new Error(`The search sent a refused intent: ${result.reason}`);
          state = result.state;
          intents.push(intent);
        }
        if (state.window?.kind === "resolution") {
          say.info(`won: seed ${line.seed}, depth ${depth}, ${intents.length} intents, round ${state.round}`);
          return { seed: line.seed, loadout, intents };
        }
        if (!state.lost) children.push({ seed: line.seed, state, intents, memory, ctx: line.ctx });
      }
    }
    // Every branch lost: play the same round again with fresh answers.
    if (children.length === 0 && retries < 30) {
      retries += 1;
      depth -= 1;
      continue;
    }
    const ahead = [...children].sort((left, right) => score(right.state) - score(left.state)).slice(0, 30);
    const safe = [...children].sort((left, right) => safety(right.state) - safety(left.state)).filter((line) => !ahead.includes(line)).slice(0, 30);
    beam = [...ahead, ...safe];
    say.info(`depth ${depth}: ${children.length} alive, best stage ${beam[0] ? stageAt(beam[0].state) : -1}`);
  }
  throw new Error("No won game found");
}

function playLoss(): { seed: number; loadout: StoredLoadout; intents: PlayerIntent[] } {
  const loadout: StoredLoadout = {
    scenarioId: scenario.id,
    difficulty: "Normal",
    seats: [solo],
    ringBearer: FRODO,
    choices: [],
    acceptPenalty: false,
  };
  const seed = 2;
  const { state: start, ctx } = opened(1, loadout, seed);
  let state = start;
  const intents: PlayerIntent[] = [];
  for (let turn = 0; turn < 3000 && !state.lost; turn += 1) {
    const intent = nextIntent(state, ctx, { scout: solo.heroes[2] ?? "", prefer: "141035", protect: FRODO });
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  if (!state.lost) throw new Error("The loss fixture did not lose");
  say.info(`lost: seed ${seed}, ${intents.length} intents, round ${state.round}, ${state.lossReason}`);
  return { seed, loadout, intents };
}

function playDuo(): { seed: number; loadout: StoredLoadout; intents: PlayerIntent[] } {
  const loadout: StoredLoadout = {
    scenarioId: scenario.id,
    difficulty: "Easy",
    seats: pair,
    ringBearer: FRODO,
    choices: [],
    acceptPenalty: false,
  };
  const seed = 1;
  const { state: start, ctx } = opened(2, loadout, seed);
  let state = start;
  const intents: PlayerIntent[] = [];
  for (let turn = 0; turn < 400 && !(state.mode === "planning" && state.activeSeat === 0 && state.round >= 1); turn += 1) {
    const intent = nextIntent(state, ctx, { scout: "", prefer: "141035", protect: FRODO, play: true, act: true });
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  if (!(state.mode === "planning" && state.activeSeat === 0)) throw new Error("The duo fixture never reached the first player's planning window");
  say.info(`duo: seed ${seed}, ${intents.length} intents, round ${state.round}, ${state.phase}`);
  return { seed, loadout, intents };
}

// The log scenario 1's won game writes when its Resolution is answered with these cards, one choice at a time (`logOfPastResolution`; seed-kit's `wonLog` is the same step for a golden).
const PAST_CHOICES = ["141078", "141077"];

function logOfPastResolution(won: { seed: number; loadout: StoredLoadout; intents: PlayerIntent[] }): { log: CampaignLog; choices: string[] } {
  const codes = [FRODO, ...won.loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, codes);
  const save: Save = { ...newSave("fixture", campaign.id, 2), active: { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world: null, seed: won.seed, intents: [...won.intents] }, loadout: won.loadout };
  const resumed = resume(save, world);
  if (!resumed.ok) throw new Error(resumed.reason);
  let state = resumed.state;
  const choices: string[] = [];
  for (let view = resolutionView(state, world); view.kind === "choosing"; view = resolutionView(state, world)) {
    const tile = view.tiles.find((item) => item.code != null && PAST_CHOICES.includes(item.code));
    if (!tile) throw new Error(`No Resolution tile for ${PAST_CHOICES.join(" or ")}`);
    const result = reduce(state, { type: "ChooseResolution", optionId: tile.optionId }, contextOf(world));
    if (!result.ok) throw new Error(`The Resolution refused ${tile.optionId}: ${result.reason}`);
    state = result.state;
    choices.push(tile.optionId);
  }
  return { log: finish(save, world, state).log, choices };
}

// A hero of the same sphere for each hero of the two-handed fixture decks, whose title is in neither seat (never Aragorn: the Fellowship's rule):
// a core set hero, and Bifur for the second Lore hero, since the core set's other Lore heroes are Denethor and Glorfindel.
const REPLACEMENT: Readonly<Record<string, string>> = {
  "10140": "01008",
  "12001": "01002",
  "17028": "01012",
  "05001": "01005",
  "22081": "01003",
  "145002": "01004",
  "04101": "01009",
  "04128": "03002",
};

function playKnifeLoss(log: CampaignLog): { seed: number; loadout: StoredLoadout; intents: PlayerIntent[] } {
  const knife = loadScenario("a-knife-in-the-dark");
  // Each seat replaces the heroes that fell in the won game (checklist step 2), and takes the threat penalty for it.
  const replaced = (heroes: readonly string[], seat: number) =>
    heroes.map((code) => ((log.fallenHeroesBySeat[seat] ?? []).includes(code) ? (REPLACEMENT[code] ?? code) : code));
  const seats = pair.map((seat, index) => replaced(seat.heroes, index));
  const loadout: StoredLoadout = {
    scenarioId: knife.id,
    difficulty: "Easy",
    seats: pair.map((seat, index) => ({ ...seat, heroes: seats[index] ?? [] })),
    ringBearer: FRODO,
    choices: [],
    acceptPenalty: log.fallenHeroesBySeat.some((fallen) => fallen.length > 0),
  };
  say.info(`knife-lost heroes: ${JSON.stringify(seats)}`);
  const codes = [FRODO, ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)];
  const world = loadWorld(catalog, campaign, knife, EFFECTS, codes);
  const seed = 1;
  const dealt = deal({ ...newSave("fixture", campaign.id, 2), log }, world, loadout, seed);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world);
  if (!resumed.ok) throw new Error(resumed.reason);
  const ctx = contextOf(world);
  let state = resumed.state;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < 6000 && !state.lost && state.window?.kind !== "resolution"; turn += 1) {
    const intent = nextIntent(state, ctx, { scout: "", prefer: "", protect: FRODO, play: true, act: true }, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  if (!state.lost) throw new Error("The knife loss fixture did not lose");
  say.info(`knife-lost: seed ${seed}, ${intents.length} intents, round ${state.round}, ${state.lossReason}`);
  return { seed, loadout, intents };
}

function position(order: readonly string[], id: string): number {
  const at = order.indexOf(id);
  if (at < 0) throw new Error(`${id} is in the fixture registry but in no campaign of data/campaigns`);
  return at;
}

// No legal win of the two starter decks has been found on this engine, so the search runs only when the user asks for it,
// and `won` and `knife-lost` are written only when it finds one.
void runScript("e2e-fixtures", async () => {
  const searching = process.argv.includes("--won");
  const only = scenarioArgument();
  if (only === null && searchFlags() !== null) throw new Error("--search takes one scenario id: a search of every scenario would run for hours");
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "src", "campaign", "fixtures");
  if (only !== null && !isChained(only) && searchFlags() !== null) throw new Error(`${only} has its own search for its won game: pass --won`);
  if (only === null || !isChained(only)) writeScenarioOne(dir, searching);
  if (only === null || isChained(only)) await writeChained(dir, only, searchFlags()?.out ?? null);
});

// The scenario id named on the command line, or null for every scenario. It must be in the fixture registry.
function scenarioArgument(): FixtureScenarioId | null {
  const named = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (named.length > 1) throw new Error("Usage: scripts/e2e/fixtures.ts [<scenario-id>] [--won] [--search ...]");
  const id = named[0];
  if (id === undefined) return null;
  const entry = FIXTURE_REGISTRY.find((one) => one.scenarioId === id);
  if (!entry) throw new Error(`${id} has no fixtures in src/campaign/fixtures/registry.ts`);
  return entry.scenarioId;
}

function writeScenarioOne(dir: string, searching: boolean): void {
  if (!searching) say.info("scenario 1's won game is not committed; --won searches for it, only when the user asks (about two hours with no result so far)");
  const lost = say.step("play scenario 1's loss", () => playLoss());
  const won = searching ? say.step("search scenario 1's won game", () => searchWin()) : null;
  const duo = say.step("play scenario 1 to a two-handed planning window", () => playDuo());
  const showcase = say.step("play scenario 1 to the README showcase's moments", () => pastShowcase());
  const out = {
    ...(won ? { won: { seatCount: 2, ...won } } : {}),
    lost: { seatCount: 1, ...lost },
    duo: { seatCount: 2, ...duo },
    ...showcase,
  };
  const file = path.join(dir, "scenario-1.json");
  writeFileSync(file, `${JSON.stringify(out)}\n`);
  say.info(`wrote ${file} (${Object.keys(out).join(", ")})`);

  if (won) {
    const past = logOfPastResolution(won);
    const knifeOut = {
      "knife-lost": { seatCount: 2, ...say.step("play A Knife in the Dark's loss", () => playKnifeLoss(past.log)), log: past.log, past: { fixture: "won", choices: past.choices } },
    };
    const knifeFile = path.join(dir, "a-knife-in-the-dark.json");
    writeFileSync(knifeFile, `${JSON.stringify(knifeOut)}\n`);
    say.info(`wrote ${knifeFile}`);
  }
}

// Every other scenario of the registry (src/campaign/fixtures/registry.ts), in campaign order: a part chains from the games written before it. With `only`,
// that scenario's file alone, and the earlier parts' games are read from their committed files.
async function writeChained(dir: string, only: Chained | null, out: string | null): Promise<void> {
  const written: Written = {};
  const order = scenarioOrder();
  const rest = FIXTURE_REGISTRY.flatMap((entry) => (isChained(entry.scenarioId) ? [{ ...entry, scenarioId: entry.scenarioId }] : [])).sort((left, right) => position(order, left.scenarioId) - position(order, right.scenarioId));
  for (const entry of rest) {
    const file = path.join(dir, `${fixtureFile(entry)}.json`);
    if (only !== null && entry.scenarioId !== only) {
      if (existsSync(file)) Object.assign(written, JSON.parse(readFileSync(file, "utf8")) as Written);
      continue;
    }
    // A standalone entry is a scenario of a cycle, and only that.
    const cycle = loadCampaignsInOrder().find((one) => one.scenarios.includes(entry.scenarioId))?.kind === "cycle";
    if (cycle !== (fixtureKindOf(entry.names[0] ?? "") === "standalone")) throw new Error(`${entry.scenarioId}: its fixture entry is ${cycle ? "of a cycle's scenario, so it needs kind \"standalone\"" : "of a campaign's scenario, so it takes no kind"}`);
    const name = loadAnyScenario(entry.scenarioId).name;
    const games = await say.stepAsync(`play ${name}'s fixtures`, async () => WRITERS[entry.scenarioId](written));
    Object.assign(written, games);
    const target = out === null ? file : path.join(path.resolve(out), `${fixtureFile(entry)}.json`);
    if (out !== null) mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(games)}\n`);
    say.info(`wrote ${target} (${Object.keys(games).join(", ")})`);
  }
}
