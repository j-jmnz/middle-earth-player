import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CATALOG_VERSION } from "../../src/catalog/version.ts";
import { ENGINE_CHANGES, ENGINE_VERSION } from "../../src/rules/engine/version.ts";
import { runScript, type Log } from "../log.ts";
import { renderNotes } from "./notes.ts";
import { fileSha256 } from "./sha256.ts";
import { reachedScenarios, type GoldenChecks } from "./reach.ts";
import { BUMP_REQUESTS, branchProblem, nextVersion, parseCommit, parseTag, tagOf, type BumpRequest, type Change } from "./version.ts";

// Plans a release from git: the next tag and its notes (.claude/rules/release-standards.md; docs/releasing.md says how the
// release workflow calls it). Offline; reads only this checkout, so `git fetch --tags` first.
// Usage: pnpm release plan [--bump auto|patch|minor|major] prints the next tag and its notes. In CI:
//   --branch <name>        the branch being released (default: GITHUB_REF_NAME, else the checked-out branch)
//   --expect <tag>         fails unless the planned tag is this one (the publish job re-plans the tag the plan job chose)
//   --notes <file>         writes the notes there instead of printing them
//   --apk <file>           adds the APK's name and SHA-256 to the notes; --cert-sha256 <hex> adds its signing certificate
//   --ipa <file>           adds the IPA's name and SHA-256
//   --desktop <file>       adds a desktop installer's name and SHA-256; repeat it for each of the three OSes' files
//   --windows-signed       says the Windows installer is signed (the plan job's desktop_signed), so the notes do not warn of SmartScreen
//   --dry-run              a branch other than main or release/vX.Y only warns, so the pipeline can be tried from any branch
//   --github-output        writes tag, version and previous_tag to $GITHUB_OUTPUT and the notes to $GITHUB_STEP_SUMMARY
// TESTFLIGHT_URL (the repository variable of that name, set while the optional TestFlight channel runs) adds its public link.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RELEASE_TAGS = "v[0-9]*.[0-9]*.[0-9]*";
const FIELD = "\u001f";
const RECORD = "\u001e";

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).trim();
}

function tryGit(args: string[]): string | undefined {
  try {
    return git(args);
  } catch {
    return undefined;
  }
}

