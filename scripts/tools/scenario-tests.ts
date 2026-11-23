import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Effect } from "../../src/catalog/boundary.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { parseArgs } from "../cli-args.ts";
import { loadAnyScenario } from "../data/load-scenarios.ts";
import { ROOT } from "../data/paths.ts";
import { keyOf } from "../data/printed/ledger.ts";
import { loadRenderEnv, type RenderEnv } from "../data/effects/render/scenario.ts";
import { namedInTests } from "../checks/tracked.ts";
import { runScript, type Log } from "../log.ts";
import { scenarioCodes, unnamedOfScenario } from "./test-scenario.ts";

// Writes the row stubs a scenario's spec file lacks, for the moment after Build (docs/agents/agent-brief.md, Scenario procedure; `pnpm scenario new` runs before the records exist):
//
//   pnpm scenario tests <scenario-id> [--dry-run]
//
// One stub for each record of the scenario's cards that no test names (scripts/checks/line-coverage.ts, unnamedRecords: not by the record's id, not by one of its lines), grouped by
// card, in src/campaign/scenarios/<id>/spec.test.ts (created when the file is missing, else extended before the end of its ROWS array). Records that share a line share a stub. A stub is a
// row with a `todo` (test/harness/card-spec.ts, stubProblem): `cardSpecs` fails it, so `pnpm test scenario <id>` fails while one is left, and the stub cannot be committed as a test. It
// names its line id, so the next run writes nothing for it: a row or test that exists is never replaced.

export const SCENARIO_TESTS_USAGE = "usage: pnpm scenario tests <scenario-id> [--dry-run]";

export type Stub = { line: string; code: string; cardName: string; records: { id: string; timing: string }[]; text: string };

/** The stubs for the records that no test names: `unnamed` is their ids, `textOf` a line id's printed text, `nameOf` a card code's name. One stub for each first line; a record whose lines a stub already holds joins it. */
export function stubsFor(effects: readonly Effect[], unnamed: readonly string[], textOf: (line: string) => string | undefined, nameOf: (code: string) => string): Stub[] {
  const wanted = new Set(unnamed);
  const stubs: Stub[] = [];
  for (const effect of effects.filter((one) => wanted.has(one.id))) {
    const line = effect.lines[0] ?? effect.id;
    const held = stubs.find((stub) => effect.lines.includes(stub.line));
    if (held) {
      held.records.push({ id: effect.id, timing: effect.timing });
      continue;
    }
    stubs.push({ line, code: effect.cardCode, cardName: nameOf(effect.cardCode), records: [{ id: effect.id, timing: effect.timing }], text: textOf(line) ?? "(no printed line in the ledger)" });
  }
  return stubs.sort((a, b) => (a.code === b.code ? a.line.localeCompare(b.line, "en", { numeric: true }) : a.code.localeCompare(b.code, "en", { numeric: true })));
}

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

/** The text of the stubs, as rows of a ROWS array, a heading comment for each card. */
export function renderStubs(stubs: readonly Stub[]): string {
  const out: string[] = [];
  let card = "";
  for (const stub of stubs) {
    if (stub.code !== card) {
      if (card !== "") out.push("");
      out.push(`  // ${stub.code} ${stub.cardName}.`);
      card = stub.code;
    }
    const timings = [...new Set(stub.records.map((record) => record.timing))].join(", ");
    out.push(`  // ${stub.line} printed: ${oneLine(stub.text)}`);
    out.push(`  // records ${stub.records.map((record) => record.id).join(", ")}; timing ${timings}`);
    const todo = `write the row from the printed line (${stub.records.length} record${stub.records.length === 1 ? "" : "s"}, timing ${timings})`;
    out.push(`  { line: ${JSON.stringify(stub.line)}, name: ${JSON.stringify(oneLine(stub.text).slice(0, 70))}, todo: ${JSON.stringify(todo)}, layout: {}, act: [], expect: [] },`);
  }
  return out.join("\n");
}

const ROWS_START = /^(export )?const ROWS: readonly Row\[\] = \[(\];)?$/m;

