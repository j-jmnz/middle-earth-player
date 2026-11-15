// The package scripts' dispatcher (scripts/cli.ts): every group a package script names exists, every step's file is on
// disk, and a group's arguments pick the command they name or fall back to the group's `all`.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GROUPS, resolve, scriptPath } from "./cli.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const scripts = (JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts;

describe("scripts/cli.ts", () => {
  it("has a group for every package script that calls it, and a package script for every group", () => {
    const called = Object.entries(scripts).flatMap(([name, command]) => {
      const match = /^node scripts\/cli\.ts (\S+)$/.exec(command);
      return match ? [[name, match[1]]] : [];
    });
    expect(called.every(([name, group]) => name === group)).toBe(true);
    expect(called.map(([, group]) => group).sort()).toEqual(Object.keys(GROUPS).sort());
  });

  it("runs only files that exist", () => {
    const files = Object.values(GROUPS).flatMap((commands) => Object.values(commands).flatMap((command) => command.steps.map(scriptPath)));
    const missing = files.filter((file) => !existsSync(file));
    expect(missing).toEqual([]);
  });

  it("picks the named command and passes the rest on", () => {
    expect(resolve("data", ["build", "--verbose"])).toEqual({ command: GROUPS["data"]?.["build"], rest: ["--verbose"] });
    expect(resolve("doc", ["section", "brief", "Core round"])?.rest).toEqual(["brief", "Core round"]);
  });

  it("falls back to the group's all, with every argument, and has nothing for a group without one", () => {
    expect(resolve("test", ["src/foo.test.ts", "-t", "x"])).toEqual({ command: GROUPS["test"]?.["all"], rest: ["src/foo.test.ts", "-t", "x"] });
    expect(resolve("assets", ["--optional"])).toEqual({ command: GROUPS["assets"]?.["all"], rest: ["--optional"] });
    expect(resolve("test", ["all"])?.rest).toEqual(["all"]);
    expect(resolve("data", [])).toBeNull();
    expect(resolve("data", ["bogus"])).toBeNull();
    expect(resolve("nope", ["build"])).toBeNull();
  });
});
