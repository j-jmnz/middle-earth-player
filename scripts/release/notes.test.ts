import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { obtainiumUrl, renderNotes, type NotesInput } from "./notes.ts";
import { parseCommit } from "./version.ts";

const base: NotesInput = {
  tag: "v0.4.0",
  previousTag: "v0.3.2",
  changes: [
    parseCommit("feat: Lost in Mirkwood is playable (#40)", ""),
    parseCommit("fix: Staging attackers make their additional attacks (#41)", "Breaking: Saves made in 0.3 lose their open scenario"),
    parseCommit("style: The quest card shows its stage number (#42)", ""),
    parseCommit("repo: Refresh the card data (#43)", ""),
    parseCommit("repo: Tidy the brief (#44)", ""),
  ],
  repository: "j-jmnz/middle-earth-player",
  catalogVersion: 123,
  engineVersion: 25,
  reach: undefined,
};

describe("release notes (.claude/rules/release-standards.md, Release notes)", () => {
  it("lists player-facing commits by section, counts repo commits and links the comparison", () => {
    const notes = renderNotes(base);
    expect(notes).toContain("## Before you update\n\n- Saves made in 0.3 lose their open scenario\n");
    expect(notes).toContain("## New\n\n- Lost in Mirkwood is playable (#40)\n");
    expect(notes).toContain("## Fixes\n\n- Staging attackers make their additional attacks (#41)\n");
    expect(notes).toContain("## Look and feel\n\n- The quest card shows its stage number (#42)\n");
    expect(notes).not.toContain("Under the hood");
    expect(notes).not.toContain("Refresh the card data");
    expect(notes).toContain("Plus 2 project changes");
    expect(notes).toContain("https://github.com/j-jmnz/middle-earth-player/compare/v0.3.2...v0.4.0");
    expect(notes.indexOf("Before you update")).toBeLessThan(notes.indexOf("## New"));
  });

  it("names the scenarios whose open games the update can reach, and warns of nothing when none", () => {
    const some = renderNotes({ ...base, changes: [], reach: { all: false, names: ["The Oath", "The Drowned Ruins"] } });
    expect(some).toContain("## Before you update\n\n- Open games of The Oath and The Drowned Ruins may ask you to continue or restart");
    expect(renderNotes({ ...base, changes: [], reach: { all: true, names: [] } })).toContain("- Open games of any scenario may ask you to continue or restart");
    expect(renderNotes({ ...base, changes: [], reach: { all: false, names: [] } })).not.toContain("Before you update");
  });

  it("adds the APK's checksums, and marks the first release without a project count or comparison", () => {
    const apk = { name: "middle-earth-player-v0.1.0.apk", sha256: "ab12", certificateSha256: "cd34" };
    const notes = renderNotes({ ...base, tag: "v0.1.0", previousTag: undefined, reach: undefined, apk });
    expect(notes.startsWith("The first release.\n")).toBe(true);
    expect(notes).not.toContain("Plus ");
    expect(notes).not.toContain("compare/");
    expect(notes).toContain("`middle-earth-player-v0.1.0.apk` SHA-256: `ab12`");
    expect(notes).toContain("Signing certificate SHA-256: `cd34`");
  });

  it("gives the SideStore and AltStore source, and the TestFlight beta only while its link is set", () => {
    const notes = renderNotes({ ...base, ipa: { name: "middle-earth-player-v0.4.0.ipa", sha256: "ef56" } });
    expect(notes).toContain("add the source `https://github.com/j-jmnz/middle-earth-player/releases/latest/download/source.json`");
    expect(notes).toContain("`middle-earth-player-v0.4.0.ipa` SHA-256: `ef56`");
    expect(notes).not.toContain("TestFlight");
    expect(renderNotes({ ...base, testflightUrl: "https://testflight.apple.com/join/abc" })).toContain("[its public link](https://testflight.apple.com/join/abc)");
  });

  it("links the app into Obtainium for Android updates, with the link the README gives", () => {
    const url = obtainiumUrl(base.repository);
    expect(JSON.parse(decodeURIComponent(url.split("obtainium://app/")[1] ?? ""))).toEqual({
      id: "com.middleearth.player",
      url: "https://github.com/j-jmnz/middle-earth-player",
      author: "j-jmnz",
      name: "Middle-Earth Player",
    });
    expect(renderNotes(base)).toContain(`[Add to Obtainium](${url})`);
    expect(readFileSync(new URL("../../README.md", import.meta.url), "utf8")).toContain(`[Add to Obtainium](${url})`);
  });

  it("gives a Windows, a Mac and a Linux install line, and each desktop file's checksum", () => {
    const notes = renderNotes({
      ...base,
      desktop: [
        { name: "middle-earth-player-v0.4.0-win-x64.exe", sha256: "aa11" },
        { name: "middle-earth-player-v0.4.0-mac-universal.dmg", sha256: "bb22" },
        { name: "middle-earth-player-v0.4.0-linux-x64.AppImage", sha256: "cc33" },
      ],
    });
    expect(notes).toContain("- Windows: download the `-win-x64.exe` installer");
    expect(notes).toContain("SmartScreen warns first: choose More info, then Run anyway");
    expect(notes).toContain("- Mac: download the `.dmg`");
    expect(notes).toContain("right-click it and choose Open");
    expect(notes).toContain("- Linux: download the `.AppImage`");
    expect(notes).toContain("\n`middle-earth-player-v0.4.0-win-x64.exe` SHA-256: `aa11`\n");
    expect(notes).toContain("\n`middle-earth-player-v0.4.0-mac-universal.dmg` SHA-256: `bb22`\n");
    expect(notes).toContain("\n`middle-earth-player-v0.4.0-linux-x64.AppImage` SHA-256: `cc33`\n");
    // The install lines are there before any file is built, as the Android and iPhone ones are.
    expect(renderNotes(base)).toContain("- Windows: download");
    expect(renderNotes(base)).not.toContain("SHA-256");
  });
});
