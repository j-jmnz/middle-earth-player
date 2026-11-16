// The window's remembered place, in a small JSON file in the profile folder (bounds.ts decides what of it is kept).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { restoreWindowState, type Rect, type WindowState } from "./bounds.ts";

const FILE = "window-state.json";

/** The state to open the window with: the saved one checked against the displays now, or the default when there is none or it cannot be read. */
export function loadWindowState(userData: string, workAreas: readonly Rect[]): WindowState {
  let saved: unknown = null;
  try {
    saved = JSON.parse(readFileSync(path.join(userData, FILE), "utf8"));
  } catch {
    // No file yet, or one cut short: the default.
  }
  return restoreWindowState(saved, workAreas);
}

/** Writes the state; a profile folder that cannot be written costs the player only the remembered place. */
export function saveWindowState(userData: string, state: WindowState): void {
  try {
    writeFileSync(path.join(userData, FILE), JSON.stringify(state));
  } catch {
    // Not worth stopping the app for.
  }
}
