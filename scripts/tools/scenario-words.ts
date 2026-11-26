import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Effect } from "../../src/catalog/boundary.ts";
import { scenarioDefinition } from "../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { ASKS_BY_SCENARIO } from "../../src/play/words/asks/index.ts";
import { askKey, type Ask, type AsksTable } from "../../src/play/words/asks.ts";
import type { ChoiceNames } from "../../src/play/words/choice.ts";
import { blankScenario } from "../../src/rules/core/state.ts";
import type { ReduceContext } from "../../src/rules/interpret/interpret.ts";
import { walk } from "../../test/harness/record-walk.ts";
import { WORDS_SCENARIOS } from "../../test/harness/words-scenarios.ts";
import { askRows, entryProblems, renderedEntry, tailsOf, type AskRow, type WordsTable } from "../../test/harness/words-judge.ts";
import { parseArgs } from "../cli-args.ts";
import { loadRenderEnv } from "../data/effects/render/scenario.ts";
import { loadCards } from "../data/load-cards.ts";
import { dealtCodes, loadAnyScenario, loadCampaigns, loadScenarios } from "../data/load-scenarios.ts";
import { ROOT } from "../data/paths.ts";
import { printedLine } from "../data/printed/ledger.ts";
import { runScript, verbose, type Log } from "../log.ts";
import { scenarioCodes } from "./test-scenario.ts";

// What the Words task owes a scenario (docs/agents/agent-brief.md, Scenario procedure, step 5), as a checklist to work down:
//
//   pnpm scenario words <scenario-id> [--write | --dry-run]
//
// 1. Every Pick and Choose of the records of the cards the scenario deals (the walk and the verdicts of `pnpm test scenario <id> --words`: test/harness/words-judge.ts, askRows), with its entry in
//    src/play/words/asks/<id>.ts and a status (`STATUS_MEANING` below says what each means). An entry that names no record path is `ORPHAN`.
// 2. The Table step, as far as code can tell: the widgets the scenario's definition declares and whether the table reads each, the readout files that name the scenario's id, the setup records to check by hand, the
//    scenario file's Table section, and the table test.
// `--write` adds a stub entry (the key, the printed line as a comment, a `todo`) for each MISSING row (with `--all`, each `review` and `chain` row too), never touching an entry that exists, so a second run writes nothing. The stub fails the asks test of the scenario
// (`entryProblems`, test/harness/words-judge.ts) until it is filled and its `todo` deleted. `--dry-run` lists what `--write` would add.

export const SCENARIO_WORDS_USAGE = "usage: pnpm scenario words <scenario-id> [--write | --dry-run] [--all]";

/** What each status of a row means: the one definition (the header and docs/development.md, Commands, point here). */
export const STATUS_MEANING = {
  ok: "an entry that breaks no rule",
  breaks: "an entry that breaks a rule of docs/design-system-table.md, Choice tray (the words tests check them), or is a todo stub",
  MISSING: "no entry, and the scenario's words test fails without one",
  review: "no entry, the families' words pass and only this scenario deals the card: the author judges whether the family's sentence names the result (docs/agents/cycle-procedure.md, What each task is held to, Words)",
  chain: "no entry, the families' words pass and another playable or scaffolded scenario deals the card too: an entry is optional",
  optional: "a Choose's own sentence, which the sheet's lead can say",
  ORPHAN: "an entry that names no record path of a card the scenario deals",
} as const;
export type Status = keyof typeof STATUS_MEANING;
export type Line = { key: string; status: Status; detail: string; printed: string };

/** The status of one row: the entry's own problems when it has one; with none, MISSING when the words test fails on the families' words, else `review` for a card only this scenario deals (`own`) and `chain` for one another scenario deals too. */
export function statusOf(row: Pick<AskRow, "kind" | "verdict">, entry: Ask | undefined, entryFaults: readonly string[], own = false): { status: Status; detail: string } {
  if (entry) return entryFaults.length > 0 || (row.verdict?.problem ?? null) !== null ? { status: "breaks", detail: [...entryFaults, ...(row.verdict?.problem ? [row.verdict.problem] : [])].join("; ") } : { status: "ok", detail: "" };
  if (row.kind === "choose") return { status: "optional", detail: "no sentence entry: the sheet's own lead says it" };
  const said = row.verdict ? row.verdict.line.slice(row.verdict.key.length + 2) : "";
  if (row.verdict?.problem) return { status: "MISSING", detail: `the words test fails: ${row.verdict.problem}` };
  return own ? { status: "review", detail: `a card only this scenario deals: judge whether the families' sentence "${said}" names the result, else write the entry (--all stubs it)` } : { status: "chain", detail: `the families say "${said}", the words test passes and another scenario deals the card: an entry is optional (--all stubs it)` };
}

