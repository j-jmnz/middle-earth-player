import { describe, expect, it } from "vitest";

import { issueComments, markerOf } from "./issue-comments.ts";
import { parseCommit } from "./version.ts";

const REPO = "j-jmnz/middle-earth-player";
const LINK = `[v0.3.1](https://github.com/${REPO}/releases/tag/v0.3.1)`;

describe("release issue comments (docs/releasing.md, Issue comments)", () => {
  it("says a closed issue is fixed in the release, with the commit's line and the marker", () => {
    const [comment] = issueComments([parseCommit("fix: Make Hasty Stroke cancel the shadow effect (#105)", "Closes #99")], "v0.3.1", REPO);
    expect(comment).toEqual({ issue: 99, body: `Fixed in ${LINK}:\n\n- Make Hasty Stroke cancel the shadow effect (#105)\n\n${markerOf("v0.3.1")}\n` });
  });

  it("says released for a closing change that is not a fix, and work for a referred issue", () => {
    const comments = issueComments([parseCommit("feat: Add the Hobbit saga (#110)", "Closes #50\nRefs #60")], "v0.3.1", REPO);
    expect(comments.map((comment) => comment.issue)).toEqual([50, 60]);
    expect(comments[0].body.startsWith(`Released in ${LINK}:`)).toBe(true);
    expect(comments[1].body.startsWith(`Work on this issue is in ${LINK}:\n\n- Add the Hobbit saga (#110)\n`)).toBe(true);
  });

  it("gathers every change that names an issue into one comment, and skips changes that name none", () => {
    const comments = issueComments(
      [parseCommit("fix: Keep the log on Undo (#120)", "Fixes #70"), parseCommit("repo: Tidy the brief (#121)", ""), parseCommit("refactor: Split the log store (#122)", "Refs #70")],
      "v0.3.1",
      REPO,
    );
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toContain(`Fixed in ${LINK}:\n\n- Keep the log on Undo (#120)\n\nWork on this issue in the same release:\n\n- Split the log store (#122)\n`);
  });
});
