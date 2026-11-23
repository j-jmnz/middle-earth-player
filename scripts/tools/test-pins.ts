import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { GOLDEN_PINS } from "../../test/harness/golden-pins.ts";
import { seedFinderReads } from "../../test/harness/golden-readers.ts";
import { ROOT } from "../data/paths.ts";
import { runScript, type Log } from "../log.ts";

// `pnpm test pins`: lists the pins in test/harness/golden-pins.ts that no reader uses. A pinned golden keeps its whole final state in golden.json, so a pin
// nobody reads is dead weight. The readers are the tests that import `goldenState` (run here with GOLDEN_READS_FILE set, which makes each read note
// itself, across every worker) and the seed finders under scripts/e2e (scripts/checks/golden-pins.test.ts reads those by their source). It exits 1 on a
// stale pin or on a read of a golden that is not pinned; remove a stale pin from golden-pins.ts and write that scenario's golden.json again (-u).

function main(log: Log): void {
  const dir = mkdtempSync(path.join(os.tmpdir(), "golden-reads-"));
  const file = path.join(dir, "reads.txt");
  try {
    const vitest = path.join(path.dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");
    log.info("running every test that imports goldenState");
    const child = spawnSync(process.execPath, [vitest, "related", "--run", "test/harness/golden-state.ts"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, GOLDEN_READS_FILE: file } });
    if (child.status !== 0) {
      process.exitCode = child.status ?? 1;
      log.error("the readers' tests failed: the list of pins would be incomplete");
      return;
    }
    const read = new Set<string>();
    for (const line of readFileSync(file, "utf8").split("\n")) if (line) read.add(line);
    for (const [scenarioId, name] of seedFinderReads()) read.add(JSON.stringify([scenarioId, name]));
    const stale = Object.entries(GOLDEN_PINS).flatMap(([scenarioId, names]) => names.filter((name) => !read.has(JSON.stringify([scenarioId, name]))).map((name) => `${scenarioId} "${name}"`));
    const unpinned = [...read].map((line) => JSON.parse(line) as [string, string]).filter(([scenarioId, name]) => !(GOLDEN_PINS[scenarioId] ?? []).includes(name)).map(([scenarioId, name]) => `${scenarioId} "${name}"`);
    if (unpinned.length > 0) log.error(`read but not pinned:\n  ${unpinned.join("\n  ")}`);
    if (stale.length > 0) log.error(`pinned and read by nobody:\n  ${stale.join("\n  ")}`);
    if (stale.length > 0 || unpinned.length > 0) process.exitCode = 1;
    else log.notice(`every one of ${read.size} pins is read`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await runScript("test-pins", main, { done: false });
