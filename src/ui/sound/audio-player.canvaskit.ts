// The web's and the desktop's audio players: expo-audio's web build, an HTML audio element a player (audio-player.native.ts, served in place of
// the throwing audio-player.ts on the web platform by metro.config.js). It makes no player until a sound or a loop plays, so the static render
// never touches the browser's audio.
//
// The desktop app may play before any click (desktop/main.ts, autoplayPolicy). A browser refuses audio until the page has had a click or a key,
// and expo-audio then counts the player as stopped, so the menu's loop would never start. Each player asked to play before the first click or key,
// and not paused since, is asked again on it, so the loop starts where it stands. Only the music can wait: every sound effect follows a tap or a
// key, which is that first gesture (its listener runs first, in the capture phase).
import { createAudioPlayer as createPlayer, setAudioModeAsync, type AudioPlayer } from "./audio-player.native";

export { setAudioModeAsync, type AudioPlayer };

let activated = typeof window === "undefined";
const waiting = new Set<AudioPlayer>();

export function createAudioPlayer(source: number): AudioPlayer {
  const player = createPlayer(source);
  if (activated) return player;
  const play = player.play.bind(player);
  const pause = player.pause.bind(player);
  player.play = () => {
    if (!activated) waiting.add(player);
    play();
  };
  player.pause = () => {
    waiting.delete(player);
    pause();
  };
  return player;
}

function startWaiting(): void {
  activated = true;
  for (const player of waiting) {
    try {
      player.play();
    } catch {
      // A player released since it was asked: nothing to start.
    }
  }
  waiting.clear();
}

if (!activated) {
  const gestures = ["pointerdown", "keydown"] as const;
  const once = () => {
    for (const gesture of gestures) window.removeEventListener(gesture, once, true);
    startWaiting();
  };
  for (const gesture of gestures) window.addEventListener(gesture, once, true);
}
