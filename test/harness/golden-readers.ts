import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Test helper. The goldens the seed finders under scripts/e2e read (`pnpm scenario fixtures`): a `wonLog` call that names a `scenarioId` reads that
// scenario's golden with `goldenState` (scripts/e2e/seed-kit.ts), and the golden is the call's `golden`, "two-handed, won" when it names none. The finders
// do not run in the suite, so scripts/checks/golden-pins.test.ts reads their calls here and holds each golden to test/harness/golden-pins.ts.

const E2E = path.resolve(import.meta.dirname, "..", "..", "scripts", "e2e");

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : entry.name.endsWith(".ts") ? [path.join(dir, entry.name)] : []));
}

/** Each golden a seed finder reads: [scenario id, golden name, the file that reads it]. */
export function seedFinderReads(): [string, string, string][] {
  const reads: [string, string, string][] = [];
  for (const file of filesUnder(E2E)) {
    const text = readFileSync(file, "utf8");
    for (const call of text.matchAll(/\bwonLog\(\{([^}]*)\}/g)) {
      const body = call[1] ?? "";
      const scenarioId = /scenarioId:\s*"([^"]+)"/.exec(body)?.[1];
      if (!scenarioId) continue;
      const name = /golden:\s*"((?:[^"\\]|\\.)*)"/.exec(body)?.[1] ?? "two-handed, won";
      reads.push([scenarioId, JSON.parse(`"${name}"`) as string, path.relative(path.resolve(E2E, "..", ".."), file)]);
    }
  }
  return reads;
}
