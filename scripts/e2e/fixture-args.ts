import { parseArgs, type ParsedArgs } from "../cli-args.ts";

// The command line of scripts/e2e/fixtures.ts: the scenario id, `--won`, and the flags of the search (scripts/e2e/search/options.ts, `searchFlags`).
export const FIXTURE_USAGE = "Usage: pnpm scenario fixtures [<scenario-id>] [--won] [--search [--seeds=1-6] [--budget=600] [--width=6] [--branches=6] [--rounds=40] [--plain=0] [--out=<folder>]]";

const FIXTURE_FLAGS = ["won", "search", "seeds", "budget", "width", "branches", "rounds", "plain", "out"];

/** The arguments of a run of the fixtures script. An unknown flag throws with the usage and `--help` sets `help`, so neither writes a fixture; more than one scenario id throws too. */
export function fixtureArguments(args: readonly string[] = process.argv.slice(2)): ParsedArgs {
  const parsed = parseArgs(args, FIXTURE_USAGE, { flags: FIXTURE_FLAGS });
  if (parsed.positional.length > 1) throw new Error(FIXTURE_USAGE);
  return parsed;
}
