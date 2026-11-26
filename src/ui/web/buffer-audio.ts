// The web app's sound effects (src/ui/sound/audio-player.canvaskit.ts; docs/design-system-table.md, Sound). A sound effect played through an audio element costs
// an iPad's page over a tenth of a second at each tap: the element's play, pause and seek are answered by the system's media player while the page waits, and the
// sound is late or lost. So a short sound is fetched and decoded once into a buffer of an AudioContext, and each play is a new source node on it, which the page
// does not wait for. The music stays on elements (pooled-audio.ts): a piece is minutes long, and decoded it would be tens of megabytes.
// No browser here: `BufferHost` is the page (browserBuffers), so a test runs the rest.
import { span } from "./meter-span.ts";

/** A decoded sound. */
export type Decoded = { readonly duration: number };
/** A sound that is playing: `stop` ends it, and `ended` is called when it ends by itself. */
export type Playing = { stop(): void };

export type BufferHost = {
  /** The sound at `uri`, fetched and decoded; rejects when it cannot be. */
  decode(uri: string): Promise<Decoded>;
  /** A volume control of its own for one player. */
  newGain(): { gain: { value: number } };
  /** Plays `sound` through `gain` from `offset` seconds in; `ended` runs when it reaches its end. */
  start(sound: Decoded, gain: { gain: { value: number } }, offset: number, ended: () => void): Playing;
  /** The context's clock, in seconds. */
  now(): number;
  /** Whether the context sounds: before the page's first gesture it does not, and a sound started then is lost, not played late. */
  running(): boolean;
  /** Starts the context, or starts it again after the system stopped it; only a gesture's call counts. */
  resume(): void;
};

/** What the sound code calls on a player (the part of expo-audio's AudioPlayer it uses), and the element-like `media` the page's wrapper reads (web-audio.ts). */
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

export function bufferAudio(host: BufferHost): { create(uri: string): BufferPlayer } {
  // One decode for each file, shared by every player of it.
  const sounds = new Map<string, Promise<Decoded | null>>();
  const decoded = (uri: string): Promise<Decoded | null> => {
    let sound = sounds.get(uri);
    if (!sound) {
      sound = host.decode(uri).catch(() => null);
      sounds.set(uri, sound);
    }
    return sound;
  };

  return {
    create(uri) {
      const gain = host.newGain();
      let sound: Decoded | null = null;
      let playing: Playing | null = null;
      // Where the sound stands when it is not playing, and the clock's time its start would have had when it is.
      let offset = 0;
      let startedAt = 0;
      // A play asked for before the decode is done starts when it is.
      let wanted = false;
      let removed = false;

      const start = (): void => {
        if (!sound || removed) return;
        const started = performance.now();
        playing?.stop();
        if (offset >= sound.duration) offset = 0;
        startedAt = host.now() - offset;
        const mine = host.start(sound, gain, offset, () => {
          if (playing !== mine) return;
          playing = null;
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

      void decoded(uri).then((ready) => {
        sound = ready;
        if (wanted) start();
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
          // A context that does not sound yet (no gesture so far) would hold the sound and play it at the first tap: its moment has gone.
          if (!host.running()) return;
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
          wanted = false;
          removed = true;
          stop();
        },
      };
      return player;
    },
  };
}

/** The page as a BufferHost on `context` (the one the music's elements play through, so one gesture starts both). */
export function browserBuffers(context: () => AudioContext): BufferHost {
  return {
    async decode(uri) {
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`${uri}: ${response.status}`);
      return context().decodeAudioData(await response.arrayBuffer());
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
    running: () => context().state === "running",
    resume() {
      if (context().state !== "running") void context().resume().catch(() => undefined);
    },
  };
}
