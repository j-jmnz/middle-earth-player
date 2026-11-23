import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { flagValue } from "../../args.ts";
import { runScript, type Log } from "../../log.ts";
import { withBaseCheckout } from "../../tools/base-checkout.ts";
import { ROOT } from "../paths.ts";
import { formatChanges, reaching, type Dump } from "./reach-diff.ts";

// Usage: pnpm effects reach <base-ref> [--out <file>] [--tmp <dir>]
// The cards a change reaches: every record of every playable scenario's cards and of every deck-legal player card is rendered as `pnpm effects render` prints it, once with the code of
// <base-ref> (a checkout of it in a temporary folder under --tmp, the system's temporary folder by default) and once with the working tree, and the cards that differ are printed
// by card with the printed line of each record that moved and the lines of the render that changed. A fix agent reads the lines of every card its change reaches before it reports.
//
// It compares what a record says, in English and as JSON. It cannot see a change in engine code that no record's text shows: a reader or pick filter many records share, an idle or
// potential check (src/rules/player), a family hook, a verb's run. For those, list the cards by searching the records for the verb or field the code reads.

const USAGE = "Usage: effects reach <base-ref> [--out <file>] [--tmp <dir>]";

function dump(cwd: string, out: string, log: Log): Dump {
  const run = spawnSync(process.execPath, ["scripts/data/effects/reach-dump.ts", out], { cwd, encoding: "utf8", env: { ...process.env, LOG_LEVEL: "warn" } });
  if (run.status !== 0) throw new Error(`The render in ${cwd} failed:\n${run.stderr.trim().split("\n").slice(-12).join("\n")}`);
  log.debug(`rendered in ${cwd}`);
  return JSON.parse(readFileSync(out, "utf8")) as Dump;
}

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  const ref = args.find((arg, at) => !arg.startsWith("--") && !["--out", "--tmp"].includes(args[at - 1] ?? ""));
  if (!ref) throw new Error(USAGE);
  const out = flagValue(args, "--out");
  // The base checkout runs on this checkout's installed packages and the render scripts of this tree.
  const copy = ["scripts/data/effects/reach-dump.ts", "scripts/data/effects/reach-diff.ts"];
  const report = await withBaseCheckout(ref, { prefix: "reach-", parent: flagValue(args, "--tmp"), copy }, async (base) => {
    const before = await log.stepAsync(`rendering ${ref} (${base.sha.slice(0, 8)})`, async () => dump(base.checkout, path.join(base.work, "base.json"), log));
    const after = await log.stepAsync("rendering the working tree", async () => dump(ROOT, path.join(base.work, "now.json"), log));
    return formatChanges(reaching(before, after), ref);
  });
  if (out) {
    writeFileSync(out, report);
    log.info(`wrote ${out}`);
  } else process.stdout.write(report);
}

void runScript("effects:reach", main);
