// Printed timing labels, from a card's plain text. A line that opens with a label is that timing; any
// other line that is not only keywords is a constant ability.
const LABELS: ReadonlyMap<string, string> = new Map([
  ["setup", "setup"],
  ["forced", "forced"],
  ["when revealed", "whenRevealed"],
  ["response", "response"],
  ["action", "action"],
  ["shadow", "shadow"],
  ["travel", "travel"],
  ["quest resolution", "questResolution"],
]);

const LABEL = /^(?:(?:Valour|Planning|Quest|Travel|Encounter|Combat|Refresh|Resource)\s+)?([A-Z][A-Za-z ]+?):\s/;

export function timingLabels(text: string | null, keywordsOnly: (line: string) => boolean): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || keywordsOnly(line)) continue;
    const match = LABEL.exec(line);
    const label = match?.[1] ? LABELS.get(match[1].toLowerCase()) : undefined;
    out.push(label ?? "constant");
  }
  return out;
}

// The timings a record may have when it implements this printed line. A labelled line ("Forced: ...") is that
// timing, and so is any label quoted inside it (a condition attachment's parenthetical). A line with no label
// is a constant ability, or an effect that triggers on a condition, or text that rides on the card's own timing.
const UNLABELLED = ["constant", "triggered", "forced", "whenRevealed", "questResolution", "setup"];

export function lineTimings(line: string): Set<string> {
  const allowed = new Set<string>();
  const lead = LABEL.exec(line.trim());
  const label = lead?.[1] ? LABELS.get(lead[1].toLowerCase()) : undefined;
  if (label) allowed.add(label);
  for (const match of line.matchAll(/(?:^|[("'\s])([A-Z][A-Za-z ]+?):\s/g)) {
    const inner = match[1] ? LABELS.get(match[1].toLowerCase()) : undefined;
    if (inner) allowed.add(inner);
  }
  // A "(Counts as a ... attachment with the text: ...)" line also grants the attachment's own constant text.
  if (/Counts as an? \w+ attachment/.test(line)) allowed.add("constant");
  if (!lead) for (const timing of UNLABELLED) allowed.add(timing);
  return allowed;
}
