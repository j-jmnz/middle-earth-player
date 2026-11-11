// The skeleton files `pnpm scenario new` writes (scripts/tools/scenario-new.ts). Each function returns one file's text from the plan's facts.
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

// What the game, golden and campaign tests import: the campaign and the scenario, read from data/ (no scene file).
const dataImport = (depth: string): string => `import { loadCampaign, loadScenario } from "${depth}scripts/data/load-scenarios.ts";`;
const dataConsts = (facts: Facts, c: string): string => `const campaign = loadCampaign("${facts.campaignId}");\nconst ${c} = loadScenario("${facts.id}");`;

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

${dataImport("../../../")}
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

${dataConsts(facts, c)}

// Test helper. A whole game of ${facts.name} in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const ${U}_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type ${P}Decks = "strong" | "weak" | "brittle";

export const ${c}Loadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const ${c}World = (decks: ${P}Decks = "strong") => game.world(decks);
${after}export const ${c}Plan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const ${c}Start = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

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
${dataImport("../../../../")}
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

${dataConsts(facts, c)}

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

${dataImport("../../../../")}

${dataConsts(facts, c)}

// ${facts.name} in the ${facts.campaignId} campaign (part ${facts.part}, campaign card ${facts.campaignCard}). The first check reads data/; the todos are what the campaign test of every
// scenario shows (src/campaign/scenarios/the-thing-in-the-depths/campaign.test.ts is the pattern). TODO: turn each into a test once the scenario's records exist.
describe("${facts.name} in the ${facts.campaignId} campaign", () => {
  it("is part ${facts.part} of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(${c}.id)).toBe(${facts.part - 1});
    expect(${c}.campaignCard).toBe("${facts.campaignCard}");
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

// Records for ${facts.name} (${facts.campaignId} part ${facts.part}, campaign card ${facts.campaignCard}). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints
// word for word needs no record here. \`pnpm effects draft ${facts.id}\` writes the bundle of open lines and the effect-author agent turns it into records.
// Rules: TODO name the rule ids the records implement (data/rules/entries.json).
// TODO: wrap the list in withCopies(...) from ./reprint.ts when a card takes the records of another card's identical line.
export const AUTHORED_EFFECTS: readonly Effect[] = [];

export const AUTHORED_REPLACES: readonly string[] = [];
`;
}

/** src/play/words/asks/<id>.ts the scenario's choice words as data (src/play/words/asks.ts). pnpm data build adds it to the barrel. */
export function asksFile(facts: Facts): string {
  return `import type { Ask } from "../asks.ts";

// The choice words of ${facts.name} (${facts.campaignId} part ${facts.part}), one entry for each Pick and Choose of its records: \`<record id> @<instruction path> <verb | option id>\` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// \`pnpm test scenario ${facts.id} --words\` fails on a Pick or Choose with neither an entry nor words of its own, and \`WORDS_DUMP=${facts.id}\` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {};
`;
}

/** src/campaign/scenarios/<id>/spec.test.ts: the card spec rows (test/harness/card-spec.ts). */
export function specTestFile(facts: Facts): string {
  return `// Rules: TODO name the rule ids the rows exercise (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for ${facts.name} (${facts.campaignId} part ${facts.part}): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// \`cardSpecs\` runs each row again with the records of its line removed and fails a row that still passes (docs/handover/agent-brief.md, Scenario procedure, Finish).
// TODO: the rows; the todo below stands in until there is one.
const ROWS: readonly Row[] = [];

if (ROWS.length > 0) cardSpecs("${facts.id}", ROWS);
else describe("${facts.id} card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
`;
}
