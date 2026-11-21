// What the web's and the desktop's audio players add to expo-audio's (src/ui/sound/audio-player.canvaskit.ts; docs/design-system-table.md, Sound).
//
// A browser refuses audio until the page has had a gesture that gives it a user activation, and expo-audio then counts the player as stopped,
// so the menu's loop would never start. In a browser each loop asked to play before that, and not paused since, is asked again once a gesture
// has given the activation: after the gesture's own handlers have run, so a click that turns Music off pauses the loop first and it stays
// quiet. A pointer down or Escape gives none, so the page listens on until one has. A short sound asked for then is not asked again: its
// moment is gone. The desktop app may play before any gesture (desktop/main.ts, autoplayPolicy) and waits for none.
//
// The music pauses while the window is not in front, as the phone's pauses in the background: on blur every player that is sounding is
// paused at its element, behind expo-audio, which still counts it as playing, and on focus each goes on where it stood, unless the app
// paused it meanwhile.

/** The element a player plays through: expo-audio's web player keeps it as `media`. */
export type Media = { paused: boolean; play: () => Promise<void>; pause: () => void };
export type Player = { play: () => void; pause: () => void; remove: () => void; duration: number };

/** The page: its events, whether it has had an activation, and a way to run something after the current event has gone through the app. */
export type Page = {
  listen: (type: string, handler: () => void) => void;
  unlisten: (type: string, handler: () => void) => void;
  activated: () => boolean;
  later: (run: () => void) => void;
};

// The gestures that can give a user activation (the HTML standard's activation-triggering events).
const GESTURES = ["pointerup", "touchend", "click", "keydown", "keyup"] as const;

// A loop is longer than any sound effect (the longest is kept to 4.5 s: scripts/build/sound-picks.ts); one whose length is not loaded yet
// (0) is a music file still loading, since a sound's few kilobytes load first.
const LOOP_SECONDS = 10;
const isLoop = (player: Player) => player.duration === 0 || player.duration > LOOP_SECONDS;

/**
 * Makes `wrap`, which the module runs on each new player. `page` is null for the static render; `wait` is false on the desktop. `mediaOf`
 * gives a player's element.
 */
export function webAudio(page: Page | null, wait: boolean, mediaOf: (player: Player) => Media): (player: Player) => Player {
  if (!page) return (player) => player;
  const live = new Set<Player>();
  const refused = new Set<Player>();
  const blurred = new Set<Media>();
  let waiting = wait;

  const retry = () => {
    if (!waiting || !page.activated()) return;
    waiting = false;
    for (const gesture of GESTURES) page.unlisten(gesture, onGesture);
    for (const player of refused) if (isLoop(player)) player.play();
    refused.clear();
  };
  const onGesture = () => page.later(retry);
  if (waiting) for (const gesture of GESTURES) page.listen(gesture, onGesture);

  page.listen("blur", () => {
    for (const player of live) {
      const media = mediaOf(player);
      if (media.paused) continue;
      media.pause();
      blurred.add(media);
    }
  });
  page.listen("focus", () => {
    for (const media of blurred) void media.play().catch(() => undefined);
    blurred.clear();
  });

  return (player) => {
    const { play, pause, remove } = player;
    live.add(player);
    player.play = () => {
      if (waiting) refused.add(player);
      play.call(player);
    };
    // A pause, and a removal (music.ts pauses a player before it removes it), take the player out of what the page starts again.
    player.pause = () => {
      refused.delete(player);
      blurred.delete(mediaOf(player));
      pause.call(player);
    };
    player.remove = () => {
      live.delete(player);
      refused.delete(player);
      blurred.delete(mediaOf(player));
      remove.call(player);
    };
    return player;
  };
}
