// The skeleton files `pnpm scenario:new` writes (scripts/tools/scenario-new.ts). Each function returns one file's text from the plan's facts.
// A skeleton compiles, passes lint and leaves the suite green: its golden test is a skipped suite and its campaign test one real check and some
// todos, until the person filling it in removes the markers. Every TODO marker names what the scenario still has to say.

export type PreviousPart = {
  id: string;
  name: string;
  /** The names the previous part's game module exports, read from test/harness/golden-registry.ts (null when it is not registered). */
  game: { alias: string; goldens: string; world: string; play: string } | null;
  /** The previous part's seed finder: the function that returns the log of the parts before it (null when it exports none). */
  finder: { exists: boolean; earlierLog: string | null };
};

export type Facts = {
  id: string;
  name: string;
  /** The short name every identifier and fixture name starts from ("ruins" for the-drowned-ruins). */
  short: string;
  campaignId: string;
  /** The part's place in the campaign, from 1. */
  part: number;
  previous: PreviousPart | null;
  campaignCard: string;
  stages: readonly string[];
  /** [key, code, card name] for every card the scenario deals, its campaign card and the cards that card places. */
  codes: readonly (readonly [string, string, string])[];
};

export const pascal = (short: string): string => short.replace(/(^|-)([a-z0-9])/g, (_, _dash: string, letter: string) => letter.toUpperCase());
export const camel = (short: string): string => {
  const word = pascal(short);
  return word.charAt(0).toLowerCase() + word.slice(1);
};
const upper = (short: string): string => short.toUpperCase().replace(/-/g, "_");

