import { camel, pascal, upper, type Facts } from "./scenario-new-files.ts";

// The skeleton files of `pnpm scenario new` for a scenario of a cycle (scripts/tools/scenario-new.ts).
// A scenario of a cycle (Shadows of Mirkwood) has no Campaign Mode: its game is the standalone game (test/harness/game-kit.ts, standaloneGame), its golden suite the standalone
// one (standalone: true), its test a standalone test, its fixtures one open standalone game each and its Maestro flows the standalone subflows.

// What the cycle's game and golden test import: the cycle and the scenario, read from data/ (no scene file, no campaign card).
const cycleImport = (depth: string): string => `import { loadAnyScenario, loadCampaign } from "${depth}scripts/data/load-scenarios.ts";`;
const cycleConsts = (facts: Facts, c: string): string => `const cycle = loadCampaign("${facts.campaignId}");\nconst ${c} = loadAnyScenario("${facts.id}");`;

/** test/scenarios/<id>/game.ts for a scenario of a cycle. */
export function cycleGameFile(facts: Facts): string {
  const P = pascal(facts.short);
  const c = camel(facts.short);
  const U = upper(facts.short);
  return `import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

${cycleImport("../../../")}
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

${cycleConsts(facts, c)}

// Test helper. A whole standalone game of ${facts.name} played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const ${U}_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type ${P}Decks = "strong" | "weak" | "brittle";

export const ${c}Loadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const ${c}World = (decks: ${P}Decks = "strong") => game.world(decks);
export const ${c}Start = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

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

// The goldens (src/campaign/scenarios/${facts.id}/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type ${P}Golden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: ${P}Decks; outcome: "won" | "lost"; policy?: Partial<${P}Policy>; lossReason?: string };

// TODO: the games to pin (at most 3000 intents in all, .claude/rules/code-standards.md, Test cost), a few wins (true solo and two-handed, Normal and Nightmare) and a few losses (each way the scenario can be lost), each on a fixed seed.
export const ${U}_GOLDENS: readonly ${P}Golden[] = [];

const game = standaloneGame<${P}Decks, ${P}Policy>({
  campaign: cycle,
  scenario: ${c},
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: [...${c}.cards.map((card) => card.code)],
  intent: ${c}Intent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: ${P}Golden, ctx: ReduceContext): ${P}Game => game.playGolden(golden, ctx);
`;
}

/** src/campaign/scenarios/<id>/golden.test.ts for a scenario of a cycle. */
export function cycleGoldenTestFile(facts: Facts): string {
  const P = pascal(facts.short);
  const c = camel(facts.short);
  const U = upper(facts.short);
  return `// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect } from "vitest";

import { ${U}_GOLDENS, playGolden, ${c}World, type ${P}Decks, type ${P}Golden } from "../../../../test/scenarios/${facts.id}/game.ts";
${cycleImport("../../../../")}
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

${cycleConsts(facts, c)}

// A permanent golden: whole standalone games of ${facts.name} played by the auto-player (test/scenarios/${facts.id}/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. TODO: say what the games cover. Update the snapshot only when the change is meant.
//
// Open until the goldens are chosen: the suite is skipped, so it writes no golden.json. To finish it, fill ${U}_GOLDENS, change \`describe.skip\` to \`describe\`, fill the TODOs below, run this file
// (it writes golden.json) and uncomment this scenario's two lines in test/harness/golden-registry.ts (its test fails on a golden.json that is not listed).
describe.skip("${facts.name} golden (open: scaffold)", () => {
  goldenSuite<${P}Golden, ${P}Decks>({
    title: "${facts.name}",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: ${c},
    standalone: true,
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
    wins: "TODO: wins when ..., settles with a score and earns nothing",
    won(state) {
      // TODO: the stage the game ended on.
      expect(state.stageCleared).toBe(true);
    },
  });
});
`;
}

/** scripts/e2e/<cycle folder>/<id>.ts for a scenario of a cycle. */
export function cycleSeedFinderFile(facts: Facts): string {
  const c = camel(facts.short);
  const U = upper(facts.short);
  const depth = facts.finderRel.split("/").length - 1;
  const e2e = depth === 0 ? "./" : "../".repeat(depth);
  const scripts = "../".repeat(depth + 1);
  const root = `${scripts}../`;
  return `// The Maestro fixtures of ${facts.name} (${facts.campaignId} cycle part ${facts.part}), written into src/campaign/fixtures/${facts.id}.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. \`${facts.short}-won\` is the first seed that wins, parked on the win (the outcome screen is one tap away); \`${facts.short}-lost\` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// TODO: say which answers the saved decklists' policy gives the scenario's questions.
import { nextIntent } from "${root}test/harness/auto-player.ts";
import { createLog } from "${scripts}log.ts";
import { standaloneWonLost } from "${e2e}seed-kit.ts";

const say = createLog("e2e-${facts.short}");

// TODO: the scenario's own answers in place of the saved decklists' policy, when the scenario needs them (scripts/e2e/temple-of-the-deceived.ts is the pattern).
export const ${c}Fixtures = async () => standaloneWonLost(say, "${facts.short}", { campaignId: "${facts.campaignId}", scenarioId: "${facts.id}", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "${U}_SEEDS");
`;
}

/** .maestro/scenarios/<id>/<id>.yaml and <id>-loss.yaml for a scenario of a cycle. */
export function cycleFlowFile(kind: "win" | "loss", facts: Facts): string {
  const name = kind === "win" ? "won" : "lost";
  return `appId: com.middleearth.player
tags:
  - scenario
---
# TODO: the phase, and "Written in a cloud session: it has not run." Needs the e2e-test build (EXPO_PUBLIC_E2E_SEED=1, eas.json) and the fixture \`${facts.short}-${name}\` (scripts/e2e/${facts.finderRel}.ts): a real two-handed
# standalone game of ${facts.name}, parked on its ${kind === "win" ? "win" : "loss"}. The fixture is OPEN until scripts/e2e/fixtures.ts finds a game of that kind in its seeds (docs/phases/STATUS.md).
# The steps are the shared subflow's (.maestro/subflows/standalone-${kind}.yaml); add this scenario's own assertions after the call.
- runFlow:
    file: ../../subflows/standalone-${kind}.yaml
    env:
      FIXTURE: ${facts.short}-${name}${kind === "win" ? `\n      SCENARIO_ID: ${facts.id}` : ""}
# TODO: this scenario's own assertions on the ${kind === "win" ? "outcome screen after the win (the score)" : "outcome screen after the loss (the reason)"}.
`;
}

/** src/campaign/scenarios/<id>/standalone.test.ts: what is a cycle scenario's own in the standalone game (the cycle checks are the golden suite's). */
export function standaloneTestFile(facts: Facts): string {
  return `// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, it } from "vitest";

// What is ${facts.name}'s own in the standalone game. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true).
// TODO: turn each into a test once the scenario's records exist.
describe("${facts.name} in the ${facts.campaignId} cycle", () => {
  it.todo("deals its Nightmare deck on Nightmare when every card of it has a record (src/campaign/playable.ts)");
});
`;
}

