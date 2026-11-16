// `pnpm desktop build`: the assets, the web export with EXPO_PUBLIC_DESKTOP=1 and the shell's bundle, in desktop/build. `--skip-assets` leaves the packs as they are (the release
// workflow downloads them first), `--optional` lets a pack fail, as `pnpm assets --optional` does. APP_VERSION sets the version the package carries.
import { runScript, type Log } from "../log.ts";
import { bundleShell, desktopVersion, exportDesktopWeb, packAssets, WEB_DIR } from "./shell.ts";

async function main(log: Log): Promise<void> {
  const version = desktopVersion(process.env["APP_VERSION"]);
  if (!process.argv.includes("--skip-assets")) packAssets(log, [], process.argv.includes("--optional") ? ["--optional"] : []);
  exportDesktopWeb(log, { out: WEB_DIR });
  await bundleShell(log, version);
  log.info(`desktop ${version} built in desktop/build`);
}

await runScript("desktop:build", main);
