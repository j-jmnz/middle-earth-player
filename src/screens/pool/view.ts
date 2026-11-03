import { sessionSetting } from "../data/session-setting.ts";

// The card pool's view: a grid of the card pictures, or one row per card. Kept while the app is open. Browsing (the Cards tab) opens
// on the grid; adding to a deck opens on the named rows, since a name is what a builder scans for, with the grid one tap away.
export type PoolView = "Grid" | "List";

export const browseView = sessionSetting<PoolView>("Grid");
export const addingView = sessionSetting<PoolView>("List");
