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
  // Campaign cards only: the line on the back of the card.
  ["resolution", "resolution"],
]);

// Up to two words before the label: "Valour Planning Action:" (10117:A:2).
const LABEL = /^(?:(?:Valour|Planning|Quest|Travel|Encounter|Combat|Refresh|Resource)\s+){0,2}([A-Z][A-Za-z ]+?):\s/;

export function timingLabels(text: string | null, keywordsOnly: (line: string) => boolean, campaign = false): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || keywordsOnly(line)) continue;
    const match = LABEL.exec(line);
    const label = match?.[1] ? LABELS.get(match[1].toLowerCase()) : undefined;
    out.push(campaign && label === "setup" ? "campaignSetup" : (label ?? "constant"));
  }
  return out;
}

// The timings a record may have when it implements this printed line. A labelled line ("Forced: ...") is that
// timing, and so is any label quoted inside it (a condition attachment's parenthetical). A line with no label
// is a constant ability, or an effect that triggers on a condition, or text that rides on the card's own timing.
const UNLABELLED = ["constant", "triggered", "forced", "whenRevealed", "questResolution", "setup", "resolution"];

export function lineTimings(line: string): Set<string> {
  const allowed = new Set<string>();
  const lead = LABEL.exec(line.trim());
  const label = lead?.[1] ? LABELS.get(lead[1].toLowerCase()) : undefined;
  if (label) allowed.add(label);
  if (label === "setup") allowed.add("campaignSetup");
  // A label quoted inside the line may carry the same lead words ("it gains: "Quest Action: ...", 143046:A:1).
  for (const match of line.matchAll(/(?:^|[("'\s\u201c])(?:(?:Valour|Planning|Quest|Travel|Encounter|Combat|Refresh|Resource)\s+){0,2}([A-Z][A-Za-z ]+?):\s/g)) {
    const inner = match[1] ? LABELS.get(match[1].toLowerCase()) : undefined;
    if (inner) allowed.add(inner);
  }
  // "Forced: While Durin's Bane has no damage, Servant of Flame gets +2 Attack" (901807:A:1) is a constant effect that happens to carry the Forced label: it has no event to answer.
  if (/^Forced:\s+While\b/i.test(line.trim())) allowed.add("constant");
  // A "(Counts as a ... attachment with the text: ...)" line also grants the attachment's own constant text, and so does an enemy that attaches itself "as a Tentacle attachment with the text: ..." (04073:A:1).
  if (/\bas an? (?:\w+ )?attachment/i.test(line)) allowed.add("constant");
  // "While in a player's hand, Lost in the Wild gains: "Cannot be discarded by player card effects. ..."" gives the card a constant ability of its own from the hand (18026:A:1).
  if (/While in a player's hand, .+ gains: "/.test(line)) allowed.add("constant");
  // An attachment's quoted text with no label of its own may trigger on a condition, as any unlabelled line may ("Counts as a Condition
  // attachment with the text, "Each time attached hero readies, deal it 1 damage."", 900106:A:1).
  const quoted = /\bas an? (?:\w+ )?attachment with the text[,:]? "([^"]*)"/i.exec(line)?.[1];
  if (quoted != null && !LABEL.test(quoted.trim())) allowed.add("triggered");
  // An attachment whose quoted text is a Lost line ("with the text: "Lost: Discard attached hero."", 901608:A:2) hears the Lost trigger: a triggered effect.
  if (/\bwith the text[,:]? "Lost: /i.test(line)) allowed.add("triggered");
  // An unlabelled line that calls itself an action is one ("Any player may trigger this action", Ceorl 12058:A:1).
  if (/trigger this action/i.test(line)) allowed.add("action");
  // A Travel line that bars the trip until something is done ("Travel: Players must complete stage one of this quest before they can travel to Rhosgobel", 02065:A:3) is also a constant: the engine checks it while the card is in play.
  if (label === "travel" && /\bbefore they can travel\b/.test(line)) allowed.add("constant");
  // An objective ally that "The first player gains control of" it is put into play by the campaign pool at the start of a scenario (Mendor, 01135:A:2).
  if (/^The first player gains control of /.test(line.trim())) allowed.add("campaignSetup");
  // A lead-in that is not a timing label ("All Troll enemies gain the text: ...", 900201:A:2) leaves the line unlabelled.
  if (!label) for (const timing of UNLABELLED) allowed.add(timing);
  return allowed;
}
