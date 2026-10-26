// What the Android hardware Back does on the table, one layer at a time: it closes the table menu, then the card preview,
// then a reading panel (the threat panel, the
// turn reference, the table settings), then the log, then a discard pile's list, then
// puts back a sheet the player opened from the table (a payment, a host, an Action; nothing was sent), then folds a choice
// panel, and only then leaves the table. A folded panel stays a choice the engine is waiting for; leaving loses nothing
// because every accepted intent is already saved.
export type BackLayers = { menuOpen?: boolean; previewOpen?: boolean; infoOpen?: boolean; logOpen: boolean; pileOpen: boolean; overlayOpen: boolean; panelOpen: boolean };

export type BackStep = "closeMenu" | "closePreview" | "closeInfo" | "closeLog" | "closePile" | "closeOverlay" | "foldPanel" | "leave";

export function backStep(layers: BackLayers): BackStep {
  if (layers.menuOpen) return "closeMenu";
  if (layers.previewOpen) return "closePreview";
  if (layers.infoOpen) return "closeInfo";
  if (layers.logOpen) return "closeLog";
  if (layers.pileOpen) return "closePile";
  if (layers.overlayOpen) return "closeOverlay";
  if (layers.panelOpen) return "foldPanel";
  return "leave";
}