// The statuses that are work to do: a `chain` or `optional` row needs nothing unless the author chooses to write the entry.
const OPEN: readonly Status[] = ["MISSING", "review", "breaks", "ORPHAN"];

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

/** The stub text for the MISSING rows, grouped by record: a comment with the record and its printed line, then one entry for each key. */
export function renderWordsStubs(rows: readonly { key: string; kind: AskRow["kind"]; effectId: string; cardName: string; timing: string; printed: string }[]): string {
  const out: string[] = [];
  let record = "";
  for (const row of rows) {
    if (row.effectId !== record) {
      out.push(`  // ${row.effectId} (${row.cardName}, ${row.timing}): ${oneLine(row.printed)}`);
      record = row.effectId;
    }
    const todo = row.kind === "branch" ? "write the row label from the printed line" : "write the sentence and the verb from the printed line";
    out.push(`  ${JSON.stringify(row.key)}: { todo: ${JSON.stringify(todo)} },`);
  }
  return out.join("\n");
}

/** The asks file's text with `block` added before the closing `};` of its ASKS table. A table on one line, as `pnpm scenario new` writes it (`= {};` or `= { ...SHARED };`), is opened first. Throws, naming `file`, when the file has no `export const ASKS ... = {` table or the table does not end with a line `};` (the first line that starts in column 0 after the opening). */
export function extendAsks(file: string, source: string, block: string): string {
  const oneLine = /^(export const ASKS\b[^\n]*= )\{([^\n]*)\};$/m.exec(source);
  if (oneLine) {
    const spread = (oneLine[2] ?? "").split(",").map((part) => part.trim()).filter((part) => part !== "");
    const opened = `${oneLine[1]}{\n${spread.map((part) => `  ${part},\n`).join("")}};`;
    return extendAsks(file, `${source.slice(0, oneLine.index)}${opened}${source.slice(oneLine.index + oneLine[0].length)}`, block);
  }
  const start = /^export const ASKS\b[^\n]*= \{$/m.exec(source);
  if (!start) throw new Error(`${file} has no \`export const ASKS ... = {\` table to extend: add the entries by hand`);
  const from = start.index + start[0].length;
  const close = /^\S[^\n]*$/m.exec(source.slice(from));
  if (!close || close[0] !== "};") throw new Error(`${file}: the ASKS table does not end with a line \`};\` (the first line in column 0 after it is ${close ? JSON.stringify(close[0]) : "missing"}): add the entries by hand`);
  const at = from + close.index;
  return `${source.slice(0, at)}${block}\n${source.slice(at)}`;
}

/** A new asks file for a scenario that has none (`pnpm data build` adds it to the barrel). */
export function newAsksFile(id: string, name: string, block: string): string {
  return `import type { Ask } from "../asks.ts";

// The choice words of ${name}, one entry for each Pick and Choose of its records: \`<record id> @<instruction path> <verb | option id>\` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// \`pnpm test scenario ${id} --words\` fails on a Pick or Choose with neither an entry nor words of its own, and \`WORDS_DUMP=${id}\` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
${block}
};
`;
}

// The src files (not tests) whose text a widget flag or a scenario id is searched in.
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

export type TableRow = { what: string; state: "wired" | "NOT READ" | "found" | "check by hand" | "missing" | "ok"; detail: string };

/** The Table step rows `code` can answer. `files` is the source text by path; `widgets` the definition's declared widgets; `setup` the scenario's setup records with their printed lines. */
export function tableRows(input: { id: string; widgets: Readonly<Record<string, unknown>>; files: ReadonlyMap<string, string>; setup: readonly { id: string; printed: string }[]; doc: string | null; tableTest: boolean; dialsSource: string }): TableRow[] {
  const rows: TableRow[] = [];
  const declared = Object.entries(input.widgets).filter(([key, value]) => key !== "hide" && value !== false && value !== undefined);
  for (const [key] of declared) {
    const readers = [...input.files].filter(([file, text]) => /src\/(play|screens)\//.test(file) && new RegExp(`\\b${key}\\b`).test(text)).map(([file]) => file);
    rows.push(readers.length > 0 ? { what: `widget ${key}`, state: "wired", detail: `read in ${readers.slice(0, 3).join(", ")}` } : { what: `widget ${key}`, state: "NOT READ", detail: "the definition declares it and no file of src/play or src/screens reads it" });
  }
  if (declared.length === 0) rows.push({ what: "declared widgets", state: "ok", detail: "none declared (definition.widgets)" });
  const keyed = [...input.files].filter(([file, text]) => /src\/play\/(readouts|words\/scenarios|scenarios)\//.test(file) && text.includes(`"${input.id}"`)).map(([file]) => file);
  const dialed = keyed.filter((file) => input.dialsSource.includes(`/${path.basename(file, ".ts")}.ts"`));
  rows.push(keyed.length > 0 ? { what: "readout files that name the scenario id", state: "found", detail: `${keyed.join(", ")}${dialed.length > 0 ? `; in scenario-dials.ts: ${dialed.join(", ")}` : "; none is imported by scenario-dials.ts"}` } : { what: "readout files that name the scenario id", state: "check by hand", detail: "none: a hook may key on the records' verbs instead (the readout, the held dial for each seat, the held card under its host, the owner named on a cross-seat pick)" });
  for (const record of input.setup) rows.push({ what: `setup record ${record.id}`, state: "check by hand", detail: `does it create a tracker, zone or held card? ${oneLine(record.printed).slice(0, 110)}` });
  if (input.doc === null) rows.push({ what: "scenario file", state: "missing", detail: `no docs/scenarios/<box>/${input.id}.md` });
  else {
    const section = /^## Table$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(input.doc)?.[1];
    if (section === undefined) rows.push({ what: "scenario file Table section", state: "missing", detail: "no `## Table` heading: cite each piece's line there" });
    else {
      const uncited = input.setup.filter((record) => !section.includes(record.id.replace(/:(setup):(\d+)$/, ":")) && !section.includes(record.id.split(":")[0] ?? "")).map((record) => record.id);
      rows.push({ what: "scenario file Table section", state: uncited.length > 0 ? "check by hand" : "ok", detail: uncited.length > 0 ? `setup records of cards it never names: ${uncited.join(", ")}` : "names the card of every setup record" });
    }
  }
  rows.push(input.tableTest ? { what: "table test", state: "ok", detail: `src/play/scenarios/${input.id}-table.test.ts exists` } : { what: "table test", state: "missing", detail: `src/play/scenarios/${input.id}-table.test.ts does not exist` });
  return rows;
}

function main(log: Log): void {
  const parsed = parseArgs(process.argv.slice(2), SCENARIO_WORDS_USAGE, { flags: ["write", "dry-run", "all"] });
  if (parsed.help) {
    log.info(SCENARIO_WORDS_USAGE);
    return;
  }
  const id = parsed.positional[0];
  if (id === undefined || parsed.positional.length > 1) throw new Error(SCENARIO_WORDS_USAGE);
  const write = parsed.flags.has("write");
  if (write && parsed.flags.has("dry-run")) throw new Error(`--write and --dry-run exclude each other.\n${SCENARIO_WORDS_USAGE}`);
  const scenario = loadAnyScenario(id);
  const campaigns = loadCampaigns();
  const campaign = campaigns.find((one) => one.scenarios.includes(id)) ?? campaigns[0]!;
  const cards = new Map(loadCards().map((card) => [card.code, card]));
  const names: ChoiceNames = { card: (key) => cards.get(key)?.name ?? key, code: (code) => cards.get(code)?.name ?? code };
  const definition = scenarioDefinition(scenario, campaign, EFFECTS);
  const game = blankScenario({ seatCount: 2, seed: 1, definition });
  const ctx: ReduceContext = { effects: EFFECTS, cards: new Map() };
  const t: WordsTable = { game, ctx, names };
  const codes = dealtCodes(campaigns, [scenario], { nightmare: true });
  const records = EFFECTS.filter((effect) => codes.has(effect.cardCode));
  const env = loadRenderEnv();
  const asks: AsksTable = ASKS_BY_SCENARIO[id] ?? {};
  const printedOf = (effect: Effect): string => printedLine(env.ledger, effect.lines[0] ?? "") ?? "(no printed line in the ledger)";

  // Part 1: the rows, and each existing entry rendered as the sheet renders it.
  const rows = askRows(t, records);
  const faults = new Map<string, string[]>();
  const paths = new Set<string>();
  for (const effect of records) {
    walk(effect.instructions, (instruction, next, _after, at) => {
      for (const tail of tailsOf(instruction)) {
        paths.add(askKey(effect.id, at, tail));
        const rendered = renderedEntry(t, effect, instruction, next, at, tail, asks);
        if (rendered) faults.set(rendered.key, rendered.problems.map((problem) => problem.slice(problem.indexOf(": ") + 2)));
      }
    });
  }
  // A card is the scenario's own when no other playable or scaffolded scenario deals it (WORDS_SCENARIOS, the ones the words test reads): its words are this file's to judge, while a shared card's may be left to the families or to the other scenario's file.
  const elsewhere = new Set(loadScenarios().filter((other) => other.id !== id && WORDS_SCENARIOS.includes(other.id)).flatMap((other) => [...dealtCodes(campaigns, [other], { nightmare: true })]));
  const lines: Line[] = rows.map((row) => {
    const entry = asks[row.key];
    const own = entry ? [...entryProblems(row.key, entry).map((problem) => problem.slice(row.key.length + 2)), ...(faults.get(row.key) ?? [])] : [];
    return { key: row.key, ...statusOf(row, entry, own, !elsewhere.has(row.effect.cardCode)), printed: printedOf(row.effect) };
  });
  for (const key of Object.keys(asks)) if (!paths.has(key)) lines.push({ key, status: "ORPHAN", detail: "names no record path of a card the scenario deals", printed: "" });

  const count = (status: Status): number => lines.filter((line) => line.status === status).length;
  log.info(`${id}: ${lines.length - count("ORPHAN")} Picks and Choose rows over ${records.length} records. ${(Object.keys(STATUS_MEANING) as Status[]).map((status) => `${status} ${count(status)}`).join(", ")}`);
  log.info(`Asks (src/play/words/asks/${id}.ts), work down the lines marked [ ]:`);
  for (const line of lines) {
    const open = OPEN.includes(line.status);
    if (!open && !verbose()) continue;
    log.info(`  [${open ? " " : "x"}] ${line.status.padEnd(8)} ${line.key}${line.detail ? `  <- ${line.detail}` : ""}${open && line.printed ? `\n               printed: ${oneLine(line.printed).slice(0, 130)}` : ""}`);
  }
  if (!verbose()) log.info(`  (${lines.filter((line) => !OPEN.includes(line.status)).length} rows that need nothing are left out: --verbose lists them)`);

  // Part 2: the Table step.
  const files = new Map<string, string>();
  for (const dir of ["src/play", "src/screens"]) for (const file of sourceFiles(path.join(ROOT, dir))) files.set(path.relative(ROOT, file), readFileSync(file, "utf8"));
  const docFile = readdirSync(path.join(ROOT, "docs/scenarios")).map((box) => path.join(ROOT, "docs/scenarios", box, `${id}.md`)).find((file) => existsSync(file));
  const own = scenarioCodes(id);
  const setup = EFFECTS.filter((effect) => own.has(effect.cardCode) && effect.timing === "setup").map((effect) => ({ id: effect.id, printed: printedOf(effect) }));
  const table = tableRows({ id, widgets: definition.widgets, files, setup, doc: docFile ? readFileSync(docFile, "utf8") : null, tableTest: existsSync(path.join(ROOT, `src/play/scenarios/${id}-table.test.ts`)), dialsSource: files.get("src/play/readouts/scenario-dials.ts") ?? "" });
  log.info("The Table step (docs/agents/agent-brief.md, Scenario procedure), as far as code can tell:");
  for (const row of table) log.info(`  [${row.state === "NOT READ" || row.state === "missing" || row.state === "check by hand" ? " " : "x"}] ${row.state.padEnd(13)} ${row.what}: ${row.detail}`);

  // --write: a stub for each MISSING row (with --all, each review and chain row too).
  const all = parsed.flags.has("all");
  const missing = rows.filter((row) => ((status) => status === "MISSING" || (all && (status === "review" || status === "chain")))(lines.find((line) => line.key === row.key)?.status));
  const target = path.join(ROOT, `src/play/words/asks/${id}.ts`);
  const stubs = renderWordsStubs(missing.map((row) => ({ key: row.key, kind: row.kind, effectId: row.effect.id, cardName: names.code(row.effect.cardCode), timing: row.effect.timing, printed: printedOf(row.effect) })));
  if (missing.length === 0) {
    log.info(write || parsed.flags.has("dry-run") ? "nothing to write: no row to stub" : "no row to stub");
    return;
  }
  if (!write) {
    log.info(`${parsed.flags.has("dry-run") ? "would write" : "--write would add"} ${missing.length} stub entries to src/play/words/asks/${id}.ts:`);
    for (const row of missing) log.info(`  ${row.key}`);
    return;
  }
  const source = existsSync(target) ? readFileSync(target, "utf8") : null;
  const file = `src/play/words/asks/${id}.ts`;
  const text = source === null ? newAsksFile(id, scenario.name, stubs) : extendAsks(file, source, stubs);
  writeFileSync(target, text);
  log.info(`wrote ${missing.length} stubs to src/play/words/asks/${id}.ts${source === null ? " (new file: run pnpm data build to list it in the barrel)" : ""}; each fails \`pnpm test scenario ${id} --words\` until its todo is replaced by the words`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("scenario:words", main, { done: false });
