// `pnpm game <list | show | log | diff>`: a saved game as text, for an agent debugging the engine (docs/development.md, Reading a game as text).
// A game is a save fixture or a scenario's golden (scripts/game/source.ts), replayed through the reducer.
//
//   pnpm game list                                        # every fixture and golden it can read
//   pnpm game show mirkwood-lost --until round=3 --legal  # the table when round 3 starts, with the intents the engine offers
//   pnpm game show duo --at 5 --send '{"type":"Pass"}'    # after 5 intents, then what one more intent does, or why it is refused
//   pnpm game log passage-through-mirkwood/1 --from 40 --to 60 --steps
//   pnpm game diff passage-through-mirkwood/1             # where the golden played now leaves golden.json
import { flagValue, flagValues } from "../args.ts";
import { runScript, type Log } from "../log.ts";
import { reduce, type PlayerIntent } from "../../src/rules/engine/reduce.ts";

import { firstDifferent, stateDiff } from "./diff.ts";
import { intentText, stepText } from "./names.ts";
import { listSources, loadSource, type GameSource } from "./source.ts";
import { stateText } from "./state-text.ts";
import { parseUntil, walk, type Move } from "./walk.ts";

const USAGE = `usage:
  pnpm game list
  pnpm game show <source> [--at <n> | --until <cond>] [--legal] [--full] [--json] [--send '<intent json>']...
  pnpm game log <source> [--from <n>] [--to <n>] [--until <cond>] [--steps] [--grep <text>]
  pnpm game diff <scenario-id>/<golden>
<source> is a fixture name or <scenario-id>/<golden number or name>; <cond> is lost, won, round=N, phase=X, mode=X, window=X, seat=N or code=X.`;

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

async function main(log: Log): Promise<void> {
  const [command = "", name, ...args] = process.argv.slice(2);
  if (command === "list") {
    process.stdout.write(`${listSources().join("\n")}\n`);
    return;
  }
  if (!["show", "log", "diff"].includes(command) || !name || name.startsWith("--")) throw new Error(USAGE);
  const source = await loadSource(name);
  if (command === "show") show(log, source, args);
  else if (command === "log") timeline(source, args);
  else diff(source);
}

await runScript("game", main, { done: false });
