// `pnpm game <list | show | log | diff>`: a saved game as text, for an agent debugging the engine (docs/development.md, Reading a game as text).
// A game is a save fixture or a scenario's golden (scripts/game/source.ts), replayed through the reducer.
//
//   pnpm game list                                        # every fixture and golden it can read
//   pnpm game show mirkwood-lost --until round=3 --legal  # the table when round 3 starts, with the intents the engine offers
//   pnpm game show duo --at 5 --send '{"type":"Pass"}'    # after 5 intents, then what one more intent does, or why it is refused
//   pnpm game log passage-through-mirkwood/1 --from 40 --to 60 --steps
//   pnpm game diff passage-through-mirkwood/1             # where the golden played now leaves golden.json
//   pnpm game show encounter:the-oath:7 --at 120          # a game of `pnpm test encounter`; smoke:<code> opens a card smoke failure
//   pnpm game moved [<base-ref>]                         # each golden whose golden.json differs from the base: result, first differing step, what resolved there
//   pnpm game scene passage-through-mirkwood '{"phase":"Combat","engaged":["01096"]}' --legal   # a table from a test layout
import { readFileSync } from "node:fs";
import path from "node:path";

import { flagValue, flagValues } from "../args.ts";
import { runScript, type Log } from "../log.ts";
import { reduce, type PlayerIntent } from "../../src/rules/engine/reduce.ts";

import { firstDifferent, stateDiff } from "./diff.ts";
import { intentText, stepText } from "./names.ts";
import { layoutOf, sceneSource } from "./scene-source.ts";
import { ROOT } from "../data/paths.ts";
import { compareGoldens, type StoredGolden } from "./compare.ts";
import { baseRef, changedScenarios, detailOf, goldenAt, renderMoved, type StepDetail } from "./moved.ts";
import { goldenNames, listSources, loadSource, type GameSource } from "./source.ts";
import { stateText } from "./state-text.ts";
import { parseUntil, walk, type Move } from "./walk.ts";

const USAGE = `usage:
  pnpm game list
  pnpm game show <source> [--at <n> | --until <cond>] [--legal] [--full] [--json] [--send '<intent json>']...
  pnpm game log <source> [--from <n>] [--to <n>] [--until <cond>] [--steps] [--grep <text>]
  pnpm game diff <scenario-id>/<golden>
  pnpm game moved [<base-ref>]
  pnpm game scene <scenario-id> ['<layout json>' | @<file>] [show's flags]
<source> is a fixture name, <scenario-id>/<golden number or name>, encounter:<scenario-id>:<game> or smoke:<code>[:<seed>[:<deal>]]; <cond> is lost, won, round=N, phase=X, mode=X, window=X, seat=N or code=X.`;

function number(args: readonly string[], flag: string): number | undefined {
  const value = flagValue(args, flag);
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${flag} takes a number, not ${value}`);
  return Number(value);
}

function moveText(move: Move, source: GameSource, withSteps: boolean): string[] {
  const { before, after } = move;
  const head = `#${move.index + 1} R${before.round} ${before.phase} P${before.activeSeat + 1}: ${intentText(move.intent, before, source.ctx)}`;
  return withSteps ? [head, ...move.steps.map((step) => `    ${stepText(step, after, source.ctx)}`)] : [head];
}

function show(log: Log, source: GameSource, args: readonly string[]): void {
  const until = flagValue(args, "--until");
  const walked = walk(source, { at: number(args, "--at"), until: until ? parseUntil(until) : undefined });
  const out: string[] = [`${source.label}: after ${walked.at} of ${source.intents.length} intents`];
  if (walked.refused) out.push(`REFUSED #${walked.refused.index + 1} ${intentText(walked.refused.intent, walked.state, source.ctx)}: ${walked.refused.reason}`);
  const last = walked.moves.at(-1);
  if (last) out.push("last intent:", ...moveText(last, source, true).map((line) => `  ${line}`));
  let state = walked.state;
  for (const text of flagValues(args, "--send")) {
    const intent = JSON.parse(text) as PlayerIntent;
    const result = reduce(state, intent, source.ctx);
    if (!result.ok) {
      out.push(`sent ${intentText(intent, state, source.ctx)}: REFUSED: ${result.reason}`);
      break;
    }
    out.push(`sent ${intentText(intent, state, source.ctx)}:`, ...result.steps.map((step) => `    ${stepText(step, result.state, source.ctx)}`));
    state = result.state;
  }
  if (args.includes("--json")) {
    out.push(JSON.stringify(state, null, 2));
  } else {
    out.push("", stateText(state, source.ctx, { legal: args.includes("--legal"), full: args.includes("--full") }));
  }
  process.stdout.write(`${out.join("\n")}\n`);
  if (walked.refused) log.warn("the replay stopped at a refused intent: the engine or the cards moved since the game was written");
}

