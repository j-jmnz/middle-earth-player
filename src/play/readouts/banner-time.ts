// How long the outcome banner takes (docs/design-system-table.md, Banner): the beat between its lines and how long it stays once
// the last line shows, at the Animation speed (Slow lengthens both by 1.5, Quick and Normal leave them) and the Banner closes
// setting (When tapped has no hold: only a tap, a swipe, the reader's Dismiss or a new moment closes it). Pure, so a test reads it.
import { paceScale, type Speed } from "../../ui/motion-tokens.ts";
import type { BannerClosesOption } from "../../ui/table-settings.ts";
import { BEAT_MS } from "../store/outcome.ts";

// How long the banner stays up once every line is shown; the log keeps it.
export const HOLD_MS = 4500;

/** The beat between two lines of the banner, in ms. */
export function bannerBeatMs(speed: Speed): number {
  return Math.round(BEAT_MS * paceScale(speed));
}

/** How long a moment with `lines` lines stays up before it closes by itself (every line before the last takes a beat), or null when the player closes it. */
export function momentHoldMs(speed: Speed, closes: BannerClosesOption, lines: number): number | null {
  if (closes === "tap") return null;
  return Math.round((HOLD_MS + lines * BEAT_MS) * paceScale(speed));
}

/** How long the round summary stays up, or null when the player closes it. */
export function summaryHoldMs(speed: Speed, closes: BannerClosesOption): number | null {
  return closes === "tap" ? null : Math.round(HOLD_MS * paceScale(speed));
}
