// The flags of `pnpm scenario fixtures <scenario-id> --search`, read from the command line (the entry script is the process's own; a test passes
// its own list). Each is `--name` or `--name=value`:
//
//   --search          after the plain seed scan finds no won game, search for one (scripts/e2e/search/)
//   --seeds=1-6       the seeds the search deals, first-last (a single number is one seed); default 1-4
//   --budget=600      seconds the search of one won game may take in all, shared by its seeds; default 600
//   --width=6         lines the beam keeps after each round; default: three passes over the seeds, widening (3, 6 and 10 lines)
//   --branches=6      ways each line plays a round; default 4, 6 and 8 in those passes
//   --rounds=40       rounds a game is played at most; default 40
//   --plain=100       seeds the plain scan tries first (0 skips it); default is the finder's own count
//   --out=<folder>    the folder the fixture file is written to, instead of src/campaign/fixtures

export type SearchFlags = { seedFrom: number; seedTo: number; budgetSeconds: number; width: number | null; branches: number | null; rounds: number; plain: number | null; out: string | null };

function value(args: readonly string[], name: string): string | null {
  const found = args.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  return found === undefined ? null : found.includes("=") ? found.slice(found.indexOf("=") + 1) : "";
}

function whole(text: string | null, fallback: number, name: string): number {
  if (text === null) return fallback;
  const number = Number(text);
  if (!Number.isInteger(number) || number < 0) throw new Error(`--${name} takes a whole number, not "${text}"`);
  return number;
}

/** The search flags in `args`, or null when `--search` is absent. */
export function searchFlags(args: readonly string[] = process.argv.slice(2)): SearchFlags | null {
  if (value(args, "search") === null) return null;
  const seeds = value(args, "seeds") ?? "1-4";
  const [from, to] = seeds.split("-");
  const seedFrom = whole(from ?? null, 1, "seeds");
  const seedTo = whole(to ?? from ?? null, seedFrom, "seeds");
  const plain = value(args, "plain");
  return {
    seedFrom,
    seedTo: Math.max(seedFrom, seedTo),
    budgetSeconds: whole(value(args, "budget"), 600, "budget"),
    width: value(args, "width") === null ? null : Math.max(1, whole(value(args, "width"), 6, "width")),
    branches: value(args, "branches") === null ? null : Math.max(1, whole(value(args, "branches"), 6, "branches")),
    rounds: Math.max(1, whole(value(args, "rounds"), 40, "rounds")),
    plain: plain === null ? null : whole(plain, 0, "plain"),
    out: value(args, "out") || null,
  };
}

/** The positional arguments of the command line (the scenario id): everything that is not a flag. */
export function plainArguments(args: readonly string[] = process.argv.slice(2)): string[] {
  return args.filter((arg) => !arg.startsWith("--"));
}
