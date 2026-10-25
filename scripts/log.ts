// The scripts' one logger. Every line carries the time since the script started, the script's tag and, for a warning or an
// error, the level: "+1.4s data:sync › ringsdb  141 packs". Lines go to stderr, so stdout stays for data (data:query's rows).
//
// Level: --verbose (or LOG_LEVEL=debug) adds the per-file detail and error stacks; --quiet (or LOG_LEVEL=warn) keeps
// warnings and errors only; LOG_LEVEL=silent drops everything. Under Vitest the default is silent, so a test that calls
// build() or buildCatalog() stays quiet unless LOG_LEVEL asks otherwise. NO_COLOR or a non-TTY stderr turns colour off.

type Level = "debug" | "info" | "warn" | "error" | "silent";
const RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

function levelFrom(argv: readonly string[], env: NodeJS.ProcessEnv): Level {
  const asked = env.LOG_LEVEL?.toLowerCase();
  if (asked && asked in RANK) return asked as Level;
  if (argv.includes("--verbose")) return "debug";
  if (argv.includes("--quiet")) return "warn";
  return env.VITEST ? "silent" : "info";
}

const level = levelFrom(process.argv, process.env);
const started = performance.now();
const colour = !process.env.NO_COLOR && process.stderr.isTTY === true;
const paint = (code: string, text: string) => (colour ? `\u001b[${code}m${text}\u001b[0m` : text);

export function verbose(): boolean {
  return RANK[level] <= RANK.debug;
}

/** Seconds or minutes, for a duration in milliseconds: "340 ms", "2.4 s", "3 min 12 s". */
export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes} min ${Math.round((ms % 60_000) / 1000)} s`;
}

/** A byte count a person reads: "812 B", "14.2 KB", "3.1 MB". */
export function bytes(count: number): string {
  if (count < 1024) return `${count} B`;
  if (count < 1024 * 1024) return `${(count / 1024).toFixed(1)} KB`;
  return `${(count / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * An error's message with every cause under it. Node's fetch reports a dropped connection as "fetch failed" and puts the
 * reason (ECONNRESET, a TLS failure, a DNS miss) in `cause`, so the cause is what says what went wrong.
 */
export function describeError(error: unknown): string {
  const lines: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 6; depth += 1) {
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      lines.push(`${depth === 0 ? "" : "caused by: "}${current.message}${typeof code === "string" && !current.message.includes(code) ? ` (${code})` : ""}`);
      current = current.cause;
    } else {
      lines.push(`${depth === 0 ? "" : "caused by: "}${String(current)}`);
      break;
    }
  }
  return lines.join("\n  ");
}

export type Log = {
  readonly tag: string;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Runs `work`, logging its label with how long it took, or its failure. */
  step<T>(label: string, work: () => T): T;
  stepAsync<T>(label: string, work: () => Promise<T>): Promise<T>;
  /** A counter for `total` items: every item at debug, and at info the first, the last and one line per tenth or 5 s. */
  progress(total: number, label: string): (item: string) => void;
  /** The same logger under a sub-tag: "data:sync › ringsdb". */
  child(tag: string): Log;
};

function write(at: Level, tag: string, message: string): void {
  if (RANK[at] < RANK[level]) return;
  const time = paint("2", `+${((performance.now() - started) / 1000).toFixed(1)}s`.padStart(7));
  const mark = at === "warn" ? `${paint("33", "warning")} ` : at === "error" ? `${paint("31", "error")} ` : "";
  const text = at === "debug" ? paint("2", message) : message;
  // Continuation lines line up under the message.
  process.stderr.write(`${time} ${paint("36", tag)} ${mark}${text.replaceAll("\n", `\n${" ".repeat(8)}`)}\n`);
}

export function createLog(tag: string): Log {
  const log: Log = {
    tag,
    debug: (message) => write("debug", tag, message),
    info: (message) => write("info", tag, message),
    warn: (message) => write("warn", tag, message),
    error: (message) => write("error", tag, message),
    step(label, work) {
      const begin = performance.now();
      log.debug(`${label}…`);
      try {
        const result = work();
        log.info(`${label} (${duration(performance.now() - begin)})`);
        return result;
      } catch (error) {
        log.error(`${label} failed after ${duration(performance.now() - begin)}`);
        throw error;
      }
    },
    async stepAsync(label, work) {
      const begin = performance.now();
      log.debug(`${label}…`);
      try {
        const result = await work();
        log.info(`${label} (${duration(performance.now() - begin)})`);
        return result;
      } catch (error) {
        log.error(`${label} failed after ${duration(performance.now() - begin)}`);
        throw error;
      }
    },
    progress(total, label) {
      let done = 0;
      let tenth = 0;
      let last = performance.now();
      return (item) => {
        done += 1;
        const width = String(total).length;
        const line = `${label} ${String(done).padStart(width)}/${total} ${item}`;
        const now = performance.now();
        const nextTenth = Math.floor((done * 10) / Math.max(1, total));
        if (done === 1 || done === total || nextTenth > tenth || now - last > 5000) {
          tenth = nextTenth;
          last = now;
          log.info(line);
        } else {
          log.debug(line);
        }
      };
    },
    child: (sub) => createLog(`${tag} › ${sub}`),
  };
  return log;
}

/**
 * The entry point of a script: logs what it was asked, runs `main`, and ends with how long it took (at debug with
 * `done: false`, for a quick command). A failure is logged with its causes (and its stack under --verbose) and sets the
 * exit code; it is not rethrown.
 */
export async function runScript(tag: string, main: (log: Log) => void | Promise<void>, options: { done?: boolean } = {}): Promise<void> {
  const log = createLog(tag);
  const args = process.argv.slice(2).filter((arg) => arg !== "--verbose" && arg !== "--quiet");
  log.debug(`node ${process.version}, args: ${args.length > 0 ? args.join(" ") : "none"}, log level ${level}`);
  try {
    await main(log);
    const took = `done in ${duration(performance.now() - started)}`;
    if (options.done === false) log.debug(took);
    else log.info(took);
  } catch (error) {
    log.error(describeError(error));
    if (verbose() && error instanceof Error && error.stack) log.debug(error.stack);
    else log.info("run with --verbose for the stack");
    log.error(`failed after ${duration(performance.now() - started)}`);
    process.exitCode = 1;
  }
}
