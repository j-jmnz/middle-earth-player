import { describe, expect, it } from "vitest";

import { parseWorktrees, WORKTREE_USAGE, worktreeArguments, worktreePath } from "./worktree.ts";

// pnpm worktree add|remove: the folder's name, the porcelain it reads, and the arguments it accepts (it writes folders, so it refuses an unknown flag).
describe("worktree", () => {
  it("names the folder for the repository and the branch, beside the repository", () => {
    expect(worktreePath("/home/user/middle-earth-player", "feat/lost-in-mirkwood")).toBe("/home/user/middle-earth-player-feat-lost-in-mirkwood");
    expect(worktreePath("/a/repo", "fix/a b")).toBe("/a/repo-fix-a-b");
  });

  it("reads the worktrees git lists, with a detached head as no branch", () => {
    const porcelain = "worktree /a/repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /a/repo-x\nHEAD def\nbranch refs/heads/feat/x\n\nworktree /a/repo-y\nHEAD 123\ndetached\n";
    expect(parseWorktrees(porcelain)).toEqual([
      { path: "/a/repo", branch: "main" },
      { path: "/a/repo-x", branch: "feat/x" },
      { path: "/a/repo-y", branch: null },
    ]);
  });

  it("takes add <branch> [<base-ref>] and remove <branch> [--force], and refuses the rest with the usage", () => {
    expect(worktreeArguments(["add", "feat/x"])).toEqual({ command: "add", branch: "feat/x", base: undefined, force: false });
    expect(worktreeArguments(["add", "feat/x", "origin/main"])).toMatchObject({ base: "origin/main" });
    expect(worktreeArguments(["remove", "feat/x", "--force"])).toMatchObject({ command: "remove", force: true });
    expect(worktreeArguments(["--help"])).toBe("help");
    for (const bad of [[], ["add"], ["remove", "feat/x", "main"], ["add", "feat/x", "--force"], ["add", "feat/x", "--forse"], ["move", "x"], ["add", "a", "b", "c"]]) expect(() => worktreeArguments(bad), bad.join(" ")).toThrow(/usage|Unknown flag|--force/);
    expect(WORKTREE_USAGE).toContain("pnpm worktree add");
  });
});
