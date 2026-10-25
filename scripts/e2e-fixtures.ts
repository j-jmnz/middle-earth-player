// Writes src/campaign/fixtures/scenario-1.json (saves parked on a moment of A Shadow of the Past) and
// src/campaign/fixtures/a-knife-in-the-dark.json (A Knife in the Dark) for the Maestro flows. Run it again when
// src/campaign/fixtures.test.ts reports that a fixture no longer reaches its moment:
//
//   node --experimental-strip-types scripts/e2e-fixtures.ts
//
// `won`: both starter decks, two-handed, Easy, parked on the first Resolution choice. The naive auto-player loses every
// game with the starter decks, so a seeded beam search plays varied (still legal) answers a round at a time and keeps the
// games that got furthest until one is won; every intent is one the reducer listed or accepted, and the search is
// deterministic. `lost`: Stealth and Steadfastness with the saga
// Frodo, true solo, Normal, every intent up to the loss.
//
// `knife-lost`: A Knife in the Dark from the log the `won` game writes when its Resolution is answered with Gandalf's Delay
// (141078) and Gildor Inglorion (141077), as the scenario-1 Maestro flow answers it. Each seat plays its starter list with
// a core set hero of the same sphere in place of each hero that fell in that game (REPLACEMENT), and the briefing's threat
// penalty when one did. Two-handed, Easy, the auto-player's answers, every intent up to the loss.
import { writeFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { deal, finish, resume, contextOf } from "../src/campaign/session.ts";
import { resolutionView } from "../src/campaign/resolution-view.ts";
import type { CampaignLog } from "../src/campaign/log.ts";
import { newSave, type Save, type StoredLoadout } from "../src/campaign/save.ts";
import { loadWorld, logCodes } from "../src/campaign/world.ts";
import { CATALOG_VERSION } from "../src/catalog/version.ts";
import { ENGINE_VERSION } from "../src/rules/version.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";

import { nextIntent } from "./auto-player.ts";
import { loadCampaign, loadScenario } from "./data/load-scenarios.ts";
import { temporaryCatalog } from "./temp-catalog.ts";

const FRODO = "141001";
const campaign = loadCampaign();
const scenario = loadScenario("a-shadow-of-the-past");
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

function starter(id: string): { heroes: string[]; deck: string[] } {
  const found = campaign.starterDecks.find((entry) => entry.id === id);
  if (!found) throw new Error(`No starter deck ${id}`);
  return {
    heroes: found.rows.filter((row) => row.type === "hero").map((row) => row.code),
    deck: found.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)),
  };
}

const stealth = starter("stealth-and-steadfastness");
const wisdom = starter("wisdom-and-wizardry");

function opened(seatCount: 1 | 2, loadout: StoredLoadout, seed: number): { state: ScenarioState; ctx: ReduceContext } {
  const codes = [FRODO, ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, codes);
  const dealt = deal(newSave("fixture", campaign.id, seatCount), world, loadout, seed, CATALOG_VERSION);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world, CATALOG_VERSION);
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
  if (base.type === "CommitHide") return { type: "CommitHide", cardIds: legalTargets(state, { type: "CommitHide" }, ctx) };
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
    seats: [
      { deckId: "stealth-and-steadfastness", heroes: stealth.heroes, deck: stealth.deck },
      { deckId: "wisdom-and-wizardry", heroes: wisdom.heroes, deck: wisdom.deck },
    ],
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
          console.log(`won: seed ${line.seed}, depth ${depth}, ${intents.length} intents, round ${state.round}`);
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
    console.log(`depth ${depth}: ${children.length} alive, best stage ${beam[0] ? stageAt(beam[0].state) : -1}`);
  }
  throw new Error("No won game found");
}

