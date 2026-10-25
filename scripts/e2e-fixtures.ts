// Writes src/campaign/fixtures/scenario-1.json (saves parked on a moment of A Shadow of the Past) and
// src/campaign/fixtures/a-knife-in-the-dark.json (A Knife in the Dark) for the Maestro flows. Run it again when
// src/campaign/fixtures.test.ts reports that a fixture no longer reaches its moment:
//
//   node --experimental-strip-types scripts/e2e-fixtures.ts
//
// `won`: both starter decks, two-handed, Easy, parked on the first Resolution choice. The naive auto-player loses every
// game with the starter decks, so a seeded search tries varied (still legal) answers until one game is won; every intent is
// one the reducer listed or accepted, and the search is deterministic. `lost`: Stealth and Steadfastness with the saga
// Frodo, true solo, Normal, every intent up to the loss.
//
// `knife-lost`: A Knife in the Dark from the log the `won` game writes when its Resolution is answered with Gandalf's Delay
// (141078) and Gildor Inglorion (141077), as the scenario-1 Maestro flow answers it. That game's first seat lost Sam, Merry
// and Pippin, so the seat plays the Stealth and Steadfastness list with Glóin, Legolas and Denethor (the same spheres) and
// the briefing's threat penalty; the second seat keeps Wisdom and Wizardry. Two-handed, Easy, the auto-player's answers,
// every intent up to the loss.
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
  if (base.type === "Commit") {
    const ids = legalTargets(state, { type: "Commit" }, ctx).filter(() => random() < 0.6);
    return ids.length > 0 ? { type: "Commit", cardIds: ids } : { type: "Pass" };
  }
  if (base.type === "CommitHide") return { type: "CommitHide", cardIds: legalTargets(state, { type: "CommitHide" }, ctx) };
  if (state.window?.kind === "defense" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender")) {
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx);
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
  const random = generator(12345);
  for (let attempt = 0; attempt < 20000; attempt += 1) {
    const seed = 1 + (attempt % 40);
    const { state: start, ctx } = opened(2, loadout, seed);
    let state = start;
    const intents: PlayerIntent[] = [];
    const memory = new Set<string>();
    for (let turn = 0; turn < 3000 && !state.lost && state.window?.kind !== "resolution"; turn += 1) {
      const intent = varied(state, ctx, random, memory);
      const result = reduce(state, intent, ctx);
      if (!result.ok) throw new Error(`The search sent a refused intent: ${result.reason}`);
      state = result.state;
      intents.push(intent);
    }
    if (state.window?.kind === "resolution") {
      console.log(`won: seed ${seed}, attempt ${attempt}, ${intents.length} intents, round ${state.round}`);
      return { seed, loadout, intents };
    }
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

function playKnifeLoss(log: CampaignLog): { seed: number; loadout: StoredLoadout; intents: PlayerIntent[] } {
  const knife = loadScenario("a-knife-in-the-dark");
  const loadout: StoredLoadout = {
    scenarioId: knife.id,
    difficulty: "Easy",
    seats: [
      { deckId: "stealth-and-steadfastness", heroes: ["01003", "01005", "01010"], deck: stealth.deck },
      { deckId: "wisdom-and-wizardry", heroes: wisdom.heroes, deck: wisdom.deck },
    ],
    ringBearer: FRODO,
    choices: [],
    acceptPenalty: true,
  };
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