/** test/scenarios/<id>/scene.ts */
export function sceneFile(facts: Facts): string {
  const P = pascal(facts.short);
  const c = camel(facts.short);
  const codes = facts.codes.map(([key, code, name]) => `  ${key}: "${code}", // ${name.replace(/\n/g, " ")}`).join("\n");
  const stages = facts.stages.map((code) => `"${code}"`).join(", ");
  return `import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { blankScenario, updateCard, withThreat } from "../../../src/rules/core/state.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { spawn } from "../../../src/rules/core/zones.ts";

import { gameCodes, loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { addStandIns, entry, fightEnemy, HERO, HERO2, HERO3, opening, sceneEffects, type Entry, type Fight, type FightOptions, type Run, type ScenePhase } from "../../harness/scene-kit.ts";

// Shared scene for the ${facts.name} effect tests (${facts.campaignId} part ${facts.part}, campaign card ${facts.campaignCard}). Test-only. The heroes are plain numbers (no player card text), so what a test shows comes from
// the scenario's records and the engine. The helpers every scene shares (id lookups, answers, the fight) are test/harness/scene-kit.ts; this file keeps the scenario's codes, its layout and its table.
// TODO: describe the cards that need their own layout fields (a second active location, a grotto deck, an island map) and add them to the layout and the table below.
export const ${c}: ScenarioData = loadScenario("${facts.id}");
export const campaign: CampaignData = loadCampaign("${facts.campaignId}");
export const dealt: ScenarioData = campaignScenario(${c});

export const STAGES = [${stages}] as const;
// Read from data/scenarios/${facts.id}.json and data/cards: the cards the scenario deals, the campaign card and the cards it places. Rename a key for what a test says.
export const CODES = {
${codes}
} as const;
export { HERO, HERO2, HERO3 };
export type { Entry };

const SCENE_EFFECTS = sceneEffects();

export type ${P}World = { definition: ReturnType<typeof scenarioDefinition>; cards: Map<string, PrintedCard> };

export async function load${P}World(): Promise<${P}World> {
  const definition = scenarioDefinition(dealt, campaign, EFFECTS);
  const codes = [...new Set([...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, ${c})])];
  const cards = new Map(await loadPrinted(codes));
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  return { definition, cards };
}

export type ${P}Layout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: (typeof STAGES)[number];
  progress?: number;
  // The encounter deck (top first), its discard pile, the staging area, the cards set aside, the victory display.
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly Entry[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly (Entry | { code: string; seat: number; damage?: number; resources?: number })[];
  hand?: readonly string[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: ScenePhase;
  threat?: readonly [number, number];
  // The campaign card is on the table (a campaign game), as the Campaign Setup leaves it.
  campaign?: boolean;
};

export type ${P}Table = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null };

export function ${c}Table(world: ${P}World, layout: ${P}Layout = {}): ${P}Table {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? STAGES[0];
  const ctx: ReduceContext = { effects: SCENE_EFFECTS, cards: world.cards };
  let state = blankScenario({ seatCount: seats, seed: layout.seed ?? 3, definition: world.definition });
  const at = STAGES.indexOf(stage);
  for (const code of STAGES) {
    const index = STAGES.indexOf(code);
    const placed = index === at ? { zone: "questStage" as const } : index > at ? { zone: "questDeck" as const } : { zone: "setAside" as const };
    const spawned = spawn(state, code, placed, placed.zone === "questStage" ? "B" : "A");
    state = code === stage ? updateCard(spawned.state, spawned.id, { progress: layout.progress ?? 0 }) : spawned.state;
  }
  const first = spawn(state, HERO, { zone: "heroes", seat: 0 });
  const secondHero = spawn(first.state, HERO2, { zone: "heroes", seat: 0 });
  state = secondHero.state;
  let seat1Hero: string | null = null;
  if (seats === 2) {
    const other = spawn(state, HERO3, { zone: "heroes", seat: 1 });
    state = other.state;
    seat1Hero = other.id;
  }
  for (let seat = 0; seat < seats; seat += 1) state = withThreat(state, seat, layout.threat?.[seat] ?? 28);
  for (let seat = 0; seat < seats; seat += 1) {
    for (const code of layout.hand ?? []) state = spawn(state, code, { zone: "hand", seat }).state;
    for (const code of layout.deckOf ?? []) state = spawn(state, code, { zone: "deck", seat }, "down").state;
  }
  for (const code of layout.play ?? []) state = spawn(state, code, { zone: "play", seat: 0 }).state;
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  for (const item of layout.staging ?? []) {
    const row = entry(item);
    const spawned = spawn(state, row.code, { zone: "staging" });
    state = updateCard(spawned.state, spawned.id, { progress: row.progress, damage: row.damage, resources: row.resources });
  }
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }, "up").state;
  for (const row of layout.engaged ?? []) {
    const item = typeof row === "string" ? { code: row, seat: 0 } : row;
    const tokens = entry(item);
    const spawned = spawn(state, tokens.code, { zone: "engaged", seat: "seat" in item ? item.seat : 0 });
    state = updateCard(spawned.state, spawned.id, { damage: tokens.damage, resources: tokens.resources });
  }
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  if (layout.campaign) state = spawn(state, CODES.campaignCard, { zone: "campaign" }).state;
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero };
}

export { answer, codesIn, finish, idOf, idsOf, legalIntents, legalTargets, resolveRecords, send, start } from "../../harness/scene-kit.ts";
export type { Run, PlayerIntent };

/** An enemy engaged with the first seat attacks in the combat phase with \`shadow\` dealt to it, the first hero defending (or nobody). The state at the end of the attack. */
export function ${c}Fight(world: ${P}World, shadow: string, enemy: string, layout: ${P}Layout = {}, options: FightOptions<${P}Table> = {}): Fight<${P}Table> {
  return fightEnemy((made: ${P}Layout) => ${c}Table(world, made), shadow, enemy, layout, options);
}
`;
}

