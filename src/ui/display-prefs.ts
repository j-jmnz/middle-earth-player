// What the table draws from the player's display settings and the phone's (docs/design-system.md, Settings). Pure, so a test reads it; the hooks
// read the one accessibility store and the settings store.
import { useMemo, useSyncExternalStore } from "react";

import { accessibility, subscribeAccessibility } from "./accessibility.ts";
import { strongOutlines, tableSettings } from "./table-settings.ts";

/** For useSyncExternalStore: the table settings store's subscribe, shared by every hook that reads one setting (text.tsx, screen-reader.ts). */
export const subscribeSettings = (onChange: () => void) => tableSettings.subscribe(onChange);
const strongOn = () => strongOutlines(tableSettings.getState().settings.highContrast, accessibility().increaseContrast);
const plainTitlesOn = () => tableSettings.getState().settings.titleFace === "plain";
const reduceTransparencyOn = () => accessibility().reduceTransparency;
/** The server snapshot of a boolean hook. */
export const off = () => false;

// The setting and the phone both move the answer, so it subscribes to both and returns one boolean.
function subscribeBoth(onChange: () => void): () => void {
  const stopSettings = subscribeSettings(onChange);
  const stopPhone = subscribeAccessibility(onChange);
  return () => {
    stopSettings();
    stopPhone();
  };
}

/** Strong outlines in effect now (Follow system reads the phone). */
export function useStrongOutlines(): boolean {
  return useSyncExternalStore(subscribeBoth, strongOn, off);
}

/** The phone's Reduce Transparency: what is drawn translucent is drawn opaque. */
export function useReduceTransparency(): boolean {
  return useSyncExternalStore(subscribeAccessibility, reduceTransparencyOn, off);
}

/** The Title face setting is Plain: titles and the canvas's numbers are Barlow semibold, not Marcellus SC. */
export function usePlainTitles(): boolean {
  return useSyncExternalStore(subscribeSettings, plainTitlesOn, off);
}

/** The table's look (Strong outlines in effect, the phone's Increase Contrast under Follow system), one object until it changes. */
export function useLook(): { contrast: boolean } {
  const contrast = useStrongOutlines();
  return useMemo(() => ({ contrast }), [contrast]);
}
