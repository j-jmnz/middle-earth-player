// What the Android hardware Back does on the table, one layer at a time: it closes the log sheet first, then the list of a
// card's attachments, then folds an open choice sheet, and only then leaves the table. A folded sheet stays a choice the
// engine is waiting for; leaving loses nothing because every accepted intent is already saved.
export type BackLayers = { logOpen: boolean; inspectOpen: boolean; sheetOpen: boolean };

export type BackStep = "closeLog" | "closeInspect" | "foldSheet" | "leave";

export function backStep(layers: BackLayers): BackStep {
  if (layers.logOpen) return "closeLog";
  if (layers.inspectOpen) return "closeInspect";
  if (layers.sheetOpen) return "foldSheet";
  return "leave";
}
