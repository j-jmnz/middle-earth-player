// The release announcement in the releases channel: the published release's notes (scripts/release/notes.ts) cut down
// to what a player reads, as one Discord embed. The player sections stay (Before you update, New, Fixes, Look and feel);
// the developer sections are counted in one line; the install steps, checksums and issue numbers stay on GitHub
// (docs/discord-issues.md, Release announcements).
import { discord, type Env } from "./env.ts";

export interface Release {
  tag_name: string;
  name?: string | null;
  html_url: string;
  body?: string | null;
  prerelease: boolean;
  draft: boolean;
}

// The sections a player reads, in the notes' order, with the heading the announcement gives each one.
const SHOWN: Record<string, string> = {
  "Before you update": "⚠️ Before you update",
  New: "✨ New",
  Fixes: "🛠️ Fixes",
  "Look and feel": "🎨 Look and feel",
};
// Sections that are counted, not listed: work players do not see. Install and anything after it is left to GitHub.
const COUNTED = new Set(["Under the hood", "Project (docs, tests, tooling, data refreshes)"]);
const STOP = "Install";
// An embed description holds at most 4096 characters; a section past this many lines points to GitHub for the rest.
const DESCRIPTION_MAX = 4096;
const LINES_MAX = 12;
// The embed's side colour: the app's gold.
const GOLD = 0xc9a227;

// A notes line as a player reads it: the issue numbers and pull request numbers are for GitHub readers.
function plainLine(line: string): string {
  return line
    .replace(/ · (closes|see) #\d+(, #\d+)*/g, "")
    .replace(/ \(#\d+\)$/, "")
    .trim();
}

/** The notes' sections by heading, each with its list lines, in order. */
export function sectionsOf(notes: string): { title: string; lines: string[] }[] {
  const sections: { title: string; lines: string[] }[] = [];
  for (const line of notes.split("\n")) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      if (heading[1] === STOP) break;
      sections.push({ title: heading[1]!.trim(), lines: [] });
    } else if (line.startsWith("- ") && sections.length > 0) {
      sections.at(-1)!.lines.push(plainLine(line));
    }
  }
  return sections;
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** The announcement's embed: a title, the player sections, a count of the rest, and how to update. */
export function announcement(release: Release, appName: string) {
  const sections = sectionsOf(release.body ?? "");
  const parts: string[] = [];
  for (const section of sections) {
    const heading = SHOWN[section.title];
    if (!heading || section.lines.length === 0) continue;
    const shown = section.lines.slice(0, LINES_MAX);
    const more = section.lines.length - shown.length;
    parts.push(`**${heading}**\n${shown.join("\n")}${more > 0 ? `\n- …and ${more} more on GitHub` : ""}`);
  }
  const behind = sections.filter((section) => COUNTED.has(section.title)).reduce((sum, section) => sum + section.lines.length, 0);
  if (behind > 0) parts.push(`Plus ${behind} behind-the-scenes ${behind === 1 ? "change" : "changes"} to keep things running smoothly.`);
  if (parts.length === 0) parts.push("Small improvements and fixes.");
  parts.push(
    `**📲 How to update**\nOn Android, Obtainium updates the app by itself; otherwise download the APK from the [release page](${release.html_url}). On iPhone and iPad, refresh the source in SideStore or AltStore. On a computer, download the installer from the release page. Your campaigns are kept.`,
  );
  return {
    title: clip(`${appName} ${release.tag_name} is out!`, 256),
    url: release.html_url,
    description: clip(parts.join("\n\n"), DESCRIPTION_MAX),
    color: GOLD,
    footer: { text: "Full release notes and downloads on GitHub" },
  };
}

/** Posts the announcement to RELEASES_CHANNEL_ID, mentioning RELEASES_ROLE_ID when it is set. A prerelease is not announced. */
export async function announceRelease(env: Env, release: Release): Promise<boolean> {
  if (!env.RELEASES_CHANNEL_ID || release.draft || release.prerelease) return false;
  const role = env.RELEASES_ROLE_ID;
  await discord(env, "POST", `/channels/${env.RELEASES_CHANNEL_ID}/messages`, {
    content: role ? `<@&${role}>` : undefined,
    embeds: [announcement(release, "Middle-Earth Player")],
    allowed_mentions: { roles: role ? [role] : [] },
  });
  return true;
}
