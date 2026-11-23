// A misspelt flag or `--help` of `pnpm scenario fixtures` must not rewrite a fixture: the script used to drop every `--` word and run as a bare run, which rewrites every fixture.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { fixtureArguments, FIXTURE_USAGE } from "./fixture-args.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURES = path.join(ROOT, "src", "campaign", "fixtures");

describe("fixtureArguments", () => {
  it("reads the scenario id and the flags of the fixtures script and the search", () => {
    const parsed = fixtureArguments(["the-long-dark", "--search", "--seeds=1-6", "--budget=60", "--plain=0", "--out=/tmp/x"]);
    expect(parsed.positional).toEqual(["the-long-dark"]);
    expect([...parsed.flags.keys()]).toEqual(["search", "seeds", "budget", "plain", "out"]);
    expect(fixtureArguments(["--won"]).flags.has("won")).toBe(true);
    expect(fixtureArguments([]).positional).toEqual([]);
  });

  it("refuses a misspelt or unknown flag with the usage, and two scenario ids", () => {
    for (const arg of ["--wno", "--serach", "--seed=1", "--dry-run", "-w"]) expect(() => fixtureArguments([arg]), arg).toThrow(/Unknown flag/);
    expect(() => fixtureArguments(["--wno"])).toThrow(FIXTURE_USAGE);
    expect(() => fixtureArguments(["a", "b"])).toThrow(FIXTURE_USAGE);
  });

  it("answers --help with help", () => {
    expect(fixtureArguments(["--help"]).help).toBe(true);
  });
});

describe("pnpm scenario fixtures with a flag it does not know", () => {
  const stamps = (): string => readdirSync(FIXTURES).sort().map((file) => `${file}:${statSync(path.join(FIXTURES, file)).mtimeMs}`).join("\n");
  const run = (arg: string) => spawnSync(process.execPath, ["scripts/cli.ts", "scenario", "fixtures", arg], { cwd: ROOT, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", VITEST: "", LOG_LEVEL: "" } });

  it("writes no fixture for a misspelt flag, exits with an error and prints the usage", () => {
    const before = stamps();
    const done = run("--wno");
    expect(done.status).not.toBe(0);
    expect(`${done.stdout}${done.stderr}`).toContain("Unknown flag --wno");
    expect(stamps()).toBe(before);
  });

  it("writes no fixture for --help and prints the usage", () => {
    const before = stamps();
    const done = run("--help");
    expect(done.status).toBe(0);
    expect(`${done.stdout}${done.stderr}`).toContain("Usage: pnpm scenario fixtures");
    expect(stamps()).toBe(before);
  });
});
