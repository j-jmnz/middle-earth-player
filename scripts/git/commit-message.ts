import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runScript, type Log } from "../log.ts";

// Checks commit subjects against .claude/rules/commit-standards.md (Subject line): "<type>: <summary>", one of the
// types below, at most 72 characters, no closing period. A message file and a range also have their bodies checked for a
// Claude Code session link, which the repository is public enough to keep out (commit-standards.md, Body).
// Usage: pnpm commit:check "<subject>"... checks the subjects given; --range <base>..<head> checks every non-merge
// commit in the range (CI checks a pull request's commits and its title, which becomes the squash commit's subject);
// --file <path> checks a message file (the commit-msg hook, .githooks/commit-msg); --install points this checkout's
// git at .githooks (pnpm install runs it; outside a git checkout it does nothing).

export const COMMIT_TYPES = ["fix", "feat", "refactor", "style", "repo"] as const;
export const SUBJECT_MAX = 72;

const SUBJECT = new RegExp(`^(${COMMIT_TYPES.join("|")}): \\S`);
// Subjects git writes for `commit --fixup`, `--squash` and `--fixup=amend:`; a rebase folds them away.
const AUTOSQUASH = /^(fixup|squash|amend)! /;

/** What is wrong with a commit subject, or undefined when it follows the standard. */
export function subjectProblem(subject: string): string | undefined {
  if (!SUBJECT.test(subject)) return `"${subject}" does not start with "<type>: " (types: ${COMMIT_TYPES.join(", ")})`;
  if (subject.length > SUBJECT_MAX) return `"${subject}" is ${subject.length} characters; the limit is ${SUBJECT_MAX}`;
  if (subject.endsWith(".")) return `"${subject}" ends with a period`;
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

/** What is wrong with a commit message's body, or undefined when it names no Claude Code session. */
export function bodyProblem(message: string): string | undefined {
  const line = message.split("\n").find((text) => !text.startsWith("#") && SESSION_LINK.test(text.trim()));
  return line === undefined ? undefined : `"${subjectOf(message)}" names a Claude Code session ("${line.trim()}"); leave the link out`;
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
  const range = flag(args, "--range");
  if (range) {
    const bodies = git(["log", "--no-merges", "--format=%B%x00", range]).split("\0").map((text) => text.trim()).filter((text) => text !== "");
    return { subjects: bodies.map(subjectOf), bodies };
  }
  const given = args.filter((arg) => !arg.startsWith("--"));
  if (given.length === 0) throw new Error('usage: pnpm commit:check "<subject>"... | --range <base>..<head> | --file <path>');
  return { subjects: given, bodies: [] };
}

function main(log: Log): void {
  const args = process.argv.slice(2);
  if (args.includes("--install")) return install(log);
  const { subjects, bodies } = messages(args);
  const problems = [...subjects.map(subjectProblem), ...bodies.map(bodyProblem)].filter((problem) => problem !== undefined);
  if (problems.length === 0) return log.debug(`${subjects.length} commits follow .claude/rules/commit-standards.md`);
  for (const problem of problems) log.error(problem);
  throw new Error(`${problems.length} problems in ${subjects.length} commits break .claude/rules/commit-standards.md (Subject line, Body)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("commit:check", main, { done: false });
