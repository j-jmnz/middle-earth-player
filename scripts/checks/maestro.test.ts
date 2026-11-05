import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isPlayable } from "../../src/campaign/playable.ts";
import { FIXTURE_REGISTRY } from "../../src/campaign/fixtures/registry.ts";

// The Maestro flows (.maestro) checked without a phone: each file parses, each `runFlow` file exists and gets the env its subflow reads,
// each fixture a flow opens is in the fixture registry, and each `id:` is a testID the app sets. A cloud session cannot run Maestro, so
// this is what keeps a flow written there from naming a file, a variable or an id that is not there.

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const MAESTRO = path.join(ROOT, ".maestro");

type Node = null | string | Node[] | { [key: string]: Node };

// The subset of YAML the flows use: block maps and lists, plain and quoted scalars, whole-line comments. Anything else throws.
function parse(text: string, file: string): Node {
  const lines = text
    .split("\n")
    .map((raw, index) => ({ raw, number: index + 1 }))
    .filter(({ raw }) => raw.trim() !== "" && !raw.trim().startsWith("#"))
    .map(({ raw, number }) => ({ indent: raw.length - raw.trimStart().length, text: raw.trim(), number }));
  let at = 0;
  const fail = (message: string): never => {
    throw new Error(`${file}:${lines[at]?.number ?? "end"}: ${message}`);
  };
  const scalar = (value: string): Node => {
    if (value === "") return null;
    if (value.startsWith('"')) {
      if (!value.endsWith('"') || value.length < 2) fail(`unterminated string ${value}`);
      return value.slice(1, -1).replace(/\\(["\\])/g, "$1");
    }
    if (value.startsWith("'")) {
      if (!value.endsWith("'") || value.length < 2) fail(`unterminated string ${value}`);
      return value.slice(1, -1);
    }
    if (/^[[{|>&*!]/.test(value)) fail(`unsupported YAML ${value}`);
    return value;
  };
  const entry = (content: string): [string, string] | null => {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):(?: (.*))?$/.exec(content);
    return match ? [match[1] as string, (match[2] ?? "").trim()] : null;
  };
  function block(indent: number): Node {
    const first = lines[at];
    if (!first || first.indent < indent) return null;
    if (first.text.startsWith("- ") || first.text === "-") {
      const list: Node[] = [];
      while (lines[at] && lines[at]!.indent === first.indent && (lines[at]!.text.startsWith("- ") || lines[at]!.text === "-")) {
        const item = lines[at]!;
        const rest = item.text === "-" ? "" : item.text.slice(2).trim();
        const pair = entry(rest);
        at += 1;
        if (pair) {
          // A map that starts on the dash's line continues at the indent of its first key.
          const keyIndent = item.indent + 2;
          const map: { [key: string]: Node } = {};
          let current: [string, string] | null = pair;
          for (;;) {
            const [key, value] = current;
            if (key in map) fail(`duplicate key ${key}`);
            map[key] = value === "" ? (lines[at] && lines[at]!.indent > keyIndent ? block(keyIndent + 1) : null) : scalar(value);
            const next = lines[at];
            if (!next || next.indent !== keyIndent || next.text.startsWith("- ")) break;
            current = entry(next.text);
            if (!current) return fail(`not a key: ${next.text}`);
            at += 1;
          }
          list.push(map);
        } else if (rest === "") {
          list.push(lines[at] && lines[at]!.indent > item.indent ? block(item.indent + 1) : null);
        } else {
          list.push(scalar(rest));
        }
      }
      return list;
    }
    const map: { [key: string]: Node } = {};
    while (lines[at] && lines[at]!.indent === first.indent && !lines[at]!.text.startsWith("- ")) {
      const pair = entry(lines[at]!.text);
      if (!pair) return fail(`not a key: ${lines[at]!.text}`);
      const [key, value] = pair;
      at += 1;
      map[key] = value === "" ? (lines[at] && lines[at]!.indent > first.indent ? block(first.indent + 1) : null) : scalar(value);
    }
    return map;
  }
  const result = block(0);
  if (at < lines.length) fail("unexpected line");
  return result;
}

type Flow = { file: string; rel: string; config: { [key: string]: Node }; commands: Node[] };

// A flow is a config block, `---`, then the commands.
function load(file: string): Flow {
  const text = readFileSync(file, "utf8");
  const parts = text.split(/^---$/m);
  if (parts.length !== 2) throw new Error(`${file} needs one --- between its config and its commands`);
  const config = parse(parts[0] as string, file);
  const commands = parse(parts[1] as string, file);
  if (typeof config !== "object" || config === null || Array.isArray(config)) throw new Error(`${file}: the config is not a map`);
  if (!Array.isArray(commands)) throw new Error(`${file}: the commands are not a list`);
  return { file, rel: path.relative(MAESTRO, file), config, commands };
}

function yamlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? yamlFiles(full) : name.endsWith(".yaml") && name !== "config.yaml" ? [full] : [];
  });
}

const FLOWS = yamlFiles(MAESTRO).sort().map(load);
const SUBFLOWS = FLOWS.filter((flow) => flow.rel.startsWith("subflows"));
const RUNNABLE = FLOWS.filter((flow) => !flow.rel.startsWith("subflows"));

/** Every command in a flow, nested ones (repeat, runFlow commands) included. */
function walk(node: Node, visit: (name: string, value: Node) => void): void {
  if (Array.isArray(node)) for (const item of node) walk(item, visit);
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      visit(key, value);
      walk(value, visit);
    }
  } else if (typeof node === "string") visit(node, null);
}

