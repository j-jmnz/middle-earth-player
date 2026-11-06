import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runScript, type Log } from "../log.ts";

// Checks commit subjects against .claude/rules/commit-standards.md (Subject line): "<type>: <summary>", one of the
// types below, at most 72 characters, no closing period.
// Usage: pnpm commit:check "<subject>"... checks the subjects given; --range <base>..<head> checks every non-merge
// commit in the range (CI checks a pull request's commits and its title, which becomes the squash commit's subject).

export const COMMIT_TYPES = ["fix", "feat", "refactor", "style", "repo"] as const;
export const SUBJECT_MAX = 72;

const SUBJECT = new RegExp(`^(${COMMIT_TYPES.join("|")}): \\S`);

/** What is wrong with a commit subject, or undefined when it follows the standard. */
export function subjectProblem(subject: string): string | undefined {
  if (!SUBJECT.test(subject)) return `"${subject}" does not start with "<type>: " (types: ${COMMIT_TYPES.join(", ")})`;
  if (subject.length > SUBJECT_MAX) return `"${subject}" is ${subject.length} characters; the limit is ${SUBJECT_MAX}`;
  if (subject.endsWith(".")) return `"${subject}" ends with a period`;
  return undefined;
}

function subjects(args: string[]): string[] {
  const at = args.indexOf("--range");
  if (at < 0) return args.filter((arg) => !arg.startsWith("--"));
  const range = args[at + 1];
  if (!range) throw new Error("--range needs <base>..<head>");
  const log = execFileSync("git", ["log", "--no-merges", "--format=%s", range], { encoding: "utf8" });
  return log.split("\n").filter((line) => line !== "");
}

function main(log: Log): void {
  const checked = subjects(process.argv.slice(2));
  if (checked.length === 0) throw new Error('usage: pnpm commit:check "<subject>"... | --range <base>..<head>');
  const problems = checked.map(subjectProblem).filter((problem) => problem !== undefined);
  if (problems.length === 0) return log.debug(`${checked.length} subjects follow .claude/rules/commit-standards.md`);
  for (const problem of problems) log.error(problem);
  throw new Error(`${problems.length} of ${checked.length} subjects break .claude/rules/commit-standards.md (Subject line)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("commit:check", main, { done: false });
