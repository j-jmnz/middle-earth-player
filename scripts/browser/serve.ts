// `pnpm browser serve [--port <n>] [--fresh | --reuse]`: serves the static web export (scripts/browser/web-export.ts) on 127.0.0.1 until it is stopped,
// and prints its address, for a tool that brings its own browser. Run it in the background; `pnpm browser shot --base <address>` then skips the
// export check. Fixture saves need the e2e route: `<address>/e2e/<fixture name>`.
import { flagValue } from "../args.ts";
import { runScript, type Log } from "../log.ts";
import { ensureExport, serveExport } from "./web-export.ts";

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  const { server, base } = await serveExport(ensureExport(log, { fresh: args.includes("--fresh"), reuse: args.includes("--reuse") }), Number(flagValue(args, "--port") ?? 0));
  log.info(`serving the web export at ${base} (stop with Ctrl-C)`);
  await new Promise<void>((resolve) => {
    const stop = (): void => {
      server.close();
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

await runScript("browser:serve", main, { done: false });
