import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { planScenario, type Repo } from "./scenario-new.ts";

// pnpm scenario:new <scenario-id>: it plans from data/scenarios and the registries as they are, edits them only by inserting lines, never
// overwrites a file, and refuses an id that has no scenario file. Nothing is written here: the plan is read, and the CLI runs with --dry-run.
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const repo: Repo = { read: (file) => (existsSync(path.join(ROOT, file)) ? readFileSync(path.join(ROOT, file), "utf8") : null) };
const exists = (file: string): boolean => existsSync(path.join(ROOT, file));
const SCENARIOS = readdirSync(path.join(ROOT, "data", "scenarios")).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -".json".length));
// A scenario that has no authored file yet is one the scaffold has not been run for.
const NEW = SCENARIOS.find((id) => !exists(`src/effects/authored/${id}.ts`) && !exists(`test/scenarios/${id}`));

function cli(...args: string[]): { status: number | null; output: string } {
  const run = spawnSync("node", ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", path.join(ROOT, "scripts", "tools", "scenario-new.ts"), ...args], { cwd: ROOT, encoding: "utf8", env: { ...process.env, LOG_LEVEL: "info" } });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

describe("pnpm scenario:new", () => {
  it("refuses an id that is not in data/scenarios", () => {
    const { plan, problems } = planScenario("the-lost-road", {}, repo, exists);
    expect(plan).toBeNull();
    expect(problems.join(" ")).toContain("not in data/scenarios");
    const run = cli("the-lost-road", "--dry-run");
    expect(run.status).toBe(1);
    expect(run.output).toContain("not in data/scenarios");
  });

  it("refuses a scenario that has its files, and lists them", () => {
    const { plan, problems } = planScenario("the-thing-in-the-depths", {}, repo, exists);
    expect(plan).toBeNull();
    expect(problems.join(" ")).toContain("test/scenarios/the-thing-in-the-depths/scene.ts");
    expect(problems.join(" ")).toContain("src/effects/authored/the-thing-in-the-depths.ts");
    expect(cli("the-thing-in-the-depths", "--dry-run").status).toBe(1);
  });

  it.skipIf(!NEW)("plans the skeletons and the registry lines of a scenario without files, and writes nothing on --dry-run", () => {
    const id = NEW as string;
    const { plan, problems } = planScenario(id, {}, repo, exists);
    expect(problems).toEqual([]);
    expect(plan?.files.map((item) => item.file)).toEqual([
      `test/scenarios/${id}/scene.ts`,
      `test/scenarios/${id}/game.ts`,
      `src/campaign/scenarios/${id}/golden.test.ts`,
      `src/campaign/scenarios/${id}/campaign.test.ts`,
      `scripts/e2e/${id}.ts`,
      `.maestro/scenarios/${id}/${id}.yaml`,
      `.maestro/scenarios/${id}/${id}-loss.yaml`,
      `src/effects/authored/${id}.ts`,
      `src/campaign/fixtures/${id}.json`,
    ]);
    expect(plan?.edits.map((edit) => edit.file)).toEqual(["src/campaign/fixtures/registry.ts", "src/campaign/fixtures.ts", "scripts/e2e/fixtures.ts", "test/harness/golden-registry.ts"]);
    // An edit only inserts lines, and the golden registry's are comments (its test fails on an entry with no golden.json).
    for (const edit of plan?.edits ?? []) {
      const before = edit.before.split("\n");
      const after = edit.after.split("\n");
      expect(after.length, edit.file).toBeGreaterThan(before.length);
      expect(after.filter((line) => !before.includes(line)).every((line) => line.includes(id)), edit.file).toBe(true);
    }
    const golden = plan?.edits.find((edit) => edit.file === "test/harness/golden-registry.ts");
    expect(golden?.after.split("\n").filter((line) => line.includes(id)).every((line) => line.trimStart().startsWith("//"))).toBe(true);
    // The scene's codes come from the scenario's data.
    const scene = plan?.files[0]?.text ?? "";
    expect(scene).toContain('campaignCard: "');
    for (const code of JSON.parse(readFileSync(path.join(ROOT, "data", "scenarios", `${id}.json`), "utf8")).stages as string[]) expect(scene).toContain(`"${code}"`);

    const run = cli(id, "--dry-run");
    expect(run.status).toBe(0);
    expect(run.output).toContain(`test/scenarios/${id}/scene.ts`);
    for (const item of plan?.files ?? []) expect(exists(item.file), item.file).toBe(false);
    for (const edit of plan?.edits ?? []) expect(repo.read(edit.file), edit.file).toBe(edit.before);
  });
});
