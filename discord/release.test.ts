// The release announcement, read from notes that scripts/release/notes.ts writes, so a change to the notes' shape fails here.
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderNotes } from "../scripts/release/notes.ts";
import type { Change } from "../scripts/release/version.ts";
import type { Env } from "./env.ts";
import { announcement, announceRelease, sectionsOf } from "./release.ts";

const change = (type: Change["type"], summary: string, extra: Partial<Change> = {}): Change => ({ type, summary, breaking: [], closes: [], refs: [], ...extra });

const notes = renderNotes({
  tag: "v0.4.0",
  previousTag: "v0.3.0",
  repository: "owner/repo",
  catalogVersion: 3,
  engineVersion: 9,
  reach: { all: false, names: [] },
  changes: [
    change("feat", "Add the Hunt for Gollum scenario"),
    change("fix", "Give Thurindir the Dúnedain trait", { closes: [121], refs: [99] }),
    change("style", "Show each spotlight attack as a matchup"),
    change("refactor", "Split the combat module"),
    change("repo", "Add a Discord bot that files GitHub issues", { breaking: [] }),
    change("repo", "Refresh the card data"),
  ],
});

const release = { tag_name: "v0.4.0", html_url: "https://github.com/owner/repo/releases/tag/v0.4.0", body: notes, prerelease: false, draft: false };

afterEach(() => vi.unstubAllGlobals());

describe("release announcement", () => {
  it("reads the notes' sections up to Install", () => {
    expect(sectionsOf(notes).map((section) => section.title)).toEqual(["New", "Fixes", "Look and feel", "Under the hood", "Project (docs, tests, tooling, data refreshes)"]);
  });

  it("keeps what players read, counts the rest and drops issue numbers", () => {
    const embed = announcement(release, "Middle-Earth Player");
    expect(embed.title).toBe("Middle-Earth Player v0.4.0 is out!");
    expect(embed.url).toBe(release.html_url);
    expect(embed.description).toContain("**✨ New**\n- Add the Hunt for Gollum scenario\n\n**🛠️ Fixes**\n- Give Thurindir the Dúnedain trait\n\n**🎨 Look and feel**\n- Show each spotlight attack as a matchup");
    expect(embed.description).toContain("Plus 3 behind-the-scenes changes to keep things running smoothly.");
    expect(embed.description).toContain("**📲 How to update**");
    expect(embed.description).not.toMatch(/#\d|SHA-256|Split the combat/);
  });

  it("puts Before you update first and shortens a long section", () => {
    const many = Array.from({ length: 15 }, (_, i) => change("fix", `Fix thing ${i + 1}`));
    const body = renderNotes({ tag: "v1.0.0", previousTag: "v0.4.0", repository: "owner/repo", catalogVersion: 3, engineVersion: 9, reach: { all: true, names: [] }, changes: many });
    const description = announcement({ ...release, body }, "App").description;
    expect(description.startsWith("**⚠️ Before you update**\n- Open games of any scenario")).toBe(true);
    expect(description).toContain("- Fix thing 12\n- …and 3 more on GitHub");
  });

  it("posts to the releases channel with the role ping, and skips a prerelease or a missing channel", async () => {
    const calls: { url: string; body: any }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return Response.json({});
    });
    const env = { DISCORD_BOT_TOKEN: "bot", RELEASES_CHANNEL_ID: "900", RELEASES_ROLE_ID: "55" } as Env;
    expect(await announceRelease(env, release)).toBe(true);
    expect(await announceRelease(env, { ...release, prerelease: true })).toBe(false);
    expect(await announceRelease({ ...env, RELEASES_CHANNEL_ID: undefined }, release)).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://discord.com/api/v10/channels/900/messages");
    expect(calls[0]!.body).toMatchObject({ content: "<@&55>", allowed_mentions: { roles: ["55"] }, embeds: [{ title: "Middle-Earth Player v0.4.0 is out!" }] });
  });
});
