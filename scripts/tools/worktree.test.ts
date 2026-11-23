import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseWorktrees, removeWorktree, WORKTREE_USAGE, worktreeArguments, worktreePath } from "./worktree.ts";

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

  it("keeps the .cache link when git refuses a folder with uncommitted work, and removes folder and link on --force without touching the link's target", () => {
    const base = realpathSync(mkdtempSync(path.join(os.tmpdir(), "worktree-test-")));
    try {
      const run = (cwd: string, ...args: string[]) => {
        const done = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8" });
        expect(done.status, `git ${args.join(" ")}: ${done.stderr}`).toBe(0);
      };
      const repo = path.join(base, "repo");
      mkdirSync(repo);
      run(repo, "init", "-q", "-b", "main");
      writeFileSync(path.join(repo, ".gitignore"), ".cache\n");
      writeFileSync(path.join(repo, "a.txt"), "a\n");
      run(repo, "add", ".");
      run(repo, "commit", "-q", "-m", "first");
      const folder = path.join(base, "repo-x");
      run(repo, "worktree", "add", "-q", "-b", "x", folder);
      const cache = path.join(base, "cache");
      mkdirSync(cache);
      writeFileSync(path.join(cache, "keep.txt"), "kept\n");
      symlinkSync(cache, path.join(folder, ".cache"), "dir");
      writeFileSync(path.join(folder, "work.txt"), "uncommitted\n");
      expect(() => removeWorktree(repo, folder, false)).toThrow(/use --force/);
      expect(existsSync(folder)).toBe(true);
      expect(lstatSync(path.join(folder, ".cache")).isSymbolicLink()).toBe(true);
      expect(existsSync(path.join(folder, ".cache", "keep.txt"))).toBe(true);
      removeWorktree(repo, folder, true);
      expect(existsSync(folder)).toBe(false);
      expect(existsSync(path.join(cache, "keep.txt"))).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
