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

// A view of the repo as if `ids` had none of their lines in the registries and none of their files: the planner is tested on explicit ids,
// whether or not the real repo has scaffolded them yet. (Every registry line that names a scenario carries its id.)
function without(...ids: string[]): { repo: Repo; exists: (file: string) => boolean } {
  const names = (file: string): boolean => ids.some((id) => file.includes(id));
  return {
    repo: { read: (file) => repo.read(file)?.split("\n").filter((line) => !names(line)).join("\n") ?? null },
    exists: (file) => !names(file) && exists(file),
  };
}

// Where each registry's block starts and ends: an added line must land between these.
const BLOCKS: Record<string, { start: RegExp; end: RegExp } | undefined> = {
  "src/campaign/fixtures/registry.ts": { start: /^export const FIXTURE_REGISTRY = \[/, end: /^\] as const/ },
  "scripts/e2e/fixtures.ts": { start: /^const WRITERS\b/, end: /^};$/ },
  "test/harness/golden-registry.ts": { start: /^export const GOLDEN_REGISTRY\b/, end: /^\];$/ },
};

// The (0-based) index of the line `after` inserted, and the text; an edit inserts lines one at a time, so this is the index of each added line.
function addedAt(before: string, after: string): { at: number; line: string }[] {
  const old = before.split("\n");
  const added: { at: number; line: string }[] = [];
  after.split("\n").forEach((line, index) => {
    if (old[index - added.length] === line) return;
    added.push({ at: index, line });
  });
  return added;
}

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
    expect(problems.join(" ")).toContain("test/scenarios/the-thing-in-the-depths/game.ts");
    expect(problems.join(" ")).toContain("src/effects/authored/the-thing-in-the-depths.ts");
    expect(cli("the-thing-in-the-depths", "--dry-run").status).toBe(1);
  });

  // The previous part is registered (temple-of-the-deceived), the previous part is not (the-drowned-ruins), and the first part of a campaign.
  it.each([
    ["the-drowned-ruins", "a registered previous part", []],
    ["a-storm-on-cobas-haven", "an unregistered previous part", ["the-drowned-ruins"]],
    ["passage-through-mirkwood", "no previous part", []],
  ])("puts every added registry line of %s inside the object it edits (%s)", (id, _kind, alsoLeftOut) => {
    const view = without(id, ...alsoLeftOut);
    const { plan, problems } = planScenario(id, {}, view.repo, view.exists);
    expect(problems).toEqual([]);
    expect(plan?.edits.map((edit) => edit.file)).toEqual(["src/campaign/fixtures/registry.ts", "src/campaign/fixtures.ts", "scripts/e2e/fixtures.ts", "test/harness/golden-registry.ts"]);
    for (const edit of plan?.edits ?? []) {
      const lines = edit.after.split("\n");
      const added = addedAt(edit.before, edit.after);
      expect(added.length, edit.file).toBeGreaterThan(0);
      const block = BLOCKS[edit.file];
      // The fixtures.ts file has two: its import is outside any block, its FILES entry inside the map.
      for (const { at, line } of added) {
        if (line.startsWith("import ") || line.startsWith("// import ")) continue;
        const wanted = block ?? (edit.file === "src/campaign/fixtures.ts" ? { start: /^const FILES\b/, end: /^};$/ } : undefined);
        const start = lines.findIndex((one) => wanted?.start.test(one));
        const end = lines.findIndex((one, index) => index > start && wanted?.end.test(one));
        expect(start, `${edit.file}: block start`).toBeGreaterThanOrEqual(0);
        expect(at, `${edit.file}: "${line.trim()}" is after the block's declaration`).toBeGreaterThan(start);
        expect(at, `${edit.file}: "${line.trim()}" is before the block's closing line`).toBeLessThan(end);
      }
    }
    const writers = plan?.edits.find((edit) => edit.file === "scripts/e2e/fixtures.ts");
    const writerLines = writers?.after.split("\n") ?? [];
    const from = writerLines.findIndex((line) => /^const WRITERS\b/.test(line));
    const to = writerLines.findIndex((line, index) => index > from && /^};$/.test(line));
    expect(writerLines.slice(from, to).some((line) => line.startsWith(`  "${id}": () => `))).toBe(true);
  });

  it("refuses a short name that is not an identifier", () => {
    const view = without("the-drowned-ruins");
    const { plan, problems } = planScenario("the-drowned-ruins", { short: "dr-ruins" }, view.repo, view.exists);
    expect(plan).toBeNull();
    expect(problems.join(" ")).toContain("not a valid identifier");
  });

  it("refuses an anchor that matches more than once inside its block", () => {
    const view = without("the-drowned-ruins");
    const twice: Repo = {
      read: (file) => {
        const text = view.repo.read(file);
        // Two writers for the previous part: the planner cannot tell which one the new line follows.
        return file === "scripts/e2e/fixtures.ts" && text ? text.replace(/^(  "temple-of-the-deceived": .*)$/m, "$1\n$1") : text;
      },
    };
    const { plan, problems } = planScenario("the-drowned-ruins", {}, twice, view.exists);
    expect(plan).toBeNull();
    expect(problems.join(" ")).toContain("refusing to guess");
  });

  it("plans the skeletons and the registry lines of the next scenario without files, and writes nothing on --dry-run", () => {
    const id = "the-drowned-ruins";
    const view = without(id);
    const { plan, problems } = planScenario(id, {}, view.repo, view.exists);
    expect(problems).toEqual([]);
    expect(plan?.files.map((item) => item.file)).toEqual([
      `test/scenarios/${id}/game.ts`,
      `src/campaign/scenarios/${id}/golden.test.ts`,
      `src/campaign/scenarios/${id}/campaign.test.ts`,
      `src/campaign/scenarios/${id}/spec.test.ts`,
      `src/play/words/asks/${id}.ts`,
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
    // The skeleton reads the scenario from data/ (there is no scene file) and writes spec rows and an asks file.
    const text = (name: string): string => plan?.files.find((item) => item.file.endsWith(name))?.text ?? "";
    expect(plan?.files.map((item) => item.file)).not.toContain(`test/scenarios/${id}/scene.ts`);
    for (const item of plan?.files ?? []) expect(item.text, item.file).not.toMatch(/\/scene\.ts"/);
    expect(text("spec.test.ts")).toContain(`cardSpecs("${id}"`);
    expect(text(`asks/${id}.ts`)).toContain("export const ASKS");
    expect(text("game.ts")).toContain(`loadScenario("${id}")`);
    expect(text("campaign.test.ts")).toContain(`toBe("${(JSON.parse(readFileSync(path.join(ROOT, "data", "scenarios", `${id}.json`), "utf8")) as { campaignCard: string }).campaignCard}")`);

    for (const item of plan?.files ?? []) expect(view.exists(item.file), item.file).toBe(false);
    for (const edit of plan?.edits ?? []) expect(view.repo.read(edit.file), edit.file).toBe(edit.before);
  });

  it("takes no --track flag: it reads the flag as an id and refuses it", () => {
    const run = cli("--track", "fast", "--dry-run");
    expect(run.status).toBe(1);
  });

  // The CLI reads the real repo, so it runs on a scenario the real repo has not scaffolded yet (none, once every scenario has its files).
  it.skipIf(!NEW)("--dry-run on the real repo lists the files and writes nothing", () => {
    const id = NEW as string;
    const { plan, problems } = planScenario(id, {}, repo, exists);
    expect(problems).toEqual([]);
    const run = cli(id, "--dry-run");
    expect(run.status).toBe(0);
    expect(run.output).toContain(`src/campaign/scenarios/${id}/spec.test.ts`);
    for (const item of plan?.files ?? []) expect(exists(item.file), item.file).toBe(false);
    for (const edit of plan?.edits ?? []) expect(repo.read(edit.file), edit.file).toBe(edit.before);
  });
});
