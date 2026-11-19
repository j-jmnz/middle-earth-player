// Test helper. The hint a failed golden snapshot (test/harness/golden-suite.ts) prints: which goldens moved against golden.json and how, and the
// command that names the move where each parts (`pnpm game diff`, docs/development.md, Reading a game as text). The snapshot alone prints the
// whole file as one changed line.
import { existsSync, readFileSync } from "node:fs";

type Played = { name: string; intents?: unknown; state?: unknown };

export function goldensMovedHint(file: string, scenarioId: string, out: readonly Played[]): string | undefined {
  if (!existsSync(file)) return undefined;
  const pinned = JSON.parse(readFileSync(file, "utf8")) as Played[];
  const moved = out.flatMap((golden, at) => {
    const was = pinned.find((item) => item.name === golden.name);
    if (!was) return [`${at + 1} "${golden.name}" is new`];
    if (JSON.stringify(was.intents) !== JSON.stringify(golden.intents)) return [`${at + 1} "${golden.name}" plays other intents`];
    if (JSON.stringify(was.state) !== JSON.stringify(golden.state)) return [`${at + 1} "${golden.name}" ends on another state`];
    return [];
  });
  if (moved.length === 0) return undefined;
  return `${moved.join("; ")}. \`pnpm game diff ${scenarioId}/<number>\` names the move where a golden parts and prints the table there`;
}
