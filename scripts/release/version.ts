import { COMMIT_TYPES } from "../git/commit-message.ts";

// The release version from the commits since the last release (docs/agents/release-standards.md, Versioning). Pure: the
// git reads are in plan.ts. The version lives only in the tag `v<major>.<minor>.<patch>`; app.config.js stamps it into the
// build from APP_VERSION.

export type Version = { major: number; minor: number; patch: number };
export type Bump = "major" | "minor" | "patch";
export type BumpRequest = Bump | "auto";
export type CommitType = (typeof COMMIT_TYPES)[number];

/**
 * One commit since the last release: its type (undefined for a subject from before the commit standards), its summary, its
 * `Breaking:` lines, and the issues its body names: `closes` from a `Settles` line, which the release closes (or a `Closes`,
 * `Fixes` or `Resolves` line from before that rule, which GitHub closed at the merge), `refs` from a `Refs` line (the docs/agents/issue-standards.md,
 * Finish).
 */
export type Change = { type: CommitType | undefined; summary: string; breaking: string[]; closes: number[]; refs: number[] };

export const BUMP_REQUESTS: readonly BumpRequest[] = ["auto", "patch", "minor", "major"];
const TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const TYPED = new RegExp(`^(${COMMIT_TYPES.join("|")}): (.+)$`);
const BREAKING = /^Breaking: *(.+)$/gm;
// A line that names issues: `Settles #12`, `Settles: #12, #13`, `Refs #14`, and GitHub's closing keywords of older commits.
const ISSUES = /^(settle[sd]?|close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?)\b:? *(#\d+(?:(?:, *| +and +| +)#\d+)*)/gim;
// The branches a release may be cut from (release-standards.md, Branches).
const RELEASE_BRANCH = /^(main|release\/v(0|[1-9]\d*)\.(0|[1-9]\d*))$/;

export function parseTag(tag: string): Version | undefined {
  const match = TAG.exec(tag);
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : undefined;
}

export function tagOf(version: Version): string {
  return `v${version.major}.${version.minor}.${version.patch}`;
}

/** The issues a body closes and the ones it only refers to, each once; an issue both closed and referred to counts as closed. */
function issuesOf(body: string): { closes: number[]; refs: number[] } {
  const closes = new Set<number>();
  const refs = new Set<number>();
  for (const [, keyword, list] of body.matchAll(ISSUES)) {
    const into = /^ref/i.test(keyword) ? refs : closes;
    for (const [, number] of list.matchAll(/#(\d+)/g)) into.add(Number(number));
  }
  return { closes: [...closes], refs: [...refs].filter((number) => !closes.has(number)) };
}

export function parseCommit(subject: string, body: string): Change {
  const match = TYPED.exec(subject.trim());
  const breaking = [...body.matchAll(BREAKING)].map((line) => line[1].trim());
  const issues = issuesOf(body);
  if (!match) return { type: undefined, summary: subject.trim(), breaking, ...issues };
  return { type: match[1] as CommitType, summary: match[2], breaking, ...issues };
}

/** The bump the commits call for: a `Breaking:` line is major, a feat minor, a fix, style or refactor patch; repo alone none. */
export function bumpOf(changes: readonly Change[]): Bump | undefined {
  if (changes.some((change) => change.breaking.length > 0)) return "major";
  if (changes.some((change) => change.type === "feat")) return "minor";
  if (changes.some((change) => change.type === "fix" || change.type === "style" || change.type === "refactor")) return "patch";
  return undefined;
}

/**
 * The next version, or undefined when "auto" finds nothing a player would notice. The first release is 0.1.0 (1.0.0 when
 * major is asked). Before 1.0.0 an automatic major bump is a minor one: 1.0.0 is a decision, asked for with "major".
 */
export function nextVersion(previous: Version | undefined, changes: readonly Change[], request: BumpRequest): Version | undefined {
  if (!previous) return request === "major" ? { major: 1, minor: 0, patch: 0 } : { major: 0, minor: 1, patch: 0 };
  const found = request === "auto" ? bumpOf(changes) : request;
  const bump = request === "auto" && found === "major" && previous.major === 0 ? "minor" : found;
  if (bump === "major") return { major: previous.major + 1, minor: 0, patch: 0 };
  if (bump === "minor") return { major: previous.major, minor: previous.minor + 1, patch: 0 };
  if (bump === "patch") return { ...previous, patch: previous.patch + 1 };
  return undefined;
}

/** Why a release may not be cut from this branch, or undefined; a release/vX.Y branch only cuts X.Y patches. */
export function branchProblem(branch: string, next: Version): string | undefined {
  const match = RELEASE_BRANCH.exec(branch);
  if (!match) return `releases are cut from main or a release/v<major>.<minor> branch, not "${branch}"`;
  if (match[2] === undefined) return undefined;
  if (Number(match[2]) !== next.major || Number(match[3]) !== next.minor) return `${branch} only cuts v${match[2]}.${match[3]}.x patches, not ${tagOf(next)}`;
  return undefined;
}