function timeline(source: GameSource, args: readonly string[]): void {
  const until = flagValue(args, "--until");
  const from = number(args, "--from") ?? 1;
  const to = number(args, "--to");
  const grep = flagValue(args, "--grep")?.toLowerCase();
  const walked = walk(source, { at: to, until: until ? parseUntil(until) : undefined });
  const out = [`${source.label}: ${walked.at} of ${source.intents.length} intents`];
  for (const move of walked.moves.slice(from - 1)) {
    const lines = moveText(move, source, args.includes("--steps") || grep !== undefined);
    if (grep && !lines.some((line) => line.toLowerCase().includes(grep))) continue;
    out.push(...(grep && !args.includes("--steps") ? [lines[0] ?? "", ...lines.slice(1).filter((line) => line.toLowerCase().includes(grep))] : lines));
  }
  if (walked.refused) out.push(`REFUSED #${walked.refused.index + 1} ${intentText(walked.refused.intent, walked.state, source.ctx)}: ${walked.refused.reason}`);
  const end = walked.state;
  out.push(`end: round ${end.round}, ${end.phase}${end.lost ? `, LOST: ${end.lossReason}` : end.stageCleared ? ", WON" : ""}`);
  process.stdout.write(`${out.join("\n")}\n`);
}

function diff(source: GameSource): void {
  if (!source.played || !source.pinned) throw new Error("diff reads a golden (<scenario-id>/<golden>) that golden.json pins");
  // The pinned intents follow the opening Keep (source.ts); the played game's do too.
  const pinned = source.intents.slice(1);
  const played = source.played.intents;
  const at = firstDifferent(played, pinned);
  const out = [`${source.label}: played now ${played.length} intents, golden.json ${pinned.length}`];
  if (at === null) {
    const fields = stateDiff(source.pinned, source.played.state);
    out.push(fields.length === 0 ? "same intents and same final state: the golden holds" : "same intents, different final state (golden.json → played now):", ...fields.map((line) => `  ${line}`));
  } else {
    // The state both games share: the pinned game up to the move before they part (+1 for the opening Keep).
    const walked = walk(source, { at: at + 1 });
    out.push(`they part at intent #${at + 2} (golden.json's numbering, the Keep is #1):`);
    out.push(`  golden.json: ${pinned[at] ? intentText(pinned[at], walked.state, source.ctx) : "(ended)"}`);
    out.push(`  played now:  ${played[at] ? intentText(played[at], walked.state, source.ctx) : "(ended)"}`);
    if (walked.refused) out.push(`  golden.json's own replay is refused before that, at #${walked.refused.index + 1}: ${walked.refused.reason}`);
    out.push("", "the table both games reached:", stateText(walked.state, source.ctx, { legal: true }));
  }
  process.stdout.write(`${out.join("\n")}\n`);
}

// The blocks of `pnpm game moved`: each moved golden, with the intent where its table first differs replayed for the records and cards that resolved.
// A scenario that cannot be compared or replayed prints one line that names it and the others go on.
async function movedBlocks(ref: string, scenarioId: string): Promise<string[]> {
  const now = JSON.parse(readFileSync(path.join(ROOT, "src", "campaign", "scenarios", scenarioId, "golden.json"), "utf8")) as StoredGolden[];
  const blocks: string[] = [];
  for (const move of compareGoldens(goldenAt(ref, scenarioId), now, goldenNames(scenarioId))) {
    let detail: StepDetail | null = null;
    let refused: string | undefined;
    if (move.number !== null && move.first !== null) {
      try {
        const source = await loadSource(`${scenarioId}/${move.number}`);
        const walked = walk(source, { at: move.endsNow ? move.first + 1 : move.first + 2 });
        const last = walked.moves.at(-1);
        if (walked.refused) refused = `refused at #${walked.refused.index + 1}: ${walked.refused.reason}`;
        else if (last) detail = detailOf(last, source.ctx);
      } catch (error) {
        refused = `not replayed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    blocks.push(renderMoved(scenarioId, move, detail, refused));
  }
  return blocks;
}

async function moved(log: Log, refArg: string | undefined): Promise<void> {
  const ref = baseRef(refArg);
  const blocks: string[] = [];
  for (const scenarioId of changedScenarios(ref)) {
    try {
      blocks.push(...(await movedBlocks(ref, scenarioId)));
    } catch (error) {
      blocks.push(`${scenarioId}: not compared: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  process.stdout.write(blocks.length > 0 ? `${blocks.join("\n\n")}\n` : `no golden.json differs from ${ref.slice(0, 10)}\n`);
  log.info(`${blocks.length} moved golden${blocks.length === 1 ? "" : "s"} against ${ref.slice(0, 10)}`);
}

async function main(log: Log): Promise<void> {
  const [command = "", name, ...args] = process.argv.slice(2);
  if (command === "list") {
    process.stdout.write(`${listSources().join("\n")}\n`);
    return;
  }
  if (command === "moved") return moved(log, name?.startsWith("--") ? undefined : name);
  if (!["show", "log", "diff", "scene"].includes(command) || !name || name.startsWith("--")) throw new Error(USAGE);
  if (command === "scene") {
    // The layout is the argument after the scenario, when it is not a flag.
    const layout = args[0] !== undefined && !args[0].startsWith("--") ? args.shift() : undefined;
    show(log, sceneSource(name, layoutOf(layout, process.env.INIT_CWD ?? process.cwd())), args);
    return;
  }
  const source = await loadSource(name);
  if (command === "show") show(log, source, args);
  else if (command === "log") timeline(source, args);
  else diff(source);
}

await runScript("game", main, { done: false });
