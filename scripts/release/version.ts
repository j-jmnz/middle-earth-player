import { COMMIT_TYPES } from "../git/commit-message.ts";

// The release version from the commits since the last release (.claude/rules/release-standards.md, Versioning). Pure: the
// git reads are in plan.ts. The version lives only in the tag `v<major>.<minor>.<patch>`; app.config.js stamps it into the
// build from APP_VERSION.

export type Version = { major: number; minor: number; patch: number };
export type Bump = "major" | "minor" | "patch";
export type BumpRequest = Bump | "auto";
export type CommitType = (typeof COMMIT_TYPES)[number];

/** One commit since the last release: its type (undefined for a subject from before the commit standards), its summary and its `Breaking:` lines. */
export type Change = { type: CommitType | undefined; summary: string; breaking: string[] };

export const BUMP_REQUESTS: readonly BumpRequest[] = ["auto", "patch", "minor", "major"];
const TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const TYPED = new RegExp(`^(${COMMIT_TYPES.join("|")}): (.+)$`);
const BREAKING = /^Breaking: *(.+)$/gm;
// The branches a release may be cut from (release-standards.md, Branches).
const RELEASE_BRANCH = /^(main|release\/v(0|[1-9]\d*)\.(0|[1-9]\d*))$/;

export function parseTag(tag: string): Version | undefined {
  const match = TAG.exec(tag);
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : undefined;
}

export function tagOf(version: Version): string {
  return `v${version.major}.${version.minor}.${version.patch}`;
}

export function parseCommit(subject: string, body: string): Change {
  const match = TYPED.exec(subject.trim());
  const breaking = [...body.matchAll(BREAKING)].map((line) => line[1].trim());
  if (!match) return { type: undefined, summary: subject.trim(), breaking };
  return { type: match[1] as CommitType, summary: match[2], breaking };
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
