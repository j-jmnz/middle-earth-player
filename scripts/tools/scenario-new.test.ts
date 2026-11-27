import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { authoredRelOfScenario } from "../data/effects/authored-paths.ts";
import { loadCampaignsInOrder } from "../data/load-scenarios.ts";
import { planScenario, SCENARIO_NEW_USAGE, scenarioNewArguments, type Repo } from "./scenario-new.ts";
import { POLICY_KIT_RULES } from "../../test/harness/policy-kit.ts";

// pnpm scenario new <scenario-id>: it plans from data/scenarios and the registries as they are, edits them only by inserting lines, never
// overwrites a file, and refuses an id that has no scenario file. Nothing is written here: the plan is read, and the CLI runs with --dry-run.
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const repo: Repo = { read: (file) => (existsSync(path.join(ROOT, file)) ? readFileSync(path.join(ROOT, file), "utf8") : null) };
const exists = (file: string): boolean => existsSync(path.join(ROOT, file));
const SCENARIOS = readdirSync(path.join(ROOT, "data", "scenarios")).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -".json".length));
const scaffolded = (id: string): boolean => exists(`src/effects/authored/${authoredRelOfScenario(id)}.ts`) || exists(`test/scenarios/${id}`);
// The next scenario the scaffold has not been run for: its previous part has its files (the planner refuses a part whose earlier part has none).
const NEW = loadCampaignsInOrder().flatMap((campaign) => campaign.scenarios.filter((id, at) => SCENARIOS.includes(id) && !scaffolded(id) && (at === 0 || scaffolded(campaign.scenarios[at - 1] as string))))[0];

