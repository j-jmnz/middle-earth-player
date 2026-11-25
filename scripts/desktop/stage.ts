// `pnpm desktop stage --out <dir> [--suffix -dry-run] [--github-output]`: the release job's step after `pnpm desktop pack`. It checks that this OS made every installer
// desktop/electron-builder.yml names (release-files.ts), refuses one over GitHub's 2 GiB asset limit, copies each into <dir> under the release's name with a `.sha256` file beside it
// (`<hex>  <name>`, as sha256sum writes; Node does the hashing, so Windows and macOS need no `sha256sum` or `shasum`), and with --github-output writes `app=` (the
// executable the launch check opens) and `names=` to $GITHUB_OUTPUT.
import { copyFileSync, appendFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { flagValue as flag } from "../args.ts";
import { runScript, type Log } from "../log.ts";
import { fileSha256 } from "../release/sha256.ts";
import { ASSET_LIMIT, DESKTOP_OS, installerNames, missingInstallers, packedApp, stagedName } from "./release-files.ts";
import { OUT_DIR } from "./shell.ts";

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  const os = DESKTOP_OS[process.platform];
  if (!os) throw new Error(`No desktop target for ${process.platform}`);
  const out = path.resolve(flag(args, "--out") ?? "");
  if (!flag(args, "--out")) throw new Error("--out <dir> is required");
  const suffix = flag(args, "--suffix") ?? "";
  const missing = missingInstallers(os, readdirSync(OUT_DIR));
  if (missing.length > 0) throw new Error(`desktop/out lacks ${missing.join(", ")}; it has ${readdirSync(OUT_DIR).join(", ")}`);
  mkdirSync(out, { recursive: true });
  const staged: string[] = [];
  for (const name of installerNames(os)) {
    const size = statSync(path.join(OUT_DIR, name)).size;
    log.info(`${name}: ${Math.round(size / 1048576)} MB`);
    if (size >= ASSET_LIMIT) throw new Error(`${name} is over the 2 GiB release asset limit`);
    const release = stagedName(name, suffix);
    copyFileSync(path.join(OUT_DIR, name), path.join(out, release));
    writeFileSync(path.join(out, `${release}.sha256`), `${await fileSha256(path.join(out, release))}  ${release}\n`);
    staged.push(release);
  }
  if (args.includes("--github-output")) {
    const output = process.env.GITHUB_OUTPUT;
    if (!output) throw new Error("--github-output needs GITHUB_OUTPUT");
    appendFileSync(output, `app=${packedApp(os, OUT_DIR)}\nnames=${staged.join(" ")}\n`);
  }
}

await runScript("desktop:stage", main);
