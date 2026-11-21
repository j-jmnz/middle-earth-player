/// <reference types="expo/types/metro-require" />
// The sound files the phone's bundle carries: every `<slot>.m4a` that `pnpm assets sounds` packed into assets/sounds, and every
// `<loop>.m4a` that `pnpm assets music` packed into assets/music (both gitignored; each folder stays, with a .gitkeep, so the context
// always resolves). Metro turns each `require.context` into a map of the files there when it bundles, and a bundle packed without them
// finds none, so the app plays nothing. The web and the tests read bundled.ts.
import { isMusicLoop, type MusicLoop } from "./music-map.ts";
import { isSoundSlot, type SoundSlot } from "./slots.ts";

type Context = { keys(): string[]; (id: string): unknown };

function mapOf<Name extends string>(context: Context, isName: (name: string) => name is Name): Partial<Record<Name, number>> {
  const files: Partial<Record<Name, number>> = {};
  for (const key of context.keys()) {
    const name = key.replace(/^\.\//, "").replace(/\.m4a$/, "");
    if (isName(name)) files[name] = context(key) as number;
  }
  return files;
}

const metro = typeof require !== "undefined" && typeof require.context === "function";

export const bundledSounds: Partial<Record<SoundSlot, number>> = metro ? mapOf(require.context("../../../assets/sounds", false, /\.m4a$/), isSoundSlot) : {};
export const bundledMusic: Partial<Record<MusicLoop, number>> = metro ? mapOf(require.context("../../../assets/music", false, /\.m4a$/), isMusicLoop) : {};
