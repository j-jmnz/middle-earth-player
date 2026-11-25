// The attribution lines that no commit message and no pull request description carries (.claude/rules/commit-standards.md, Body): a `Claude-Session:` trailer or a link to a claude.ai Claude Code
// page, a `Co-Authored-By` line that names Claude or Anthropic, and the "Generated with|by Claude Code" footer, in any letter case. Each is matched in the form a tool writes it (a trailer
// or footer at the start of a line, after optional emoji, `_`, `*` and spaces), so prose that names one mid-sentence, or inside backticks, passes. This is the one list of patterns:
// scripts/git/commit-message.ts reads it for a commit message, and the CI job that checks a pull request's title passes the description to `pnpm commit:check --description`
// (.github/workflows/test.yml, commits).

export type AttributionKind = "session" | "co-author" | "footer";

const ATTRIBUTION: readonly { kind: AttributionKind; pattern: RegExp }[] = [
  { kind: "session", pattern: /^claude-session:|https?:\/\/claude\.ai\/code|claude\.ai\/code\/session/i },
  { kind: "co-author", pattern: /^co-authored-by:.*(claude|anthropic)/i },
  { kind: "footer", pattern: /^(?:[\s_*️]|\p{Extended_Pictographic})*generated (?:with|by)\b.*claude code/iu },
];

/** The first line of `text` that holds an attribution, trimmed, with the kind of pattern that matched, or undefined. */
export function attributionMatch(text: string): { kind: AttributionKind; line: string } | undefined {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const found = ATTRIBUTION.find(({ pattern }) => pattern.test(line));
    if (found) return { kind: found.kind, line };
  }
  return undefined;
}

/** The first line of `text` that holds an attribution, trimmed, or undefined. */
export function attributionLine(text: string): string | undefined {
  return attributionMatch(text)?.line;
}
