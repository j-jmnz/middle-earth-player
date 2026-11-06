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
  /** The engine version at the previous release; a different one drops an open scenario on update. */
  previousEngineVersion: number | undefined;
  apk?: { name: string; sha256: string; certificateSha256: string | undefined };
  /** The TestFlight public link (the repository variable TESTFLIGHT_URL), when it is set. */
  testflightUrl?: string;
};

// The sections a player reads, in order; repo commits are counted, not listed.
const SECTIONS: readonly { type: CommitType; title: string }[] = [
  { type: "feat", title: "New" },
  { type: "fix", title: "Fixes" },
  { type: "style", title: "Look and feel" },
  { type: "refactor", title: "Under the hood" },
];

export function renderNotes(input: NotesInput): string {
  const out: string[] = [];
  const warnings = input.changes.flatMap((change) => change.breaking);
  if (input.previousTag && input.previousEngineVersion !== undefined && input.previousEngineVersion !== input.engineVersion) {
    warnings.push("A scenario left open in an earlier release is dropped when this one opens; the campaign log is kept.");
  }
  if (!input.previousTag) out.push("The first release.", "");
  if (warnings.length > 0) out.push("## Before you update", "", ...warnings.map((line) => `- ${line}`), "");
  for (const { type, title } of SECTIONS) {
    const lines = input.changes.filter((change) => change.type === type).map((change) => `- ${change.summary}`);
    if (lines.length > 0) out.push(`## ${title}`, "", ...lines, "");
  }
  // The first release lists only typed commits: the history before the commit standards has no types to sort.
  const project = input.changes.filter((change) => change.type === "repo" || change.type === undefined).length;
  if (input.previousTag && project > 0) out.push(`Plus ${project} project ${project === 1 ? "change" : "changes"} (docs, tests, tooling, data refreshes).`, "");
  const testflight = input.testflightUrl ? `[the public TestFlight link](${input.testflightUrl})` : "the public TestFlight link in the README (Install)";
  out.push(
    "## Install",
    "",
    "- Android: download the `.apk` below and open it. Allow your browser or file manager to install unknown apps when it asks. It installs over an earlier release and keeps your campaigns.",
    `- iPhone and iPad: join the beta through ${testflight}, then install from Apple's TestFlight app. This release reaches it once Apple has reviewed the build, and it updates over an earlier one, keeping your campaigns.`,
    "",
  );
  const facts = [`Card data version ${input.catalogVersion}`, `engine version ${input.engineVersion}`];
  if (input.previousTag) facts.push(`[all changes](https://github.com/${input.repository}/compare/${input.previousTag}...${input.tag})`);
  out.push(facts.join(" · "));
  if (input.apk) {
    out.push("", `\`${input.apk.name}\` SHA-256: \`${input.apk.sha256}\``);
    if (input.apk.certificateSha256) out.push(`Signing certificate SHA-256: \`${input.apk.certificateSha256}\``);
  }
  return `${out.join("\n")}\n`;
}