function uses(flow: Flow, name: string): Node[] {
  const found: Node[] = [];
  walk(flow.commands, (key, value) => {
    if (key === name) found.push(value);
  });
  return found;
}

const asMap = (node: Node): { [key: string]: Node } => (node && typeof node === "object" && !Array.isArray(node) ? node : {});

const variablesOf = (flow: Flow): string[] => [...new Set([...readFileSync(flow.file, "utf8").matchAll(/\$\{([^}]*)\}/g)].flatMap((found) => [...(found[1] as string).matchAll(/[A-Z][A-Z0-9_]+/g)].map((word) => word[0])))];

// Env a subflow does not need to be given: those its header names ("Optional env: ...") and those its guards test with typeof.
function optionalEnv(flow: Flow): Set<string> {
  const text = readFileSync(flow.file, "utf8");
  const named = [...text.matchAll(/^# Optional env: (.*)$/gm)].flatMap((found) => [...(found[1] as string).matchAll(/\b[A-Z][A-Z0-9_]+\b/g)].map((word) => word[0]));
  const guarded = [...text.matchAll(/typeof ([A-Z][A-Z0-9_]+)/g)].map((found) => found[1] as string);
  return new Set([...named, ...guarded]);
}

const SCENARIO_IDS = readdirSync(path.join(ROOT, "data", "scenarios")).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -".json".length));
const CAMPAIGNS = readdirSync(path.join(ROOT, "data", "campaigns")).filter((name) => name.endsWith(".json")).map((name) => JSON.parse(readFileSync(path.join(ROOT, "data", "campaigns", name), "utf8")) as { id: string; scenarios?: string[] }).filter((item): item is { id: string; scenarios: string[] } => Array.isArray(item.scenarios));
const FIXTURE_NAMES = new Set<string>(FIXTURE_REGISTRY.flatMap((entry) => entry.names));
// Names that older flows open and no script writes: the fixture route opens nothing for them, so those flows cannot run until a fixture or a change to the flow exists.
const UNWRITTEN = new Set(["breaking-solo", "breaking-pair", "breaking-won", "breaking-lost", "ford-start", "ford-won", "ford-lost", "south-start", "south-stage-4", "south-won", "south-lost", "moria-won", "moria-lost", "moria-pairs"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(tsx?|ts)$/.test(name) ? [full] : [];
  });
}
// Every line of src: an id is built in one string or template literal, so its fixed parts must follow each other within one line.
const SOURCE_LINES = sourceFiles(path.join(ROOT, "src")).flatMap((file) => readFileSync(file, "utf8").split("\n"));
const inOrder = (line: string, parts: readonly string[]): boolean => {
  let at = 0;
  for (const part of parts) {
    const found = line.indexOf(part, at);
    if (found < 0) return false;
    at = found + part.length;
  }
  return true;
};

