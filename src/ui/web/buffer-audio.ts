// The web app's audio (src/ui/sound/audio-player.canvaskit.ts; docs/design-system-table.md, Sound): every sound effect and every piece of music is fetched and
// decoded into a buffer of one AudioContext, and each play is a new source node on it. No audio element is made. On Safari's engine, which every browser on an
// iPhone and an iPad uses, an element costs the page its thread: its play, pause and seek are answered by the system's media player while the page waits (over a
// tenth of a second at each tap for a sound effect), and while an element loads a piece of music the browser holds the thread for most of a minute with no
// script running. A buffer's play is not waited for. A piece of music is decoded at MUSIC_RATE, not the context's rate, and dropped when its last player goes,
// since decoded audio is large (a quarter of a megabyte a second at that rate).
// No browser here: `BufferHost` is the page (browserBuffers), so a test runs the rest.
import { describeTo, span } from "./meter-span.ts";

/** A decoded sound. */
export type Decoded = { readonly duration: number };
/** A sound that is playing: `stop` ends it. */
export type Playing = { stop(): void };
/** A sound effect is short, kept for good, and lost when it cannot sound at once; a piece of music is long, dropped with its last player, and starts when it can. */
export type Kind = "effect" | "music";

/** The sample rate a piece of music is decoded at: 16 kHz of sound, at two thirds of the memory of an iPad's 48 kHz. */
export const MUSIC_RATE = 32_000;

export type BufferHost = {
  /** The sound at `uri`, fetched and decoded at `rate` samples a second (the context's own when null); rejects when it cannot be. */
  decode(uri: string, rate: number | null): Promise<Decoded>;
  /** A volume control of its own for one player. */
  newGain(): { gain: { value: number } };
  /** Plays `sound` through `gain` from `offset` seconds in; `ended` runs when it reaches its end. */
  start(sound: Decoded, gain: { gain: { value: number } }, offset: number, ended: () => void): Playing;
  /** The context's clock, in seconds. */
  now(): number;
  /** Whether the context sounds: before the page's first gesture it does not. */
  running(): boolean;
  /** Starts the context, or starts it again after the system stopped it; only a gesture's call counts. */
  resume(): void;
  /** Calls `listener` each time the context begins to sound. */
  onRunning(listener: () => void): void;
};

/** What the sound and music code calls on a player (the part of expo-audio's AudioPlayer it uses), and the element-like `media` the page's wrapper reads (web-audio.ts). */
export type BufferPlayer = {
  readonly playing: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly isLoaded: boolean;
  volume: number;
  readonly media: { readonly paused: boolean; play(): Promise<void>; pause(): void };
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  remove(): void;
};

type Entry = { sound: Promise<Decoded | null>; users: number };

