import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runScript, type Log } from "../log.ts";
import { rangeProblems } from "./range-rules.ts";

// Checks commit subjects against .claude/rules/commit-standards.md (Subject line): "<type>: <summary>", one of the
// types below, at most 72 characters, no closing period, the summary an action (its first word an imperative verb). A message file and a range also have their bodies checked for a
// Claude Code session link, which the repository is public enough to keep out, and for a GitHub closing keyword before an issue
// number, which would close the issue at the merge instead of at the release (commit-standards.md, Body), for a co-author line
// that names Claude, and for a Pipeline measure without each task's times and the review findings.
// Usage: pnpm commit:check "<subject>"... checks the subjects given; --range <base>..<head> checks every non-merge
// commit in the range (CI checks a pull request's commits and its title, which becomes the squash commit's subject);
// --file <path> checks a message file (the commit-msg hook, .githooks/commit-msg); --description <path> checks only the body
// rules on a pull request's description, which becomes the squash commit's body (CI); --install points this checkout's
// git at .githooks (pnpm install runs it; outside a git checkout it does nothing).

export const COMMIT_TYPES = ["fix", "feat", "refactor", "style", "repo"] as const;
export const SUBJECT_MAX = 72;

const SUBJECT = new RegExp(`^(${COMMIT_TYPES.join("|")}): \\S`);
// Subjects git writes for `commit --fixup`, `--squash` and `--fixup=amend:`; a rebase folds them away.
const AUTOSQUASH = /^(fixup|squash|amend)! /;
// A trailing "checkpoint" marker (", checkpoint", "(checkpoint)", "- checkpoint"): the subject says what the step did
// instead (commit-standards.md, Commit often). A summary about the game's checkpoint, which ends in no such marker, passes.
const CHECKPOINT_MARKER = /(?:[,;:–—-]\s*|\(\s*)checkpoint\s*\)?$/i;

// A first word that cannot start an action: an article, a pronoun or a determiner ("The table menu scrolls", "Each card shows").
const NOT_A_VERB = new Set(["a", "an", "the", "this", "that", "these", "those", "each", "every", "all", "some", "any", "no", "both", "its", "it", "their", "they", "we", "i", "my", "our", "your", "you", "his", "her", "one", "there", "now"]);
// Imperatives that end like a third-person verb, a past verb or a gerund, which the endings below would otherwise refuse.
const ENDING_IMPERATIVES = new Set([
  "bring", "string", "spring", "sing", "swing", "ring", "wing", "ping", "sting", "cling", "fling", "sling",
  "embed", "feed", "seed", "shed", "need", "speed", "breed", "bleed", "proceed", "exceed", "succeed", "shred",
  "alias", "canvas", "bias",
]);

