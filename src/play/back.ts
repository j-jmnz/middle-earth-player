// What the Android hardware Back does on the table, one layer at a time, topmost first:
//   0. a combat spotlight that is playing: Back skips it (nothing under it is touched);
//   0b. a hand scrub that is open (a finger is down on the hand): Back cancels it, the hand settles back and nothing opens;
//   1. the table menu, the dock's More popover or its "i" popover (they share a frame; only one is ever open);
//   2. the card preview;
//   3. the reading layer (the threat panel, the phase carousel, the table settings, a discard pile's list, the log; reading.ts);
//   4. a sheet the player opened from the table (a payment, a host, an Action; nothing was sent);
//   5. the choice tray, which it folds;
//   and only then it leaves the table. A folded tray stays a choice the engine is waiting for; leaving loses nothing because
// every accepted intent is already saved.
export { cancelScrub, scrubOpen } from "./scrub-open.ts";

export type BackLayers = { spotlightOpen: boolean; scrubOpen: boolean; menuOpen: boolean; moreOpen: boolean; linesOpen: boolean; previewOpen: boolean; readingOpen: boolean; overlayOpen: boolean; panelOpen: boolean };

export type BackStep = "skipSpotlight" | "cancelScrub" | "closeMenu" | "closeMore" | "closeLines" | "closePreview" | "closeReading" | "closeOverlay" | "foldPanel" | "leave";

export function backStep(layers: BackLayers): BackStep {
  if (layers.spotlightOpen) return "skipSpotlight";
  if (layers.scrubOpen) return "cancelScrub";
  if (layers.menuOpen) return "closeMenu";
  if (layers.moreOpen) return "closeMore";
  if (layers.linesOpen) return "closeLines";
  if (layers.previewOpen) return "closePreview";
  if (layers.readingOpen) return "closeReading";
  if (layers.overlayOpen) return "closeOverlay";
  if (layers.panelOpen) return "foldPanel";
  return "leave";
}
