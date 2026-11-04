import { cpSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { runScript } from "../log.ts";
import { build } from "./build.ts";
import { DATA_DIR, ROOT } from "./paths.ts";

// Rebuilds data/, the generated effects and the icons into a temporary directory and fails on any difference from what is
// committed. Offline. The committed rules markdown is copied in first, so no PDF is needed.
function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .sort();
}

function compare(label: string, committed: string, rebuilt: string, only?: (name: string) => boolean): string[] {
  const wanted = (name: string) => (only ? only(name) : true);
  const left = files(committed).filter(wanted);
  const right = files(rebuilt).filter(wanted);
  const problems: string[] = [];
  for (const name of new Set([...left, ...right])) {
    if (!left.includes(name)) problems.push(`${label}/${name} is not committed`);
    else if (!right.includes(name)) problems.push(`${label}/${name} is committed but no longer built`);
    else if (!statSync(path.join(committed, name)).isFile() || !readFileSync(path.join(committed, name)).equals(readFileSync(path.join(rebuilt, name)))) problems.push(`${label}/${name} differs`);
  }
  return problems;
}

void runScript("data:check", (log) => {
  const scratch = mkdtempSync(path.join(tmpdir(), "data-check-"));
  log.debug(`building into ${scratch}`);
  cpSync(path.join(DATA_DIR, "rules"), path.join(scratch, "data", "rules"), { recursive: true });
  process.env.EFFECTS_OUT = path.join(scratch, "effects");
  process.env.ICONS_OUT = path.join(scratch, "icons");
  process.env.ICON_MODULES_OUT = path.join(scratch, "icon-modules");
  log.step("fresh build", () => build(path.join(scratch, "data"), log.child("build")));

  const problems = log.step("compare with the committed files", () => [
    ...["cards", "scenarios", "campaigns", "decks"].flatMap((dir) => compare(`data/${dir}`, path.join(DATA_DIR, dir), path.join(scratch, "data", dir))),
    ...compare("data/rules", path.join(DATA_DIR, "rules"), path.join(scratch, "data", "rules"), (name) => name.endsWith(".json") || name.endsWith(".md")),
    ...compare("src/effects/generated", path.join(ROOT, "src", "effects", "generated"), path.join(scratch, "effects")),
    ...compare("assets/icons", path.join(ROOT, "assets", "icons"), path.join(scratch, "icons")),
    ...compare("src/ui/icons", path.join(ROOT, "src", "ui", "icons"), path.join(scratch, "icon-modules")),
  ]);
  if (problems.length > 0) {
    log.error(`${problems.length} difference(s). Run pnpm data:build and commit the result.\n  ${problems.join("\n  ")}`);
    log.info(`the fresh build is kept in ${scratch} to diff against`);
    process.exitCode = 1;
  } else {
    log.info("data/, src/effects/generated and the icons match a fresh build");
  }
});