function playLoss(): { seed: number; loadout: StoredLoadout; intents: PlayerIntent[] } {
  const loadout: StoredLoadout = {
    scenarioId: scenario.id,
    difficulty: "Normal",
    seats: [{ deckId: "stealth-and-steadfastness", heroes: stealth.heroes, deck: stealth.deck }],
    ringBearer: FRODO,
    choices: [],
    acceptPenalty: false,
  };
  const seed = 2;
  const { state: start, ctx } = opened(1, loadout, seed);
  let state = start;
  const intents: PlayerIntent[] = [];
  for (let turn = 0; turn < 3000 && !state.lost; turn += 1) {
    const intent = nextIntent(state, ctx, { scout: stealth.heroes[2] ?? "", prefer: "141035", protect: FRODO });
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  if (!state.lost) throw new Error("The loss fixture did not lose");
  console.log(`lost: seed ${seed}, ${intents.length} intents, round ${state.round}, ${state.lossReason}`);
  return { seed, loadout, intents };
}

// The log the won game writes when its Resolution is answered with these cards, one choice at a time.
const PAST_CHOICES = ["141078", "141077"];

function wonLog(won: { seed: number; loadout: StoredLoadout; intents: PlayerIntent[] }): { log: CampaignLog; choices: string[] } {
  const codes = [FRODO, ...won.loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, codes);
  const save: Save = { ...newSave("fixture", campaign.id, 2), active: { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, seed: won.seed, intents: [...won.intents] }, loadout: won.loadout };
  const resumed = resume(save, world, CATALOG_VERSION);
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

// A core set hero of the same sphere for each starter hero that can fall (Gandalf is neutral: a Lore hero takes his place).
const REPLACEMENT: Readonly<Record<string, string>> = {
  "141002": "01003",
  "141003": "01005",
  "141004": "01010",
  "142002": "01011",
  "01002": "01001",
  "01007": "01008",
};

function playKnifeLoss(log: CampaignLog): { seed: number; loadout: StoredLoadout; intents: PlayerIntent[] } {
  const knife = loadScenario("a-knife-in-the-dark");
  // Each seat replaces the heroes that fell in the won game (checklist step 2), and takes the threat penalty for it.
  const replaced = (heroes: readonly string[], seat: number) =>
    heroes.map((code) => ((log.fallenHeroesBySeat[seat] ?? []).includes(code) ? (REPLACEMENT[code] ?? code) : code));
  const seats = [replaced(stealth.heroes, 0), replaced(wisdom.heroes, 1)];
  const loadout: StoredLoadout = {
    scenarioId: knife.id,
    difficulty: "Easy",
    seats: [
      { deckId: "stealth-and-steadfastness", heroes: seats[0] ?? [], deck: stealth.deck },
      { deckId: "wisdom-and-wizardry", heroes: seats[1] ?? [], deck: wisdom.deck },
    ],
    ringBearer: FRODO,
    choices: [],
    acceptPenalty: log.fallenHeroesBySeat.some((fallen) => fallen.length > 0),
  };
  console.log(`knife-lost heroes: ${JSON.stringify(seats)}`);
  const codes = [FRODO, ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)];
  const world = loadWorld(catalog, campaign, knife, EFFECTS, codes);
  const seed = 1;
  const dealt = deal({ ...newSave("fixture", campaign.id, 2), log }, world, loadout, seed, CATALOG_VERSION);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world, CATALOG_VERSION);
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
  console.log(`knife-lost: seed ${seed}, ${intents.length} intents, round ${state.round}, ${state.lossReason}`);
  return { seed, loadout, intents };
}

const won = searchWin();
const lost = playLoss();
const out = {
  won: { seatCount: 2, ...won },
  lost: { seatCount: 1, ...lost },
};
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "src", "campaign", "fixtures");
const file = path.join(dir, "scenario-1.json");
writeFileSync(file, `${JSON.stringify(out)}\n`);
console.log(`wrote ${file}`);

const past = wonLog(won);
const knifeOut = {
  "knife-lost": { seatCount: 2, ...playKnifeLoss(past.log), log: past.log, past: { fixture: "won", choices: past.choices } },
};
const knifeFile = path.join(dir, "a-knife-in-the-dark.json");
writeFileSync(knifeFile, `${JSON.stringify(knifeOut)}\n`);
console.log(`wrote ${knifeFile}`);
