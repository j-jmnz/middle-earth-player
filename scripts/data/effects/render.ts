import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { splitCodes } from "../../codes.ts";
import { runScript, type Log } from "../../log.ts";
import { PLAYABLE_SCENARIOS } from "../../../src/campaign/playable.ts";
import { loadRenderEnv, renderCodes, renderScenario, type Rendered } from "./render/scenario.ts";

// Usage: pnpm effects render <scenario-id | code,code,... | code code ...> [--out <file>] [--all-dealt]
//        pnpm effects render --all [--out <dir>]
// Prints each card's printed ledger lines with the effect records that name them rendered as plain English beneath, so a reader (the reading-judge agent,
// `.claude/agents/reading-judge.md`) checks each record against the line it implements. A piece with no template prints as compact JSON.
// A scenario id renders the cards that have a record in src/effects/authored/<scenario-id>.ts; --all-dealt renders every card the scenario deals.
// --all renders every scenario in src/campaign/playable.ts. Without --out it prints them one after another under a `# scenario <id>` heading; with --out <dir> it writes <dir>/<id>.txt for each, which is
// how a diff of a shared-template change is read: the committed snapshots under scripts/data/effects/render/snapshots/ are compared by render/snapshots.test.ts, and
// `pnpm effects render --all --out scripts/data/effects/render/snapshots` refreshes them (review the diff, then commit).

const USAGE = "Usage: effects render <scenario-id | code,code,... | code code ...> [--out <file>] [--all-dealt]  |  effects render --all [--out <dir>]";

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const out = outAt >= 0 ? args[outAt + 1] : undefined;
  const targets = args.filter((arg, at) => !arg.startsWith("--") && !(outAt >= 0 && at === outAt + 1));
  const env = loadRenderEnv();

  if (args.includes("--all")) {
    if (targets.length > 0) throw new Error(USAGE);
    const results: [string, Rendered][] = [];
    for (const id of PLAYABLE_SCENARIOS) results.push([id, await renderScenario(env, id, false, log)]);
    if (out) {
      mkdirSync(path.resolve(out), { recursive: true });
      for (const [id, rendered] of results) writeFileSync(path.join(out, `${id}.txt`), rendered.text);
      log.info(`wrote ${results.length} files to ${out}`);
    } else process.stdout.write(results.map(([id, rendered]) => `# scenario ${id}\n\n${rendered.text}`).join("\n"));
    log.info(`${results.reduce((sum, [, rendered]) => sum + rendered.tally.template, 0)} pieces by template, ${results.reduce((sum, [, rendered]) => sum + rendered.tally.json, 0)} as JSON`);
    return;
  }

  const pieces = splitCodes(targets);
  if (pieces.length === 0) throw new Error(USAGE);
  const rendered = pieces.every((piece) => env.byCode.has(piece)) ? renderCodes(env, pieces) : await renderScenario(env, pieces[0] ?? "", args.includes("--all-dealt"), log);
  if (out) {
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    writeFileSync(out, rendered.text);
    log.info(`wrote ${out}`);
  } else process.stdout.write(rendered.text);
  log.info(`${rendered.tally.template} pieces by template, ${rendered.tally.json} as JSON`);
}

runScript("effects:render", main);
