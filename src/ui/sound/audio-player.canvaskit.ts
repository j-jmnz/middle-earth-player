// The web's and the desktop's audio players: expo-audio's web build, an HTML audio element a player (audio-player.native.ts, served in place of
// the throwing audio-player.ts on the web platform by metro.config.js), with what a page needs on top (src/ui/web/web-audio.ts): a browser's
// loop asked again once a gesture lets it play, and the music paused while the window is not in front. It makes no player until a sound or a
// loop plays, so the static render never touches the browser's audio.
import { createAudioPlayer as createPlayer, setAudioModeAsync, type AudioPlayer } from "./audio-player.native";
import { Asset } from "expo-asset";

import { browserBuffers, bufferAudio, type BufferPlayer } from "../web/buffer-audio.ts";
import { bundledSounds } from "./bundled";
import { browserPage, webAudio, type Media, type Player } from "../web/web-audio.ts";

export { setAudioModeAsync, type AudioPlayer };

const page = typeof window === "undefined" ? null : browserPage(window);

// `media` is private in expo-audio's types; it is the element the player plays.
const wrap = webAudio(page, process.env.EXPO_PUBLIC_DESKTOP !== "1", (player) => (player as unknown as { media: Media }).media);

// The web app's build (EXPO_PUBLIC_WEBAPP=1) makes no audio element: its sound effects and its music play from decoded buffers of one AudioContext
// (src/ui/web/buffer-audio.ts), since an element holds the page's thread on Safari's engine. The page's wrapper is the same.
const buffers = page && process.env.EXPO_PUBLIC_WEBAPP === "1" ? bufferAudio(browserBuffers(window)) : null;
const wrapBuffered = webAudio(page, true, (player) => (player as unknown as BufferPlayer).media);
const effects = new Set<unknown>(Object.values(bundledSounds));

// A bundled file as the web gives it: its URL, an object that holds it, or an asset number.
function uriOf(source: unknown): string {
  if (typeof source === "string") return source;
  if (typeof source === "number") return Asset.fromModule(source).uri;
  return (source as { uri: string }).uri;
}

export function createAudioPlayer(source: number): AudioPlayer {
  if (buffers) return wrapBuffered(buffers.create(uriOf(source), effects.has(source) ? "effect" : "music") as unknown as Player) as unknown as AudioPlayer;
  return wrap(createPlayer(source) as unknown as Player) as unknown as AudioPlayer;
}