/** The spec file with `block` (rows) added before the end of its ROWS array, or null when the file has no `const ROWS: readonly Row[] = [` array to extend. */
export function extendSpec(source: string, block: string): string | null {
  const start = ROWS_START.exec(source);
  if (!start) return null;
  if (start[2]) return `${source.slice(0, start.index)}${start[0].slice(0, -2)}\n${block}\n];${source.slice(start.index + start[0].length)}`;
  const close = /^\];$/m.exec(source.slice(start.index + start[0].length));
  if (!close) return null;
  const at = start.index + start[0].length + close.index;
  const before = source.slice(0, at);
  return `${before}${before.endsWith("\n\n") || before.endsWith("[\n") ? "" : "\n"}${block}\n${source.slice(at)}`;
}

/** A spec file for a scenario that has none: the rows, then the runner. */
export function newSpecFile(id: string, name: string, block: string): string {
  return `// Rules: TODO name the rule ids the rows exercise (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for ${name}: one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// \`cardSpecs\` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
const ROWS: readonly Row[] = [
${block}
];

if (ROWS.length > 0) cardSpecs("${id}", ROWS);
else describe("${id} card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
`;
}

export type Plan = { file: string; text: string; stubs: Stub[]; created: boolean } | { file: string; stubs: []; problem: string | null };

/** What a run writes: the stubs for the unnamed records, in the spec file `source` holds (null: none yet). */
export function planTests(id: string, name: string, source: string | null, stubs: readonly Stub[]): Plan {
  const file = `src/campaign/scenarios/${id}/spec.test.ts`;
  if (stubs.length === 0) return { file, stubs: [], problem: null };
  const block = renderStubs(stubs);
  if (source === null) return { file, text: newSpecFile(id, name, block), stubs: [...stubs], created: true };
  const text = extendSpec(source, block);
  if (text === null) return { file, stubs: [], problem: `${file} has no \`const ROWS: readonly Row[] = [\` array to extend: add the rows by hand` };
  return { file, text, stubs: [...stubs], created: false };
}

function textFrom(env: RenderEnv): (line: string) => string | undefined {
  return (line) => {
    const [code = "", side = "", n = ""] = line.split(":");
    return env.ledger.byKey.get(keyOf(code, side))?.lines[Number(n) - 1];
  };
}

function main(log: Log): void {
  const parsed = parseArgs(process.argv.slice(2), SCENARIO_TESTS_USAGE, { flags: ["dry-run"] });
  if (parsed.help) {
    log.info(SCENARIO_TESTS_USAGE);
    return;
  }
  const id = parsed.positional[0];
  if (id === undefined || parsed.positional.length > 1) throw new Error(SCENARIO_TESTS_USAGE);
  const dry = parsed.flags.has("dry-run");
  const scenario = loadAnyScenario(id);
  const env = loadRenderEnv();
  const unnamed = unnamedOfScenario(scenarioCodes(id), EFFECTS, namedInTests());
  const stubs = stubsFor(EFFECTS, unnamed, textFrom(env), (code) => env.byCode.get(code)?.name ?? code);
  const target = path.join(ROOT, `src/campaign/scenarios/${id}/spec.test.ts`);
  const plan = planTests(id, scenario.name, existsSync(target) ? readFileSync(target, "utf8") : null, stubs);
  if ("problem" in plan) {
    if (plan.problem) {
      log.error(plan.problem);
      process.exitCode = 1;
    } else log.info(`${id}: every record of the scenario's cards is named by a test; nothing to write`);
    return;
  }
  log.info(`${dry ? "would write" : "writing"} ${plan.stubs.length} stubs for ${new Set(plan.stubs.map((stub) => stub.code)).size} cards to ${plan.file}${plan.created ? " (new file)" : ""}:`);
  for (const stub of plan.stubs) log.info(`  ${stub.line}  ${stub.cardName}  [${stub.records.map((record) => record.timing).join(", ")}]  ${oneLine(stub.text).slice(0, 90)}`);
  if (!dry) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, plan.text);
    log.info("each stub fails `pnpm test scenario` until its row is written and its `todo` deleted");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("scenario:tests", main, { done: false });
