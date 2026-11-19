// `pnpm desktop stage --tag <vX.Y.Z> --out <dir> [--suffix -dry-run] [--repository <owner/name>] [--github-output]`: the release job's step after `pnpm desktop pack`. It
// checks that this OS made every installer desktop/electron-builder.yml names (release-files.ts), refuses one over GitHub's 2 GiB asset limit, copies each into <dir>
// under the release's name with a `.sha256` file beside it (`<hex>  <name>`, as sha256sum writes; Node does the hashing, so Windows and macOS need no `sha256sum` or
// `shasum`), and with --github-output writes `app=` (the executable the launch check opens) and `names=` to $GITHUB_OUTPUT. On Linux, with a repository
// (--repository, or $GITHUB_REPOSITORY), it first writes the AppImage's update information into the copy (appimage.ts) and then makes its `.zsync` file with
// zsyncmake, so AppImageUpdate and the AppImage managers can update it in place; the launch check opens that copy, the file the release ships.
import { spawnSync } from "node:child_process";
import { copyFileSync, appendFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { flagValue as flag } from "../args.ts";
import { runScript, type Log } from "../log.ts";
import { fileSha256 } from "../release/sha256.ts";
import { readUpdateInfo, writeUpdateInfo } from "./appimage.ts";
import { ASSET_LIMIT, DESKTOP_OS, installerNames, missingInstallers, packedApp, stagedName, updateInfo } from "./release-files.ts";
import { desktopVersion, OUT_DIR } from "./shell.ts";

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  const os = DESKTOP_OS[process.platform];
  if (!os) throw new Error(`No desktop target for ${process.platform}`);
  const tag = flag(args, "--tag") ?? "";
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error("--tag <vX.Y.Z> is required");
  const version = desktopVersion(tag.slice(1));
  const out = path.resolve(flag(args, "--out") ?? "");
  if (!flag(args, "--out")) throw new Error("--out <dir> is required");
  const suffix = flag(args, "--suffix") ?? "";
  const repository = flag(args, "--repository") ?? process.env.GITHUB_REPOSITORY ?? "";
  const missing = missingInstallers(os, version, readdirSync(OUT_DIR));
  if (missing.length > 0) throw new Error(`desktop/out lacks ${missing.join(", ")}; it has ${readdirSync(OUT_DIR).join(", ")}`);
  mkdirSync(out, { recursive: true });
  const staged: string[] = [];
  let app = packedApp(os, version, OUT_DIR);
  for (const name of installerNames(os, version)) {
    const size = statSync(path.join(OUT_DIR, name)).size;
    log.info(`${name}: ${Math.round(size / 1048576)} MB`);
    if (size >= ASSET_LIMIT) throw new Error(`${name} is over the 2 GiB release asset limit`);
    const release = stagedName(name, version, suffix);
    const file = path.join(out, release);
    copyFileSync(path.join(OUT_DIR, name), file);
    const appImage = name.endsWith(".AppImage");
    if (appImage && repository === "") log.warn("no --repository or GITHUB_REPOSITORY: the AppImage carries no update information and gets no .zsync file");
    else if (appImage) {
      writeUpdateInfo(file, updateInfo(repository));
      log.info(`${release}: update information ${readUpdateInfo(file)}`);
      app = file;
    }
    writeFileSync(path.join(out, `${release}.sha256`), `${await fileSha256(file)}  ${release}\n`);
    staged.push(release);
    if (appImage && repository !== "") staged.push(zsync(out, release, log));
  }
  if (args.includes("--github-output")) {
    const output = process.env.GITHUB_OUTPUT;
    if (!output) throw new Error("--github-output needs GITHUB_OUTPUT");
    appendFileSync(output, `app=${app}\nnames=${staged.join(" ")}\n`);
  }
}

/** Makes `<release>.zsync` beside the AppImage, its URL the AppImage's own name, which resolves beside the `.zsync` file on the release. Returns its name. */
function zsync(out: string, release: string, log: Log): string {
  const name = `${release}.zsync`;
  const result = spawnSync("zsyncmake", ["-u", release, "-o", name, release], { cwd: out, encoding: "utf8" });
  if (result.error) throw new Error(`zsyncmake is needed for the AppImage's .zsync file (apt install zsync): ${result.error.message}`);
  if (result.status !== 0) throw new Error(`zsyncmake failed: ${result.stderr}`);
  log.info(`${name}: ${Math.round(statSync(path.join(out, name)).size / 1024)} KB`);
  return name;
}

await runScript("desktop:stage", main);