// A scenario's rulings file, joined so the doc-path check (scripts/checks/agent-docs.test.ts) does not read it as a doc that must exist.
const docFile = (box: string, id: string): string => ["docs", "scenarios", box, `${id}.md`].join("/");

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
  "scripts/e2e/writers.ts": { start: /^export const WRITERS\b/, end: /^};$/ },
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
  const run = spawnSync("node", ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", path.join(ROOT, "scripts", "tools", "scenario-new.ts"), ...args], { cwd: ROOT, encoding: "utf8", env: { ...process.env, LOG_LEVEL: "info" } });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

// Each `cli` call starts node and loads the planner (about 2 s alone, more on a loaded machine) and each skeleton check starts tsrs, so the file runs about 35 s and is a slow file (vitest.config.mts, slowFiles): its tests get a minute, not the default 5 s.
describe("pnpm scenario new", { timeout: 60_000 }, () => {
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
    expect(plan?.edits.map((edit) => edit.file)).toEqual(["src/campaign/fixtures/registry.ts", "src/campaign/fixtures.ts", "scripts/e2e/writers.ts", "test/harness/golden-registry.ts"]);
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
    const writers = plan?.edits.find((edit) => edit.file === "scripts/e2e/writers.ts");
    const writerLines = writers?.after.split("\n") ?? [];
    const from = writerLines.findIndex((line) => /^export const WRITERS\b/.test(line));
    const to = writerLines.findIndex((line, index) => index > from && /^};$/.test(line));
    expect(writerLines.slice(from, to).some((line) => line.startsWith(`  "${id}": () => `))).toBe(true);
  });

  it("writes a scenario of a campaign with an authored folder into that folder, with the imports of its depth", () => {
    const id = "the-tower-of-cirith-ungol";
    const view = without(id);
    const { plan, problems } = planScenario(id, {}, view.repo, view.exists);
    expect(problems).toEqual([]);
    const authored = plan?.files.find((item) => item.file.startsWith("src/effects/authored/"));
    expect(authored?.file).toBe(`src/effects/authored/return-of-the-king/${id}.ts`);
    expect(authored?.text).toContain('from "../../../catalog/boundary.ts"');
    expect(authored?.text).toContain("from ../reprint.ts when");
    expect(cli(id, "--dry-run").output).toContain(`src/effects/authored/return-of-the-king/${id}.ts`);
  });

  // A scenario of a cycle (Shadows of Mirkwood) is standalone only: no campaign card, no campaign test, a standalone test, and standalone fixtures.
  it.each(["the-hunt-for-gollum", "conflict-at-the-carrock"])("plans the standalone skeletons of the cycle scenario %s", (id) => {
    const view = without(id);
    const { plan, problems } = planScenario(id, {}, view.repo, view.exists);
    expect(problems).toEqual([]);
    const files = plan?.files.map((item) => item.file) ?? [];
    expect(files).toContain(`src/campaign/scenarios/${id}/standalone.test.ts`);
    expect(files).not.toContain(`src/campaign/scenarios/${id}/campaign.test.ts`);
    expect(files).toContain(`scripts/e2e/shadows-of-mirkwood/${id}.ts`);
    expect(files).toContain(`src/effects/authored/shadows-of-mirkwood/${id}.ts`);
    const text = (name: string): string => plan?.files.find((item) => item.file.endsWith(name))?.text ?? "";
    expect(text("game.ts")).toContain("standaloneGame<");
    expect(text("game.ts")).toContain(`loadAnyScenario("${id}")`);
    expect(text("golden.test.ts")).toContain("standalone: true");
    expect(text(`shadows-of-mirkwood/${id}.ts`)).toContain("standaloneWonLost(");
    expect(text("standalone.test.ts")).toContain("it.todo(");
    const registry = plan?.edits.find((edit) => edit.file === "src/campaign/fixtures/registry.ts");
    expect(registry?.after).toContain(`scenarioId: "${id}", kind: "standalone"`);
    expect(plan?.edits.map((edit) => edit.file)).toEqual(["src/campaign/fixtures/registry.ts", "src/campaign/fixtures.ts", "scripts/e2e/writers.ts", "test/harness/golden-registry.ts"]);
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
        return file === "scripts/e2e/writers.ts" && text ? text.replace(/^(  "temple-of-the-deceived": .*)$/m, "$1\n$1") : text;
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
      `test/scenarios/${id}/screens.ts`,
      `src/campaign/scenarios/${id}/golden.test.ts`,
      `src/campaign/scenarios/${id}/campaign.test.ts`,
      `src/campaign/scenarios/${id}/spec.test.ts`,
      `src/play/words/asks/${id}.ts`,
      `scripts/e2e/${id}.ts`,
      `src/effects/authored/${id}.ts`,
      `src/campaign/fixtures/${id}.json`,
      docFile("dream-chaser", id),
    ]);
    expect(plan?.edits.map((edit) => edit.file)).toEqual(["src/campaign/fixtures/registry.ts", "src/campaign/fixtures.ts", "scripts/e2e/writers.ts", "test/harness/golden-registry.ts"]);
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

  // A scenario's rulings go in its own file under its box's folder in docs/scenarios/ (.claude/rules/docs-standards.md, Agent context).
  it.each([
    ["the-drowned-ruins", "dream-chaser", "The Drowned Ruins"],
    ["the-wastes-of-eriador", "angmar-awakened", "The Wastes of Eriador"],
    ["the-hunt-for-gollum", "shadows-of-mirkwood", "The Hunt for Gollum"],
  ])("writes the rulings file of %s, a title only, in its box's folder", (id, box, title) => {
    const file = docFile(box, id);
    const view = without(id);
    const { plan, problems } = planScenario(id, {}, view.repo, view.exists);
    expect(problems).toEqual([]);
    expect(plan?.files.find((item) => item.file === file)?.text).toBe(`# ${title}\n`);
    // A rulings file that exists already is kept, and does not stop the scaffold.
    const kept = planScenario(id, {}, view.repo, (name) => name === file || view.exists(name));
    expect(kept.problems).toEqual([]);
    expect(kept.plan?.files.map((item) => item.file)).not.toContain(file);
  });

  it("puts a campaign folder's seed finder in its folder, with imports one level deeper, and builds its log on the previous part's finder", () => {
    const id = "the-wastes-of-eriador";
    const view = without(id);
    const { plan, problems } = planScenario(id, {}, view.repo, view.exists);
    expect(problems).toEqual([]);
    const finder = plan?.files.find((item) => item.file === `scripts/e2e/angmar-awakened/${id}.ts`);
    expect(finder, "the finder is written in the campaign folder").toBeDefined();
    const text = finder?.text ?? "";
    expect(text).toContain('from "../../../test/scenarios/deadmens-dike/game.ts"');
    expect(text).toContain('from "../../../src/campaign/log.ts"');
    expect(text).toContain('from "../../log.ts"');
    expect(text).toContain('from "../seed-kit.ts"');
    expect(text).toContain('from "./deadmens-dike.ts"');
    expect(text).toContain("await hillsWonLog()");
    const writers = plan?.edits.find((edit) => edit.file === "scripts/e2e/writers.ts");
    expect(writers?.after).toContain(`from "./angmar-awakened/${id}.ts"`);
  });

  it("refuses a scenario whose previous part has no seed finder where the campaign keeps it", () => {
    const id = "the-wastes-of-eriador";
    const view = without(id);
    const missing: Repo = { read: (file) => (file === "scripts/e2e/angmar-awakened/deadmens-dike.ts" ? null : view.repo.read(file)) };
    const { plan, problems } = planScenario(id, {}, missing, view.exists);
    expect(plan).toBeNull();
    expect(problems.join(" ")).toContain("has no seed finder at scripts/e2e/angmar-awakened/deadmens-dike.ts");
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

// The type errors of a generated game.ts, written where its relative imports resolve (test/scenarios/<folder>/game.ts) and checked with the project's compiler on that one file; the files are deleted whatever happens.
function typeErrorsOf(text: string): string[] {
  const folder = `test/scenarios/zz-scaffold-check-${process.pid}`;
  const config = `tsconfig.scaffold-check-${process.pid}.json`;
  try {
    mkdirSync(path.join(ROOT, folder), { recursive: true });
    writeFileSync(path.join(ROOT, folder, "game.ts"), text);
    writeFileSync(path.join(ROOT, config), JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { types: ["node"] }, include: [`${folder}/game.ts`, "expo-env.d.ts", "nativewind-env.d.ts"] }));
    const run = spawnSync(path.join(ROOT, "node_modules", ".bin", "tsrs"), ["-p", config, "--noEmit"], { cwd: ROOT, encoding: "utf8" });
    return `${run.stdout}${run.stderr}`.split("\n").filter((line) => line.trim() !== "");
  } finally {
    rmSync(path.join(ROOT, folder), { recursive: true, force: true });
    rmSync(path.join(ROOT, config), { force: true });
  }
}

