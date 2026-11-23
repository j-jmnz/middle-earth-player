// Test helper. The hint a failed golden snapshot (test/harness/golden-suite.ts) prints: which goldens moved against golden.json and how, and the
// command that names the move where each parts (`pnpm game diff`, docs/development.md, Reading a game as text). The snapshot alone prints the
// whole file as one changed line. The comparison is the one `pnpm game moved` makes (scripts/game/compare.ts).
import { existsSync, readFileSync } from "node:fs";

import { compareGoldens, type StoredGolden } from "../../scripts/game/compare.ts";

export function goldensMovedHint(file: string, scenarioId: string, out: readonly StoredGolden[]): string | undefined {
  if (!existsSync(file)) return undefined;
  let pinned: StoredGolden[];
  try {
    pinned = JSON.parse(readFileSync(file, "utf8")) as StoredGolden[];
  } catch {
    return undefined;
  }
  const moved = compareGoldens(pinned, out).flatMap((move) => {
    const label = `${move.number ?? 0} "${move.name}"`;
    if (move.kind === "removed") return [];
    if (move.kind === "new") return [`${label} is new`];
    if (move.intents === "changed") return [`${label} plays other intents`];
    return [move.fields.length > 0 ? `${label} ends on another state` : `${label} stores other tables`];
  });
  if (moved.length === 0) return undefined;
  return `${moved.join("; ")}. \`pnpm game diff ${scenarioId}/<number>\` names the move where a golden parts and prints the table there`;
}
