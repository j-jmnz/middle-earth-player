// The web's and the desktop's audio players: expo-audio's web build, an HTML audio element a player (audio-player.native.ts, served in place of
// the throwing audio-player.ts on the web platform by metro.config.js), with what a page needs on top (src/ui/web/web-audio.ts): a browser's
// loop asked again once a gesture lets it play, and the music paused while the window is not in front. It makes no player until a sound or a
// loop plays, so the static render never touches the browser's audio.
import { createAudioPlayer as createPlayer, setAudioModeAsync, type AudioPlayer } from "./audio-player.native";
import { browserPage, webAudio, type Media, type Player } from "../web/web-audio.ts";

export { setAudioModeAsync, type AudioPlayer };

const page = typeof window === "undefined" ? null : browserPage(window);

// `media` is private in expo-audio's types; it is the element the player plays.
const wrap = webAudio(page, process.env.EXPO_PUBLIC_DESKTOP !== "1", (player) => (player as unknown as { media: Media }).media);

export function createAudioPlayer(source: number): AudioPlayer {
  return wrap(createPlayer(source) as unknown as Player) as unknown as AudioPlayer;
}
