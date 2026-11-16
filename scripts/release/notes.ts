import { BUNDLE_ID, sourceUrl } from "./sideload-source.ts";
import { joinNames } from "./reach.ts";
import type { Change, CommitType } from "./version.ts";

// The release notes, written from the commits since the last release (.claude/rules/release-standards.md, Release notes).
// Pure: plan.ts gathers the commits, the versions and the APK's checksums.

export type NotesInput = {
  tag: string;
  previousTag: string | undefined;
  changes: readonly Change[];
  /** owner/name on GitHub, for the compare link. */
  repository: string;
  catalogVersion: number;
  engineVersion: number;
  /** The scenarios whose open games the update can reach (reach.ts), by the names players read; undefined on the first release. */
  reach: { all: boolean; names: readonly string[] } | undefined;
  apk?: { name: string; sha256: string; certificateSha256: string | undefined };
  ipa?: { name: string; sha256: string };
  /** The installers the desktop jobs built (the .exe, .zip, .dmg, .AppImage and .deb), each with its SHA-256. */
  desktop?: readonly { name: string; sha256: string }[];
  /** The desktop build did not finish for this release (the publish job ships the phone builds without it): the notes say there are no desktop files instead of linking them. */
  desktopMissing?: boolean;
  /** The Windows installer was signed with the project's certificate (the plan job's desktop_signed output), so SmartScreen does not warn first. */
  windowsSigned?: boolean;
  /** The TestFlight public link (the repository variable TESTFLIGHT_URL), set only while the optional TestFlight channel runs. */
  testflightUrl?: string;
};

// The sections a player reads, in order; repo commits are counted, not listed.
const SECTIONS: readonly { type: CommitType; title: string }[] = [
  { type: "feat", title: "New" },
  { type: "fix", title: "Fixes" },
  { type: "style", title: "Look and feel" },
  { type: "refactor", title: "Under the hood" },
];

/** The link that adds the app to Obtainium, which then installs each release from the Releases page (README, Install). The
 * Android package is the iOS bundle id. */
export function obtainiumUrl(repository: string): string {
  const app = { id: BUNDLE_ID, url: `https://github.com/${repository}`, author: repository.split("/")[0], name: "Middle-Earth Player" };
  return `https://apps.obtainium.imranr.dev/redirect?r=obtainium://app/${encodeURIComponent(JSON.stringify(app))}`;
}

export function renderNotes(input: NotesInput): string {
  const out: string[] = [];
  const warnings = input.changes.flatMap((change) => change.breaking);
  if (input.previousTag && input.reach?.all) warnings.push("Open games of any scenario may ask you to continue or restart; the campaign log is kept.");
  else if (input.previousTag && input.reach && input.reach.names.length > 0) warnings.push(`Open games of ${joinNames(input.reach.names)} may ask you to continue or restart; the campaign log is kept.`);
  if (!input.previousTag) out.push("The first release.", "");
  if (warnings.length > 0) out.push("## Before you update", "", ...warnings.map((line) => `- ${line}`), "");
  for (const { type, title } of SECTIONS) {
    const lines = input.changes.filter((change) => change.type === type).map((change) => `- ${change.summary}`);
    if (lines.length > 0) out.push(`## ${title}`, "", ...lines, "");
  }
  // The first release lists only typed commits: the history before the commit standards has no types to sort.
  const project = input.changes.filter((change) => change.type === "repo" || change.type === undefined).length;
  if (input.previousTag && project > 0) out.push(`Plus ${project} project ${project === 1 ? "change" : "changes"} (docs, tests, tooling, data refreshes).`, "");
  out.push(
    "## Install",
    "",
    "- Android: download the `.apk` below and open it. Allow your browser or file manager to install unknown apps when it asks. It installs over an earlier release and keeps your campaigns.",
    `- Android, with automatic updates: install [Obtainium](https://obtainium.imranr.dev), then tap [Add to Obtainium](${obtainiumUrl(input.repository)}) on your phone, or add \`https://github.com/${input.repository}\` in Obtainium yourself. It installs each new release over the last and keeps your campaigns.`,
    `- iPhone and iPad: in SideStore or AltStore, add the source \`${sourceUrl(input.repository)}\` and install Middle-Earth Player from it, or install the \`.ipa\` below. It is signed with your own Apple ID, updates over an earlier release and keeps your campaigns. The README (Install) has the steps.`,
    ...(input.desktopMissing
      ? ["- Windows, Mac and Linux: the desktop app is not part of this release, because its build did not finish. The next release brings it."]
      : [
      input.windowsSigned
        ? "- Windows: download the `-win-x64.exe` installer below and run it, or unzip the `-win-x64.zip` and run the app from the folder without installing. The installer is signed."
        : "- Windows: download the `-win-x64.exe` installer below and run it, or unzip the `-win-x64.zip` and run the app from the folder without installing. The app is not signed, so Windows SmartScreen warns first: choose More info, then Run anyway.",
      "- Mac: download the `.dmg`, open it and drag Middle-Earth Player to Applications. The app is not signed by Apple, so the first time, right-click it and choose Open, then Open again. It runs on Apple silicon and Intel Macs.",
      "- Linux: download the `.AppImage`, make it executable (`chmod +x`) and run it, or install the `.deb` with your package manager.",
      "- The desktop app plays fully offline and keeps your campaigns on that computer; Settings can back them up to a file.",
        ]),
  );
  if (input.testflightUrl) out.push(`- Or join the TestFlight beta through [its public link](${input.testflightUrl}); a release reaches it once Apple has reviewed the build.`);
  out.push("");
  const facts = [`Card data version ${input.catalogVersion}`, `engine version ${input.engineVersion}`];
  if (input.previousTag) facts.push(`[all changes](https://github.com/${input.repository}/compare/${input.previousTag}...${input.tag})`);
  out.push(facts.join(" · "));
  if (input.apk) {
    out.push("", `\`${input.apk.name}\` SHA-256: \`${input.apk.sha256}\``);
    if (input.apk.certificateSha256) out.push(`Signing certificate SHA-256: \`${input.apk.certificateSha256}\``);
  }
  if (input.ipa) out.push("", `\`${input.ipa.name}\` SHA-256: \`${input.ipa.sha256}\``);
  for (const file of input.desktop ?? []) out.push("", `\`${file.name}\` SHA-256: \`${file.sha256}\``);
  return `${out.join("\n")}\n`;
}