/** Every value of a flag given more than once (`--desktop a --desktop b`). */
export function flagValues(args: readonly string[], name: string): string[] {
  const values: string[] = [];
  args.forEach((arg, at) => {
    if (arg !== name) return;
    const value = args[at + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} needs a value`);
    values.push(value);
  });
  return values;
}

function flag(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  const value = args[at + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value`);
  return value;
}

/** The newest release tag reachable from HEAD, so a release/vX.Y branch counts from its own line. */
function previousTag(): string | undefined {
  return tryGit(["describe", "--tags", "--abbrev=0", "--match", RELEASE_TAGS, "HEAD"]);
}

function changesSince(tag: string | undefined): Change[] {
  const range = tag ? [`${tag}..HEAD`] : ["HEAD"];
  const log = git(["log", "--no-merges", `--format=%s${FIELD}%b${RECORD}`, ...range]);
  return log
    .split(RECORD)
    .map((record) => record.trim())
    .filter((record) => record !== "")
    .map((record) => {
      const [subject, body = ""] = record.split(FIELD);
      return parseCommit(subject, body);
    });
}

function engineVersionAt(tag: string): number | undefined {
  const source = tryGit(["show", `${tag}:src/rules/engine/version.ts`]);
  const match = source ? /ENGINE_VERSION = (\d+)/.exec(source) : null;
  return match ? Number(match[1]) : undefined;
}

const SCENARIOS = "src/campaign/scenarios";

function checksOf(json: string): GoldenChecks {
  return (JSON.parse(json) as { name: string; checks?: number[] }[]).map(({ name, checks }) => ({ name, checks }));
}

/** The checks each scenario's golden.json pins, at a tag or (no tag) in this checkout. */
function goldenChecks(tag: string | undefined): Map<string, GoldenChecks> {
  const out = new Map<string, GoldenChecks>();
  for (const id of readdirSync(path.join(ROOT, SCENARIOS))) {
    const file = `${SCENARIOS}/${id}/golden.json`;
    const json = tag ? tryGit(["show", `${tag}:${file}`]) : existsSync(path.join(ROOT, file)) ? readFileSync(path.join(ROOT, file), "utf8") : undefined;
    if (json) out.set(id, checksOf(json));
  }
  return out;
}

/** A scenario as players read it in the notes: its name without the campaign suffix. */
function scenarioName(id: string): string {
  const data = JSON.parse(readFileSync(path.join(ROOT, "data", "scenarios", `${id}.json`), "utf8")) as { name: string };
  return data.name.replace(/ \(Campaign\)$/, "");
}

function repository(): string {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { repository?: { url?: string } };
  const match = /github\.com\/([^/]+\/[^/.]+)/.exec(pkg.repository?.url ?? "");
  if (!match) throw new Error("no GitHub repository in package.json or GITHUB_REPOSITORY");
  return match[1];
}

/** The scenarios whose open games this release can reach: golden checks that changed since the previous tag, and ENGINE_CHANGES lines after its engine version (reach.ts). */
function reach(previous: string): { all: boolean; names: string[] } {
  const found = reachedScenarios({ previousEngineVersion: engineVersionAt(previous), engineChanges: ENGINE_CHANGES, previous: goldenChecks(previous), current: goldenChecks(undefined) });
  return { all: found.all, names: found.scenarios.map(scenarioName) };
}

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  const request = (flag(args, "--bump") ?? "auto") as BumpRequest;
  if (!BUMP_REQUESTS.includes(request)) throw new Error(`--bump is one of ${BUMP_REQUESTS.join(", ")}, not "${request}"`);
  const branch = flag(args, "--branch") ?? process.env.GITHUB_REF_NAME ?? git(["rev-parse", "--abbrev-ref", "HEAD"]);

  const previous = previousTag();
  const changes = changesSince(previous);
  const next = nextVersion(previous ? parseTag(previous) : undefined, changes, request);
  if (!next) throw new Error(`nothing a player would notice since ${previous} (only repo commits): pass --bump patch to release anyway`);
  const tag = tagOf(next);
  log.info(`${previous ?? "no earlier release"} → ${tag} from ${branch}, ${changes.length} commits`);

  const problem = branchProblem(branch, next);
  if (problem && args.includes("--dry-run")) log.warn(`${problem}; a dry run goes on`);
  else if (problem) throw new Error(problem);
  if (tryGit(["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`])) throw new Error(`${tag} already exists`);
  const headTags = git(["tag", "--points-at", "HEAD", "--list", RELEASE_TAGS]);
  if (headTags !== "") throw new Error(`HEAD is already released as ${headTags.split("\n").join(", ")}`);
  const expected = flag(args, "--expect");
  if (expected && expected !== tag) throw new Error(`planned ${tag}, expected ${expected}: a tag or commit moved since the plan`);

  const apkFile = flag(args, "--apk");
  const apk = apkFile ? { name: path.basename(apkFile), sha256: await fileSha256(apkFile), certificateSha256: flag(args, "--cert-sha256") } : undefined;
  const ipaFile = flag(args, "--ipa");
  const ipa = ipaFile ? { name: path.basename(ipaFile), sha256: await fileSha256(ipaFile) } : undefined;
  const desktop = await Promise.all(flagValues(args, "--desktop").map(async (file) => ({ name: path.basename(file), sha256: await fileSha256(file) })));
  const notes = renderNotes({
    tag,
    previousTag: previous,
    changes,
    repository: repository(),
    catalogVersion: CATALOG_VERSION,
    engineVersion: ENGINE_VERSION,
    reach: previous ? reach(previous) : undefined,
    apk,
    ipa,
    desktop: desktop.length > 0 ? desktop : undefined,
    windowsSigned: args.includes("--windows-signed"),
    testflightUrl: process.env.TESTFLIGHT_URL || undefined,
  });

  const notesFile = flag(args, "--notes");
  if (notesFile) writeFileSync(notesFile, notes);
  if (args.includes("--github-output")) {
    const output = process.env.GITHUB_OUTPUT;
    if (!output) throw new Error("--github-output needs GITHUB_OUTPUT");
    appendFileSync(output, `tag=${tag}\nversion=${tag.slice(1)}\nprevious_tag=${previous ?? ""}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `# ${tag}\n\n${notes}`);
  }
  if (!notesFile && !args.includes("--github-output")) process.stdout.write(`${tag}\n\n${notes}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("release:plan", main, { done: false });