export function bufferAudio(host: BufferHost): { create(uri: string, kind: Kind): BufferPlayer } {
  // One decode for each file, shared by every player of it.
  const sounds = new Map<string, Entry>();
  const entryOf = (uri: string, kind: Kind): Entry => {
    let entry = sounds.get(uri);
    if (!entry) {
      entry = { sound: host.decode(uri, kind === "music" ? MUSIC_RATE : null).catch(() => null), users: 0 };
      sounds.set(uri, entry);
    }
    return entry;
  };
  // The pieces of music that wait for the context to sound, and every piece's state for the test meter.
  const waiting = new Set<() => void>();
  const pieces = new Set<() => string>();
  host.onRunning(() => {
    for (const begin of [...waiting]) begin();
  });
  describeTo("music", () => [host.running() ? "sounding" : "silent", ...[...pieces].map((say) => say())].join(" | "));

  return {
    create(uri, kind) {
      const gain = host.newGain();
      const entry = entryOf(uri, kind);
      entry.users += 1;
      let sound: Decoded | null = null;
      let playing: Playing | null = null;
      // Where the sound stands when it is not playing, and the clock's time its start would have had when it is.
      let offset = 0;
      let startedAt = 0;
      // A play asked for before the sound can start (its decode is not done, or music before the page's first gesture) starts when it can.
      let wanted = false;
      let removed = false;

      const start = (): void => {
        if (!sound || removed || !host.running()) return;
        const started = performance.now();
        playing?.stop();
        if (offset >= sound.duration) offset = 0;
        startedAt = host.now() - offset;
        const mine = host.start(sound, gain, offset, () => {
          if (playing !== mine) return;
          playing = null;
          wanted = false;
          offset = sound?.duration ?? 0;
        });
        playing = mine;
        span("audio", performance.now() - started);
      };
      const stop = (): void => {
        if (!playing) return;
        offset = Math.min(host.now() - startedAt, sound?.duration ?? 0);
        const was = playing;
        playing = null;
        was.stop();
      };
      const begin = (): void => {
        if (wanted && !playing) start();
      };
      const say = (): string => `${sound ? Math.round(sound.duration) : "?"}s t${player.currentTime.toFixed(1)}${playing ? "*" : ""}`;
      if (kind === "music") {
        waiting.add(begin);
        pieces.add(say);
      }

      void entry.sound.then((ready) => {
        sound = ready;
        begin();
      });

      const player: BufferPlayer = {
        get playing() {
          return playing !== null;
        },
        get currentTime() {
          return playing ? Math.min(host.now() - startedAt, sound?.duration ?? 0) : offset;
        },
        get duration() {
          return sound?.duration ?? 0;
        },
        get isLoaded() {
          return sound !== null;
        },
        get volume() {
          return gain.gain.value;
        },
        set volume(value: number) {
          gain.gain.value = Math.min(1, Math.max(0, value));
        },
        media: {
          get paused() {
            return playing === null;
          },
          play() {
            player.play();
            return Promise.resolve();
          },
          pause() {
            player.pause();
          },
        },
        play() {
          host.resume();
          // A sound effect asked for while the context does not sound would be held and played at the first tap: its moment has gone.
          if (kind === "effect" && !host.running()) return;
          wanted = true;
          start();
        },
        pause() {
          wanted = false;
          stop();
        },
        seekTo(seconds) {
          const again = playing !== null;
          stop();
          offset = Math.max(0, seconds);
          if (again) start();
          return Promise.resolve();
        },
        remove() {
          if (removed) return;
          wanted = false;
          stop();
          removed = true;
          waiting.delete(begin);
          pieces.delete(say);
          entry.users -= 1;
          // A piece no player holds is dropped, so its memory goes back; a sound effect is a few kilobytes and stays.
          if (kind === "music" && entry.users === 0 && sounds.get(uri) === entry) sounds.delete(uri);
        },
      };
      return player;
    },
  };
}

// The gestures that can give a user activation (the HTML standard's activation-triggering events).
const GESTURES = ["pointerup", "touchend", "click", "keydown"] as const;

/** The page as a BufferHost: one AudioContext, made when first asked for, started by the window's gestures and again when the page comes back to the front. */
export function browserBuffers(win: Window & typeof globalThis): BufferHost {
  let made: AudioContext | null = null;
  const listeners: (() => void)[] = [];
  const context = (): AudioContext => {
    if (!made) {
      made = new win.AudioContext();
      made.addEventListener("statechange", () => {
        if (made?.state === "running") for (const listener of listeners) listener();
      });
    }
    return made;
  };
  const resume = (): void => {
    if (context().state !== "running") void context().resume().catch(() => undefined);
  };
  // A gesture is what lets the context start, and what starts it again after the system stopped it.
  for (const gesture of GESTURES) win.addEventListener(gesture, resume, true);
  win.document.addEventListener("visibilitychange", () => {
    if (win.document.visibilityState === "visible" && made) resume();
  });
  return {
    async decode(uri, rate) {
      const response = await win.fetch(uri);
      if (!response.ok) throw new Error(`${uri}: ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (rate !== null && rate < context().sampleRate && typeof win.OfflineAudioContext === "function") {
        // A context of another rate decodes to that rate; it renders nothing.
        return new win.OfflineAudioContext(2, 1, rate).decodeAudioData(bytes);
      }
      return context().decodeAudioData(bytes);
    },
    newGain() {
      const gain = context().createGain();
      gain.connect(context().destination);
      return gain;
    },
    start(sound, gain, offset, ended) {
      const source = context().createBufferSource();
      source.buffer = sound as AudioBuffer;
      source.connect(gain as GainNode);
      source.onended = ended;
      source.start(0, offset);
      return {
        stop() {
          source.onended = null;
          try {
            source.stop();
          } catch {
            // Already ended.
          }
          source.disconnect();
        },
      };
    },
    now: () => context().currentTime,
    running: () => made !== null && made.state === "running",
    resume,
    onRunning(listener) {
      listeners.push(listener);
    },
  };
}