// The game.ts skeleton of a campaign scenario and of a cycle scenario starts from the play policy kit (test/harness/policy-kit.ts), with a comment that lists the kit's rules.
describe("the game.ts skeleton", () => {
  const kit = readFileSync(path.join(ROOT, "test/harness/policy-kit.ts"), "utf8");
  const exported = [...kit.matchAll(/^export (?:function|const) (\w+)/gm)].map((found) => found[1] as string).filter((name) => name !== "policyIntent" && name !== "POLICY_KIT_RULES");

  // A campaign scenario (the-drowned-ruins) and a cycle scenario (the-hunt-for-gollum).
  it.each(["the-drowned-ruins", "the-hunt-for-gollum"])("of %s calls the kit, lists its rules and type-checks against the harness", (id) => {
    const view = without(id);
    const { plan } = planScenario(id, {}, view.repo, view.exists);
    const text = plan?.files.find((item) => item.file === `test/scenarios/${id}/game.ts`)?.text ?? "";
    expect(text).toContain('from "../../harness/policy-kit.ts"');
    expect(text).toContain("policyIntent(rules(policy)");
    expect(text).not.toContain("nextIntent");
    for (const name of exported) expect(text, name).toContain(`//   ${name}`);
    expect(ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext } }).diagnostics).toEqual([]);
    // The type check takes about 3 s a skeleton (tsrs on the one file and what it imports), so it is a unit test, not a step of the scaffold.
    expect(typeErrorsOf(text)).toEqual([]);
  }, 60_000);

  it("fails the type check on a skeleton that misuses the harness", () => {
    const view = without("the-hunt-for-gollum");
    const { plan } = planScenario("the-hunt-for-gollum", {}, view.repo, view.exists);
    const text = plan?.files.find((item) => item.file === "test/scenarios/the-hunt-for-gollum/game.ts")?.text ?? "";
    expect(typeErrorsOf(text.replace("policy.choose", "policy.chose")).join("\n")).toContain("TS2551");
  }, 60_000);

  it("lists exactly the rules the kit exports", () => {
    expect(POLICY_KIT_RULES.map(([name]) => /^\w+/.exec(name)?.[0])).toEqual(exported);
  });
});

describe("scenario new arguments", () => {
  it("reads the id, --short with its value and --dry-run", () => {
    expect(scenarioNewArguments(["the-long-dark", "--short", "dark", "--dry-run"])).toEqual({ id: "the-long-dark", short: "dark", dry: true, help: false });
    expect(scenarioNewArguments(["the-long-dark"])).toEqual({ id: "the-long-dark", short: undefined, dry: false, help: false });
  });

  it("refuses a misspelt flag, so --dryrun does not write the skeleton files, and answers --help with help", () => {
    expect(() => scenarioNewArguments(["the-long-dark", "--dryrun"])).toThrow(SCENARIO_NEW_USAGE);
    expect(scenarioNewArguments(["--help"]).help).toBe(true);
  });
});