/** Why a summary's first word does not start an action, or undefined: an article or pronoun, or a verb ending in -s, -ed or -ing ("Adds", "Added", "Adding"). */
export function actionProblem(summary: string): string | undefined {
  const first = (/^[A-Za-z']+/.exec(summary)?.[0] ?? "").toLowerCase();
  if (first === "" || ENDING_IMPERATIVES.has(first)) return undefined;
  if (NOT_A_VERB.has(first)) return `starts with "${first}"; start the summary with the action, an imperative verb ("Show", "Fix", "Add")`;
  if (/[^s]s$/.test(first) && !/(us|is)$/.test(first)) return `starts with "${first}"; write the verb as an order ("Add", not "Adds"), or start with one`;
  if (first.length > 4 && /ed$/.test(first)) return `starts with "${first}"; write the verb as an order ("Fix", not "Fixed")`;
  if (first.length > 4 && /ing$/.test(first)) return `starts with "${first}"; write the verb as an order ("Show", not "Showing")`;
  return undefined;
}

/** What is wrong with a commit subject, or undefined when it follows the standard. */
export function subjectProblem(subject: string): string | undefined {
  if (!SUBJECT.test(subject)) return `"${subject}" does not start with "<type>: " (types: ${COMMIT_TYPES.join(", ")})`;
  if (subject.length > SUBJECT_MAX) return `"${subject}" is ${subject.length} characters; the limit is ${SUBJECT_MAX}`;
  if (subject.endsWith(".")) return `"${subject}" ends with a period`;
  if (CHECKPOINT_MARKER.test(subject)) return `"${subject}" ends with a checkpoint marker; say what the step did`;
  const action = actionProblem(subject.slice(subject.indexOf(": ") + 2));
  if (action) return `"${subject}" ${action}`;
  return undefined;
}

/** The subject of a message file as git stores it: the first line that is neither blank nor a "#" comment. */
export function subjectOf(message: string): string {
  return message.split("\n").find((line) => line.trim() !== "" && !line.startsWith("#"))?.trim() ?? "";
}

/**
 * The subjects the hook checks in a message file: none for an autosquash commit, or for a merge commit git is
 * writing (MERGE_HEAD exists; such a merge stays on a branch, which lands on main squashed).
 */
export function hookSubjects(message: string, merging: boolean): string[] {
  const subject = subjectOf(message);
  return merging || AUTOSQUASH.test(subject) ? [] : [subject];
}

// A `Claude-Session:` trailer or any link to a claude.ai Claude Code session, outside git's "#" comment lines.
const SESSION_LINK = /^claude-session:|claude\.ai\/code\/session/i;

// A GitHub closing keyword before an issue reference (`Closes #12`, `fixes: owner/repo#12`), anywhere in a line, as GitHub reads it
// (https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue). The
// release closes an issue instead (`Settles #12`; docs/agents/issue-standards.md, Finish).
// A co-author line that names Claude or Anthropic (the No Claude co-author line of .claude/rules/agent-standards.md); a person's stays.
const CLAUDE_CO_AUTHOR = /^co-authored-by:.*(claude|anthropic)/i;
// A scenario phase's measure names each task's time (docs/agents/agent-brief.md, Measure); any other change writes "Measure:".
const PIPELINE_MEASURE = /^pipeline measure:/im;
const PIPELINE_PARTS = [/wait minutes/i, /writing minutes/i, /review findings/i] as const;
const CLOSING_KEYWORD = /\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?\s*(?:[\w.-]+\/[\w.-]+)?#\d+/i;

/** What is wrong with a commit message's body, or undefined when it names no Claude Code session and closes no issue at the merge. */
export function bodyProblem(message: string): string | undefined {
  const lines = message.split("\n").filter((text) => !text.startsWith("#"));
  const session = lines.find((text) => SESSION_LINK.test(text.trim()));
  if (session !== undefined) return `"${subjectOf(message)}" names a Claude Code session ("${session.trim()}"); leave the link out`;
  const coAuthor = lines.find((text) => CLAUDE_CO_AUTHOR.test(text.trim()));
  if (coAuthor !== undefined) return `"${subjectOf(message)}" has "${coAuthor.trim()}"; no commit or pull request names Claude as a co-author`;
  const body = lines.join("\n");
  if (PIPELINE_MEASURE.test(body) && !PIPELINE_PARTS.every((part) => part.test(body)))
    return `"${subjectOf(message)}" has a Pipeline measure without each task's wait minutes, writing minutes and the review findings (docs/agents/agent-brief.md, Measure); a measure of any other change is "Measure:"`;
  const closing = lines.map((text) => CLOSING_KEYWORD.exec(text)?.[0]).find((found) => found !== undefined);
  if (closing !== undefined) return `"${subjectOf(message)}" has "${closing}", which closes the issue at the merge; write "Settles #<n>" so the release closes it`;
  return undefined;
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function merging(): boolean {
  try {
    git(["rev-parse", "--verify", "--quiet", "MERGE_HEAD"]);
    return true;
  } catch {
    return false;
  }
}

function install(log: Log): void {
  try {
    git(["rev-parse", "--git-dir"]);
  } catch {
    log.debug("not a git checkout; no hook installed");
    return;
  }
  git(["config", "core.hooksPath", ".githooks"]);
  log.debug("core.hooksPath is .githooks");
}

function flag(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  const value = args[at + 1];
  if (!value) throw new Error(`${name} needs a value`);
  return value;
}

/** The subjects to check, and the whole messages whose bodies are checked too (none for subjects given on the command line). */
function messages(args: string[]): { subjects: string[]; bodies: string[] } {
  const file = flag(args, "--file");
  if (file) {
    const message = readFileSync(file, "utf8");
    return { subjects: hookSubjects(message, merging()), bodies: [message] };
  }
  const description = flag(args, "--description");
  if (description) return { subjects: [], bodies: [readFileSync(description, "utf8")] };
  const range = flag(args, "--range");
  if (range) {
    const bodies = git(["log", "--no-merges", "--format=%B%x00", range]).split("\0").map((text) => text.trim()).filter((text) => text !== "");
    return { subjects: bodies.map(subjectOf), bodies };
  }
  const given = args.filter((arg) => !arg.startsWith("--"));
  if (given.length === 0) throw new Error('usage: pnpm commit:check "<subject>"... | --range <base>..<head> | --file <path> | --description <path>');
  return { subjects: given, bodies: [] };
}

/** What the commits of a range lack as a whole (scripts/git/range-rules.ts), read from the merge base of the range's two ends. */
function branchProblems(range: string, bodies: readonly string[]): string[] {
  const [from, to] = range.split("..");
  if (!from || !to) return [];
  const base = git(["merge-base", from, to]);
  const shown = (ref: string) => {
    try {
      return git(["show", `${ref}:src/campaign/playable.ts`]);
    } catch {
      return "";
    }
  };
  const changed = git(["diff", "--name-only", base, to]).split("\n").filter((file) => file !== "");
  return rangeProblems({ changed, bodies, playable: { base: shown(base), head: shown(to) } });
}

function main(log: Log): void {
  const args = process.argv.slice(2);
  if (args.includes("--install")) return install(log);
  const { subjects, bodies } = messages(args);
  const range = args.includes("--range") ? flag(args, "--range") : undefined;
  const problems = [...subjects.map(subjectProblem), ...bodies.map(bodyProblem), ...(range ? branchProblems(range, bodies) : [])].filter((problem) => problem !== undefined);
  if (problems.length === 0) return log.debug(`${subjects.length} commits follow .claude/rules/commit-standards.md`);
  for (const problem of problems) log.error(problem);
  throw new Error(`${problems.length} problems in ${subjects.length} commits break .claude/rules/commit-standards.md (Subject line, Body)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("commit:check", main, { done: false });
