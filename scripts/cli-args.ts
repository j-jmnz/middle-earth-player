// The arguments of a script that writes files. A script that drops every `--` word before it reads its positional argument runs on a misspelt flag or on `--help` as if none were given, and
// rewrites what a bare run rewrites: this refuses an unknown flag with the usage, and answers `--help` with the usage and no run.

export type ArgSpec = {
  /** The flags that stand alone or take `=value` (`--won`, `--seeds=1-6`), without the dashes. */
  flags?: readonly string[];
  /** The flags whose value follows as the next argument (`--pack OHaUH`), without the dashes. */
  spaced?: readonly string[];
};

export type ParsedArgs = { positional: string[]; help: boolean; flags: ReadonlyMap<string, string | null> };

// The flags every script reads from scripts/log.ts.
const LOG_FLAGS = ["verbose", "quiet"];

/**
 * Splits `args` into positional words and flags. An unknown flag throws with `usage` in its message; `--help` and `-h` set `help` and the caller prints the usage and returns before it writes anything.
 * A flag from `spaced` takes the next argument as its value, so the value is not a positional word.
 */
export function parseArgs(args: readonly string[], usage: string, spec: ArgSpec = {}): ParsedArgs {
  const known = new Set([...LOG_FLAGS, ...(spec.flags ?? [])]);
  const spaced = new Set(spec.spaced ?? []);
  const positional: string[] = [];
  const flags = new Map<string, string | null>();
  let help = false;
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at] ?? "";
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (!arg.startsWith("-") || arg === "-") {
      positional.push(arg);
      continue;
    }
    const name = arg.replace(/^--?/, "").split("=")[0] ?? "";
    if (arg.startsWith("--") && spaced.has(name) && !arg.includes("=")) {
      flags.set(name, args[at + 1] ?? null);
      at += 1;
    } else if (arg.startsWith("--") && spaced.has(name)) flags.set(name, arg.slice(arg.indexOf("=") + 1));
    else if (arg.startsWith("--") && known.has(name)) flags.set(name, arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : null);
    else throw new Error(`Unknown flag ${arg}.\n${usage}`);
  }
  return { positional, help, flags };
}
