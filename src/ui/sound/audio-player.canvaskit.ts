// The web's and the desktop's audio players: expo-audio's web build, an HTML audio element a player (audio-player.native.ts, served in place of
// the throwing audio-player.ts on the web platform by metro.config.js), with what a page needs on top (src/ui/web/web-audio.ts): a browser's
// loop asked again once a gesture lets it play, and the music paused while the window is not in front. It makes no player until a sound or a
// loop plays, so the static render never touches the browser's audio.
import { createAudioPlayer as createPlayer, setAudioModeAsync, type AudioPlayer } from "./audio-player.native";
import { Asset } from "expo-asset";

import { browserBuffers, bufferAudio } from "../web/buffer-audio.ts";
import { browserHost, pooledAudio, type PooledPlayer } from "../web/pooled-audio.ts";
import { bundledSounds } from "./bundled";
import { browserPage, webAudio, type Media, type Player } from "../web/web-audio.ts";

export { setAudioModeAsync, type AudioPlayer };

const page = typeof window === "undefined" ? null : browserPage(window);

// `media` is private in expo-audio's types; it is the element the player plays.
const wrap = webAudio(page, process.env.EXPO_PUBLIC_DESKTOP !== "1", (player) => (player as unknown as { media: Media }).media);

// The web app's build (EXPO_PUBLIC_WEBAPP=1) plays through elements it keeps and blesses in each gesture (src/ui/web/pooled-audio.ts), since Safari refuses
// an element that has had none; the page's wrapper is the same.
const host = page && process.env.EXPO_PUBLIC_WEBAPP === "1" ? browserHost(window) : null;
const pool = host ? pooledAudio(host) : null;
// A sound effect plays from a decoded buffer, not an element: an element's play holds an iPad's page at each tap (src/ui/web/buffer-audio.ts).
const buffers = host ? bufferAudio(browserBuffers(host.context)) : null;
const effects = new Set<unknown>(Object.values(bundledSounds));
const wrapPooled = webAudio(page, true, (player) => (player as unknown as PooledPlayer).media);

// A bundled file as the web gives it: its URL, an object that holds it, or an asset number.
function uriOf(source: unknown): string {
  if (typeof source === "string") return source;
  if (typeof source === "number") return Asset.fromModule(source).uri;
  return (source as { uri: string }).uri;
}

export function createAudioPlayer(source: number): AudioPlayer {
  if (buffers && effects.has(source)) return wrapPooled(buffers.create(uriOf(source)) as unknown as Player) as unknown as AudioPlayer;
  if (pool) return wrapPooled(pool.create(uriOf(source)) as unknown as Player) as unknown as AudioPlayer;
  return wrap(createPlayer(source) as unknown as Player) as unknown as AudioPlayer;
}
