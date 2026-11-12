// Rules: mec112.setup-shelobs-lair, rr.play-and-put-into-play, rr.active-location (data/rules/entries.json); ledger lines 144040:A:2, 144071:B:2, 144071:B:3, 144072:B:2. The words of Shelob's Lair's table dials (src/play/readouts/lair.ts).
import { plural } from "../list.ts";

/**
 * What Shelob's dial reads (144040:A:2, 144072:B:2): her resources, the Threat each gives her (not once she is engaged: her Threat no longer counts there), on stage 3B the damage each cancels, and what her Forced
 * effect asks at the beginning of each quest phase.
 */
export function shelobWords(resources: number, shielded: boolean, engaged: boolean): string {
  const held = `Shelob has ${plural(resources, "resource", "resources")}`;
  const threat = engaged ? `${held}; engaged, her Threat does not count` : `${held}: +${resources} Threat`;
  const forced = "Each beginning of the quest phase the first player places 1 more or has her attack";
  if (!shielded) return `${threat}. ${forced}`;
  return `${threat}. ${resources > 0 ? "The next damage dealt to her is canceled, whatever its size, and 1 resource is discarded" : "With no resource left she takes damage as usual"}. ${forced}`;
}

/** What Gollum's dial reads on stage 3B (144072:B:1, B:3): defeat sends him to the victory display, and the stage needs Shelob and him both there. */
export const GOLLUM_LAIR_WORDS = "defeat him and he goes to the victory display, not back to Sméagol; the stage cannot be defeated until Shelob and Gollum are both there";

/** What the quest-progress dial reads (144071:B:3): what is left of this round's cap, the active location's share coming first. */
export function capWords(placed: number, limit: number): string {
  const left = Math.max(0, limit - placed);
  return `${left > 0 ? `${left} more can be placed; the` : "The"} active location takes its progress first`;
}

/** The dial's warning once the cap is reached, so a full ring is not read as a goal met. */
export const CAP_REACHED_WORDS = "the stage's limit for this round is reached, no more progress can be placed on it";

/** The label a seat's dial wears for its allies this round (144071:B:2): "P1 \u00b7 1 ally", solo "1 ally". */
export function alliesLabel(count: number, seat: number | null): string {
  const what = plural(count, "ally", "allies");
  return seat == null ? what : `P${seat + 1} \u00b7 ${what}`;
}

/** A seat dial's warning at the limit, heard after its label: that player cannot play or put into play another ally this round. */
export const ALLIES_AT_LIMIT_WORDS = "this player cannot play or put into play another ally this round";

/** What the quest readout says of the progress a quest would place while Shelob's Lair holds some back (144071:B:3, 144070:B:1): the active location's share, the stage's and what is lost. */
export function progressSplitWords(progress: number, location: number, stage: number): string {
  const lost = progress - location - stage;
  if (location + stage === 0) return "No progress can be placed on the stage this round";
  const parts = [location > 0 ? `the active location takes ${location}` : null, stage > 0 ? (location > 0 ? `the stage ${stage} more this round` : `the stage takes ${stage} this round`) : null].filter((part) => part != null);
  return `${progress} progress: ${parts.join(", ")}${lost > 0 ? ` (${lost} lost)` : ""}`;
}

/** Stage 1 (144070:B:1): an Underground active location takes no progress, quest progress included. */
export const UNDERGROUND_NO_PROGRESS_WORDS = "No progress can be placed: Underground locations take none";