// The static part of an id: a scenario id, a card code or a ${variable} is built at run time, so only the text around it is looked up.
function fragments(id: string): string[] {
  let pattern = id.replace(/\$\{[^}]*\}/g, "\0");
  for (const scenario of SCENARIO_IDS) pattern = pattern.split(scenario).join("\0");
  return pattern
    .replace(/\d+/g, "\0")
    .split(/\0|\.\*/)
    .filter((part) => part.replace(/-/g, "").length >= 3);
}

describe("the Maestro flows", () => {
  it("parse, each with the app id and its commands", () => {
    expect(FLOWS.length).toBeGreaterThan(0);
    for (const flow of FLOWS) expect(flow.config.appId, flow.rel).toBe("com.middleearth.lcg");
  });

  it("are run by config.yaml only from scenarios/<scenario-id>/ and features/, never the subflows", () => {
    const config = readFileSync(path.join(MAESTRO, "config.yaml"), "utf8");
    const globs = [...config.matchAll(/^\s*- "([^"]+)"$/gm)].map((found) => found[1]);
    expect(globs).toEqual(["scenarios/*/*", "features/*"]);
    expect(SUBFLOWS.length).toBeGreaterThan(0);
    for (const flow of RUNNABLE) expect(/^(scenarios\/[^/]+|features)\/[^/]+$/.test(flow.rel), flow.rel).toBe(true);
    for (const flow of SUBFLOWS) expect(/^subflows\/[^/]+$/.test(flow.rel), flow.rel).toBe(true);
    for (const flow of RUNNABLE.filter((item) => item.rel.startsWith("scenarios/"))) expect(SCENARIO_IDS, flow.rel).toContain(flow.rel.split("/")[1]);
  });

  it("run only subflow files that exist and pass each the env it reads, and nothing it does not", () => {
    let calls = 0;
    for (const flow of FLOWS) {
      for (const call of uses(flow, "runFlow")) {
        const options = asMap(call);
        if (typeof call === "string" || options.file == null) continue;
        calls += 1;
        const target = path.resolve(path.dirname(flow.file), options.file as string);
        expect(existsSync(target), `${flow.rel} runs ${options.file as string}`).toBe(true);
        const sub = SUBFLOWS.find((item) => item.file === target);
        expect(sub, `${flow.rel}: ${options.file as string} is a subflow under .maestro/subflows`).toBeDefined();
        if (!sub) continue;
        const given = Object.keys(asMap(options.env ?? null));
        const optional = optionalEnv(sub);
        const read = variablesOf(sub);
        expect(read.filter((name) => !optional.has(name) && !given.includes(name)), `${flow.rel} leaves env unset for ${sub.rel}`).toEqual([]);
        expect(given.filter((name) => !read.includes(name)), `${flow.rel} passes env ${sub.rel} never reads`).toEqual([]);
        // A choice goes with its prompt and its consequence.
        if (given.includes("CHOICE_ID")) expect(["CHOICE_PROMPT", "CHOICE_CONSEQUENCE"].filter((name) => !given.includes(name)), flow.rel).toEqual([]);
        // A second choice goes with its prompt and its consequence, and only after a first.
        if (given.includes("CHOICE2_ID")) {
          expect(["CHOICE_ID", "CHOICE2_PROMPT", "CHOICE2_CONSEQUENCE"].filter((name) => !given.includes(name)), flow.rel).toEqual([]);
        }
        // A seat label for the second choice goes only with a second choice.
        if (given.includes("CHOICE2_SEAT")) expect(given, flow.rel).toContain("CHOICE2_ID");
      }
    }
    expect(calls).toBeGreaterThan(0);
  });

  it("open only fixtures in src/campaign/fixtures/registry.ts", () => {
    for (const flow of FLOWS) {
      for (const link of uses(flow, "openLink")) {
        const found = /^middleearthlcg:\/\/e2e\/(.+)$/.exec(String(link));
        if (!found) continue;
        const name = found[1] as string;
        if (name === "${FIXTURE}") continue;
        expect(FIXTURE_NAMES.has(name) || UNWRITTEN.has(name), `${flow.rel} opens ${name}`).toBe(true);
      }
      // A flow that fills a subflow's FIXTURE names a fixture too.
      for (const call of uses(flow, "runFlow")) {
        const fixture = asMap(asMap(call).env ?? null).FIXTURE;
        if (typeof fixture === "string") expect(FIXTURE_NAMES.has(fixture), `${flow.rel} passes FIXTURE ${fixture}`).toBe(true);
      }
    }
  });

  it("pass a SCENARIO_ID that is a scenario in data/scenarios", () => {
    for (const flow of RUNNABLE) {
      for (const call of uses(flow, "runFlow")) {
        const id = asMap(asMap(call).env ?? null).SCENARIO_ID;
        if (id != null) expect(SCENARIO_IDS, flow.rel).toContain(id);
      }
    }
  });

  it("read only ids the app sets in the subflows and the flows that run them: each id's fixed text is in src", () => {
    const missing: string[] = [];
    const onKit = FLOWS.filter((flow) => flow.rel.startsWith("subflows") || uses(flow, "runFlow").some((call) => asMap(call).file != null));
    expect(onKit.length).toBeGreaterThan(SUBFLOWS.length);
    for (const flow of onKit) {
      const ids = new Set<string>();
      walk(flow.commands, (key, value) => {
        if (key === "id" && typeof value === "string") ids.add(value);
      });
      for (const id of ids) {
        const parts = fragments(id);
        if (!SOURCE_LINES.some((line) => inOrder(line, parts))) missing.push(`${flow.rel}: ${id} (${parts.join(" ... ")} in one line of src)`);
      }
    }
    expect(missing).toEqual([]);
  });

  // The line under the road that says the next part is coming soon is true only while that part is not playable, so a part becoming playable
  // fails here (and in the coverage check) until the flow of the part before it stops asserting it. A flow under scenarios/<id>/ is about that scenario;
  // a top-level flow (features/) names none and is skipped. A scenario in two campaigns has a follower in each, and each is checked.
  it("assert path-soon only on a part followed by one the app cannot deal, and every such part's flows assert it", () => {
    const assertsSoon = (flow: Flow): boolean => uses(flow, "assertVisible").some((call) => asMap(call).id === "path-soon");
    const scenarioOf = (flow: Flow): string | null => /^scenarios\/([^/]+)\/[^/]+$/.exec(flow.rel)?.[1] ?? null;
    const followersOf = (id: string): { campaign: string; next: string | undefined }[] =>
      CAMPAIGNS.filter((item) => item.scenarios.includes(id)).map((item) => ({ campaign: item.id, next: item.scenarios[item.scenarios.indexOf(id) + 1] }));
    for (const flow of RUNNABLE.filter(assertsSoon)) {
      const id = scenarioOf(flow);
      expect(id, `${flow.rel} asserts path-soon but is not under scenarios/<scenario-id>/`).not.toBeNull();
      const followers = followersOf(id as string);
      expect(followers.length, `${flow.rel}: ${id} is in no campaign`).toBeGreaterThan(0);
      for (const { campaign, next } of followers) expect(next != null && !isPlayable(next), `${flow.rel} asserts path-soon, so the part after ${id} in ${campaign} must not be playable`).toBe(true);
    }
    for (const item of CAMPAIGNS) {
      item.scenarios.forEach((id, index) => {
        const next = item.scenarios[index + 1];
        if (next == null || isPlayable(next) || !isPlayable(id)) return;
        const flows = RUNNABLE.filter((flow) => scenarioOf(flow) === id);
        expect(flows.some(assertsSoon), `${id} is followed by ${next} in ${item.id}, which is not playable: a flow of ${id} must assert path-soon`).toBe(true);
      });
    }
  });
});