/** test/scenarios/<id>/game.ts */
export function gameFile(facts: Facts): string {
  const P = pascal(facts.short);
  const c = camel(facts.short);
  const U = upper(facts.short);
  const prev = facts.previous;
  const earlier = facts.part > 1 ? `  // TODO: the XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.\n  earlier: { xp: [${Array.from({ length: facts.part - 1 }, () => "0").join(", ")}], pool: [], marks: {} },\n` : "";
  const after = facts.part > 1 ? `export const after${pascal(prev ? (prev.game?.alias ?? prev.id) : "earlier")} = (seatCount: 1 | 2) => game.after(seatCount);\n` : "";
  return `import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { campaign, ${c} } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of ${facts.name} in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const ${U}_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type ${P}Decks = "strong" | "weak" | "brittle";

export const ${c}Loadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const ${c}World = (decks: ${P}Decks = "strong") => game.world(decks);
${after}export const ${c}Plan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const ${c}Start = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, facts, log, modeCard);

export type ${P}Policy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: ${P}Policy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// TODO: the scenario's own answers (where the players travel, who defends, which locations they explore) go before the auto-player's.
export function ${c}Intent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: ${P}Policy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, ${U}_POLICY, memory, legalIntents(state, ctx));
}

export type ${P}Game = PlayedGame;

// The goldens (src/campaign/scenarios/${facts.id}/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// \`after\`: the log of a campaign whose earlier parts were won. \`upgraded\`: the Upgraded sides. \`mode\`: the Hard or Expert Mode card.
export type ${P}Golden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: ${P}Decks; outcome: "won" | "lost"; policy?: Partial<${P}Policy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// TODO: the games to pin, a few wins (true solo and two-handed, Normal and Easy, a Mode card, after the earlier parts) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const ${U}_GOLDENS: readonly ${P}Golden[] = [];

const game = campaignGame<${P}Decks, ${P}Policy>({
  campaign,
  scenario: ${c},
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles, its campaign card's and the campaign's game codes.
  codes: [...${c}.cards.map((card) => card.code)],
  intent: ${c}Intent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
${earlier}});

export const playGolden = (golden: ${P}Golden, ctx: ReduceContext): ${P}Game => game.playGolden(golden, ctx);
`;
}

/** src/campaign/scenarios/<id>/golden.test.ts */
export function goldenTestFile(facts: Facts): string {
  const P = pascal(facts.short);
  const c = camel(facts.short);
  const U = upper(facts.short);
  return `// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect } from "vitest";

import { ${U}_GOLDENS, playGolden, ${c}World, type ${P}Decks, type ${P}Golden } from "../../../../test/scenarios/${facts.id}/game.ts";
import { campaign, ${c} } from "../../../../test/scenarios/${facts.id}/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of ${facts.name} in Campaign Mode played by the auto-player (test/scenarios/${facts.id}/game.ts) on fixed seeds, through a win and through each way to lose.
// TODO: say what the games cover. Update the snapshot only when the change is meant.
//
// Open until the goldens are chosen: the suite is skipped, so it writes no golden.json. To finish it, fill ${U}_GOLDENS, change \`describe.skip\` to \`describe\`, fill the TODOs below, run this file
// (it writes golden.json) and uncomment this scenario's two lines in test/harness/golden-registry.ts (its test fails on a golden.json that is not listed).
describe.skip("${facts.name} golden (open: scaffold)", () => {
  goldenSuite<${P}Golden, ${P}Decks>({
    title: "${facts.name}",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: ${c},
    goldens: ${U}_GOLDENS,
    world: ${c}World,
    play: playGolden,
    opening: {
      title: "TODO: starts with (the staging area, the cards set aside, the encounter deck, the quest stage)",
      check(state, golden) {
        // TODO: the opening the Setup leaves.
        expect(state.questStage, golden.name).toBeTruthy();
      },
    },
    wins: "TODO: wins when ..., runs ${facts.campaignCard}'s Resolution and unlocks the next part",
    won(state) {
      // TODO: the stage the game ended on and what the Resolution earned.
      expect(state.stageCleared).toBe(true);
    },
    // TODO: expectedXp(state, golden): what the campaign card's list awards, counted from the final state.
  });
});
`;
}

