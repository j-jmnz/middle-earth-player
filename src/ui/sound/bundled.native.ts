/// <reference types="expo/types/metro-require" />
// The sound files the phone's bundle carries: every `<slot>.m4a` that `pnpm assets sounds` packed into assets/sounds (gitignored; the folder
// itself stays, with a .gitkeep, so the context always resolves). Metro turns `require.context` into a map of the files there when it
// bundles, and a bundle packed without the sounds finds none, so the app plays nothing. The web and the tests read bundled.ts.
import { isSoundSlot, type SoundSlot } from "./slots.ts";

function packed(): Partial<Record<SoundSlot, number>> {
  const sounds: Partial<Record<SoundSlot, number>> = {};
  if (typeof require === "undefined" || typeof require.context !== "function") return sounds;
  const context = require.context("../../../assets/sounds", false, /\.m4a$/);
  for (const key of context.keys()) {
    const slot = key.replace(/^\.\//, "").replace(/\.m4a$/, "");
    if (isSoundSlot(slot)) sounds[slot] = context(key) as number;
  }
  return sounds;
}

export const bundledSounds: Partial<Record<SoundSlot, number>> = packed();
