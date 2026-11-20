import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { requiredFlag as flag } from "../args.ts";
import { runScript, type Log } from "../log.ts";
import { changesSince, releasedTag, repository } from "./plan.ts";
import type { Change } from "./version.ts";

// The comment each issue gets when a release ships a commit that names it (docs/releasing.md, Issue comments): the release's
// tag and link, and the lines of the notes that settle it or refer to it. Run by release.yml's publish job after the release is
// out; .github/scripts/comment-issues.sh posts them, once per issue and release, and closes each issue a commit settles.
// Usage: pnpm release issues --tag <tag> --out <file>, on the released commit. Writes a JSON list of { issue, body, close }.

/** `close` is true when a commit settles the issue (`Settles #n`): the release closes it. A `Refs` issue stays open. */
export type IssueComment = { issue: number; body: string; close: boolean };

/** The hidden line that marks an issue's comment for a release, so a rerun of the publish job does not post it again. */
export function markerOf(tag: string): string {
  return `<!-- release-comment:${tag} -->`;
}

/** One comment for each issue the changes settle or refer to, in issue order. A fix that settles an issue says it is fixed. */
export function issueComments(changes: readonly Change[], tag: string, repository: string): IssueComment[] {
  const numbers = [...new Set(changes.flatMap((change) => [...change.closes, ...change.refs]))].sort((a, b) => a - b);
  const release = `[${tag}](https://github.com/${repository}/releases/tag/${tag})`;
  return numbers.map((issue) => {
    const closing = changes.filter((change) => change.closes.includes(issue));
    const referring = changes.filter((change) => change.refs.includes(issue));
    const out: string[] = [];
    if (closing.length > 0) {
      const verb = closing.some((change) => change.type === "fix") ? "Fixed" : "Released";
      out.push(`${verb} in ${release}:`, "", ...closing.map((change) => `- ${change.summary}`), "");
    }
    if (referring.length > 0) {
      out.push(closing.length > 0 ? "Work on this issue in the same release:" : `Work on this issue is in ${release}:`, "", ...referring.map((change) => `- ${change.summary}`), "");
    }
    out.push(markerOf(tag));
    return { issue, body: `${out.join("\n")}\n`, close: closing.length > 0 };
  });
}

function main(log: Log): void {
  const args = process.argv.slice(2);
  const { previous, tag } = releasedTag(flag(args, "--tag"));
  const comments = issueComments(changesSince(previous), tag, repository());
  const out = flag(args, "--out");
  writeFileSync(out, `${JSON.stringify(comments, null, 2)}\n`);
  log.info(`${comments.length} issues named since ${previous ?? "the first commit"}, written to ${out}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("release:issues", main, { done: false });