/** src/campaign/scenarios/<id>/campaign.test.ts */
export function campaignTestFile(facts: Facts): string {
  const c = camel(facts.short);
  return `// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { CODES, campaign, ${c} } from "../../../../test/scenarios/${facts.id}/scene.ts";

// ${facts.name} in the ${facts.campaignId} campaign (part ${facts.part}, campaign card ${facts.campaignCard}). The first check reads data/; the todos are what the campaign test of every
// scenario shows (src/campaign/scenarios/the-thing-in-the-depths/campaign.test.ts is the pattern). TODO: turn each into a test once the scenario's records exist.
describe("${facts.name} in the ${facts.campaignId} campaign", () => {
  it("is part ${facts.part} of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(${c}.id)).toBe(${facts.part - 1});
    expect(${c}.campaignCard).toBe(CODES.campaignCard);
  });

  it.todo("is playable (src/campaign/playable.ts), and the path offers it after the earlier parts");
  it.todo("deals the Campaign Setup: the cards the campaign card places, set aside as it says");
  it.todo("hands the previous parts to this one: the pool, the XP and the marks reach the game");
  it.todo("deals the original card in a standalone game, with no campaign card");
});
`;
}

/** scripts/e2e/<id>.ts */
export function seedFinderFile(facts: Facts): string {
  const P = pascal(facts.short);
  const c = camel(facts.short);
  const U = upper(facts.short);
  const prev = facts.previous;
  const dream = facts.campaignId === "dream-chaser";
  const withLog = facts.part > 1;
  const earlier = facts.part - 1;
  const parts = `${earlier} part${earlier === 1 ? " was" : "s were"}`;
  const imports: string[] = [];
  let logFunction = "";
  let logName = "";
  if (withLog) {
    const alias = prev?.game?.alias ?? "previous";
    logName = `${alias}WonLog`;
    if (prev?.game) {
      const play = prev.game.play === "playGolden" ? `playGolden as play${pascal(alias)}` : prev.game.play;
      const playName = prev.game.play === "playGolden" ? `play${pascal(alias)}` : prev.game.play;
      imports.push(`import { ${prev.game.goldens}, ${prev.game.world}, ${play} } from "../../test/scenarios/${prev.id}/game.ts";`);
      const before = prev.finder.exists && prev.finder.earlierLog ? prev.finder.earlierLog : null;
      if (before) imports.push(`import { ${before} } from "./${prev.id}.ts";`);
      logFunction = `// The log of a playthrough whose first ${parts} won: ${before ? `the log of the parts before ${prev.name} (scripts/e2e/${prev.id}.ts), then ` : ""}the ${prev.name} golden's two-handed win, resolved onto ${before ? "it" : "a blank log"}, their heroes and what hangs on them left out.
export async function ${logName}(): Promise<CampaignLog> {
  return wonLog({ title: "${prev.name}", goldens: ${prev.game.goldens}, world: ${prev.game.world}, play: ${playName} }${before ? `, await ${before}()` : ""});
}

`;
    } else {
      logFunction = `// TODO: the log of a playthrough whose first ${parts} won: \`wonLog\` (scripts/e2e/seed-kit.ts) of the previous part's golden, built on the log before it, as scripts/e2e/temple-of-the-deceived.ts does. The previous part
// (${prev ? prev.name : "none"}) is not in test/harness/golden-registry.ts, so its golden's names are not known here.
export async function ${logName}(): Promise<CampaignLog> {
  throw new Error("${facts.id}: the log of the earlier parts is not written yet");
}

`;
    }
  }
  // Dream-chaser finders share the Raid finder's answers; another campaign starts from the auto-player's default policy (a TODO to tune).
  imports.push(dream ? `import { intentFor } from "./raid-on-the-grey-havens.ts";` : `import { nextIntent } from "../../test/harness/auto-player.ts";`, `import { createLog } from "../log.ts";`, `import { ${dream ? "DREAM_CHASER, " : ""}firstSeed${withLog ? ", wonLog" : ""} } from "./seed-kit.ts";`);
  const campaignId = dream ? "DREAM_CHASER" : `"${facts.campaignId}"`;
  const answer = dream ? "intentFor" : "(state: ScenarioState, ctx: Parameters<typeof nextIntent>[1], memory: Set<string>) => nextIntent(state, ctx, { scout: \"\", prefer: \"\", protect: \"\", play: true, act: true }, memory)";
  return `// The Maestro fixtures of ${facts.name} (${facts.campaignId} part ${facts.part}), written into src/campaign/fixtures/${facts.id}.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. \`${facts.short}-won\` is the first seed that wins, parked on the win (the Resolution waits); \`${facts.short}-lost\` the first
// that loses, parked on the loss. A game not found in the seeds is left out.${withLog ? "\n// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it." : ""}
// TODO: say what the Campaign Setup and the Resolution ask, and which answers the saved decklists' policy gives them.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ScenarioState } from "../../src/rules/engine/reduce.ts";

${imports.join("\n")}

const say = createLog("e2e-${facts.short}");

export type ${P}Fixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]${withLog ? "; log: CampaignLog" : ""} };
export type ${P}FixtureName = "${facts.short}-won" | "${facts.short}-lost";

${logFunction}export async function ${c}Fixtures(): Promise<Partial<Record<${P}FixtureName, ${P}Fixture>>> {
${withLog ? `  const log = await ${logName}();\n` : ""}  const find = (wanted: (state: ScenarioState) => boolean, label: string): ${P}Fixture | null => {
    // TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
    const found = firstSeed(say, { campaignId: ${campaignId}, scenarioId: "${facts.id}", seatCount: 2,${withLog ? " log," : ""} answer: ${answer} }, "${U}_SEEDS", wanted, label);
    return found && ${withLog ? "{ ...found, log }" : "found"};
  };
  const won = find((state) => state.stageCleared && !state.lost, "${facts.short}-won");
  const lost = find((state) => state.lost, "${facts.short}-lost");
  return { ...(won ? { "${facts.short}-won": won } : {}), ...(lost ? { "${facts.short}-lost": lost } : {}) };
}
`;
}

