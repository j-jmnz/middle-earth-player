// Rules: mec113.campaign-mode, rr.campaign-log (data/rules/entries.json). The words of The Return of the King's own Resolution records (docs/brief.md, The Return of the King): the options of Mount Doom's
// ChooseOption, the notes of the settled view (the counts recorded in the log's notes section, how the saga ended) and the lines that say how the saga ended. Pure.
import type { CampaignEnd, RecordedCount } from "../catalog/campaign-record.ts";
import type { ResolutionLog } from "../rules/core/campaign-state.ts";

/** The sentence over the Campaign Setup's boon choice (146069:A:1): Shagrat guards the boon at stage 3, and it is lost if he is in play when the players win. */
export function setAsideBoonWords(trait: string): string {
  return `Choose ${/^[aeiou]/i.test(trait) ? "an" : "a"} ${trait} boon from the pool to set aside. Shagrat guards it at stage 3, and it is lost if he is in play when the players win.`;
}

/** One count as a phrase: "1 resource on The Corsair Fleet", "6 resource tokens on The Black Gate". */
export function recordedWords(which: RecordedCount, count: number): string {
  const [one, many, place] = which === "corsairFleet" ? ["resource", "resources", "The Corsair Fleet"] : ["resource token", "resource tokens", "The Black Gate"];
  return `${count} ${count === 1 ? one : many} on ${place}`;
}

// What happens to The One Ring, and what that makes of the campaign (146079:B:1).
const RING: Readonly<Record<CampaignEnd, string>> = { won: "The One Ring is destroyed.", lost: "The One Ring is kept." };
const ENDING: Readonly<Record<CampaignEnd, string>> = { won: "The players win the campaign.", lost: "The players lose the campaign." };

/** The sentence that says how the campaign ended: the ring's fate and the players' result ("The One Ring is destroyed. The players win the campaign."). */
export function endedWords(ended: CampaignEnd): string {
  return `${RING[ended]} ${ENDING[ended]}`;
}

/** The campaign's end as the path and the Resolution say it once the saga is over: the win names the ring, the loss only the result. */
export function campaignEndLine(ended: CampaignEnd): string {
  return ended === "won" ? endedWords("won") : ENDING.lost;
}

/** The options of Mount Doom's Resolution (146079:B:1), by `<name>:<id>`: the label on the tile and the sentence above Confirm. */
export const RING_OPTIONS: Readonly<Record<string, { label: string; says: () => string }>> = {
  "ring:keep": { label: "Keep The One Ring and succumb to the power of Sauron", says: () => "The One Ring is kept and the power of Sauron wins: the players lose the campaign." },
  "ring:destroy": { label: "Destroy The One Ring and defeat the power of Sauron", says: () => "The One Ring is destroyed and the power of Sauron is defeated: the players win the campaign." },
};

/** The sentences the settled view adds for the box's records: the counts recorded in the notes section, a hero left out of the fallen heroes, and how the saga ended. */
export function returnOfTheKingNotes(log: ResolutionLog): readonly string[] {
  const notes: string[] = [];
  if (log.recorded?.corsairFleet != null) notes.push(`${recordedWords("corsairFleet", log.recorded.corsairFleet)}, recorded in the notes section of the campaign log.`);
  if (log.recorded?.blackGateTokens != null) notes.push(`${recordedWords("blackGateTokens", log.recorded.blackGateTokens)}, recorded in the notes section of the campaign log.`);
  if (log.discardedNotFallen) notes.push("A hero in its controller's discard pile is not added to the list of fallen heroes.");
  if (log.campaignEnd) notes.push(endedWords(log.campaignEnd));
  return notes;
}
