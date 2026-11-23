import { parseArgs } from "../cli-args.ts";

export const SYNC_USAGE = "Usage: pnpm data sync [<source>...] [--pack <pack>] [--codes <code,code,...>] (no source: every source but scans, pictures and nightmare)";

/** The sources named on the command line: a misspelt flag throws and `--help` asks for the usage, so neither refreshes every source. */
export function syncArguments(argv: readonly string[]): { wanted: string[]; help: boolean } {
  const parsed = parseArgs(argv, SYNC_USAGE, { spaced: ["pack", "codes"] });
  return { wanted: parsed.positional, help: parsed.help };
}