const TODO_FLOW = (kind: "win" | "loss", facts: Facts): string =>
  `appId: com.middleearth.lcg
tags:
  - scenario
---
# TODO: the phase, and "Written in a cloud session: it has not run." Needs the e2e-test build (EXPO_PUBLIC_E2E_SEED=1, eas.json) and the fixture \`${facts.short}-${kind === "win" ? "won" : "lost"}\` (scripts/e2e/${facts.id}.ts): a real two-handed
# game of ${facts.name}, parked on its ${kind === "win" ? "win" : "loss"}. The fixture is OPEN until scripts/e2e/fixtures.ts finds a game of that kind in its seeds (docs/phases/STATUS.md).
# The steps are the shared subflow's (.maestro/subflows/scenario-${kind}.yaml); add this scenario's own assertions after the call.
`;

/** .maestro/scenarios/<id>/<id>.yaml */
export function winFlowFile(facts: Facts): string {
  return `${TODO_FLOW("win", facts)}- runFlow:
    file: ../../subflows/scenario-win.yaml
    env:
      FIXTURE: ${facts.short}-won
      SCENARIO_ID: ${facts.id}
      # A Resolution that asks one choice: the code of the card it offers, the choice's eyebrow text and the sentence the confirm line shows.
      # CHOICE_ID: "TODO"
      # CHOICE_PROMPT: "TODO"
      # CHOICE_CONSEQUENCE: "TODO"
# TODO: this scenario's own assertions on the path screen after the win (the next part's node, a carried card).
`;
}

/** .maestro/scenarios/<id>/<id>-loss.yaml */
export function lossFlowFile(facts: Facts): string {
  return `${TODO_FLOW("loss", facts)}- runFlow:
    file: ../../subflows/scenario-loss.yaml
    env:
      FIXTURE: ${facts.short}-lost
      SCENARIO_ID: ${facts.id}
# TODO: this scenario's own assertions on the log screen after the loss.
`;
}

/** src/effects/authored/<id>.ts */
export function authoredFile(facts: Facts): string {
  return `import type { Effect } from "../../catalog/boundary.ts";

// Records for ${facts.name} (${facts.campaignId} part ${facts.part}, campaign card ${facts.campaignCard}). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data:build) or another card prints
// word for word needs no record here. \`pnpm effects:draft ${facts.id}\` writes the bundle of open lines and the effect-author agent turns it into records.
// Rules: TODO name the rule ids the records implement (data/rules/entries.json).
// TODO: wrap the list in withCopies(...) from ./reprint.ts when a card takes the records of another card's identical line.
export const AUTHORED_EFFECTS: readonly Effect[] = [];

export const AUTHORED_REPLACES: readonly string[] = [];
`;
}
