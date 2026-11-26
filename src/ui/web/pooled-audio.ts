// The web app's audio players (src/ui/sound/audio-player.canvaskit.ts; docs/design-system-table.md, Sound). Safari lets an audio element play only when its own
// play() was once called inside a gesture, and expo-audio's web player makes a new element for each sound, each piece of music and each repeat of a loop, most of
// them started by a timer: so in Safari the music played only when a start happened to fall on a tap. (Chrome on an iPad asks for no gesture, so it played.) Here the
// elements are kept and used again. Every gesture gives each element that has not had one its play() ("blessed": a play and a pause in the same breath, which sounds
// nothing), and a few blessed spares are kept for the players made between gestures. Each element plays through a gain node of one AudioContext, because iOS ignores
// an element's own volume, and the music's fades need one. No browser here: `AudioHost` is the page (browserHost), so a test runs the rest.
import { span } from "./meter-span.ts";

/** The part of an audio element the players use. */
export type PoolElement = {
  src: string;
  readonly paused: boolean;
  readonly ended: boolean;
  currentTime: number;
  readonly duration: number;
  readonly readyState: number;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
};

export type AudioHost = {
  /** A new element that plays through a gain node of its own. */
  newElement(): { element: PoolElement; gain: { gain: { value: number } } };
  /** Starts the AudioContext, or starts it again after the system stopped it; only a gesture's call counts. */
  resume(): void;
  /** Calls `handler` inside every gesture that can let audio play. */
  onGesture(handler: () => void): void;
};

/** What the sound and music code calls on a player: the part of expo-audio's AudioPlayer they use. */
export type PooledPlayer = {
  readonly playing: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly isLoaded: boolean;
  volume: number;
  /** The element, for the page's blur and focus (web-audio.ts). */
  readonly media: PoolElement;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  remove(): void;
};

type Slot = { element: PoolElement; gain: { gain: { value: number } }; blessed: boolean; used: boolean; wanted: boolean };

// The web app's test meter is told how long a gesture's blessing and a new player took (meter-span.ts).

// How many blessed elements wait unused. A loop's next copy and a scenario's two pieces are made between gestures.
export const SPARES = 4;
// A sound effect is at most a few seconds (scripts/build/sound-picks.ts); a refused one is not played late, a refused loop is.
const LOOP_SECONDS = 10;
// HTMLMediaElement.HAVE_CURRENT_DATA.
const HAVE_DATA = 2;

const swallow = (): void => undefined;

/**
 * `sample` is the file a spare is given to be blessed with, since an element needs something to play: a short sound effect. It must not be a piece of music.
 * An element loads what it is given, and a spare that was given the first player's file, the menu's music, buffered minutes of audio for nothing, each spare
 * with a media player of its own; on an iPad that held the page's thread for most of a minute after each new piece. With no sample there are no spares.
 */
export function pooledAudio(host: AudioHost, spares: number = SPARES, sample: string | null = null): { create(uri: string): PooledPlayer } {
  const slots: Slot[] = [];

  const add = (): Slot => {
    const slot: Slot = { ...host.newElement(), blessed: false, used: false, wanted: false };
    slots.push(slot);
    return slot;
  };

  // Inside a gesture: the element's play() is what Safari remembers. One that should be sounding starts; any other is paused before it sounds.
  const bless = (slot: Slot): void => {
    if (!slot.used) {
      if (sample === null) return;
      slot.element.src = sample;
    }
    slot.blessed = true;
    if (slot.wanted) {
      slot.element.play().catch(swallow);
      return;
    }
    const volume = slot.gain.gain.value;
    slot.gain.gain.value = 0;
    slot.element.play().catch(swallow);
    slot.element.pause();
    slot.gain.gain.value = volume;
  };

  host.onGesture(() => {
    const started = performance.now();
    host.resume();
    for (const slot of slots) if (!slot.blessed) bless(slot);
    // One new spare a gesture at most: a new element costs the page time (a media player and its file), a tap fires several gestures, and the tap's own work comes next.
    if (sample !== null && slots.filter((slot) => !slot.used && slot.blessed).length < spares) bless(add());
    span("audio", performance.now() - started);
  });

  return {
    create(uri) {
      const started = performance.now();
      const slot = slots.find((each) => !each.used && each.blessed) ?? slots.find((each) => !each.used) ?? add();
      slot.used = true;
      slot.wanted = false;
      slot.gain.gain.value = 1;
      slot.element.src = uri;
      const { element, gain } = slot;
      const length = () => (Number.isFinite(element.duration) ? element.duration : 0);
      span("audio", performance.now() - started);
      return {
        get playing() {
          return slot.used && !element.paused && !element.ended;
        },
        get currentTime() {
          return element.currentTime;
        },
        get duration() {
          return length();
        },
        get isLoaded() {
          return element.readyState >= HAVE_DATA;
        },
        get volume() {
          return gain.gain.value;
        },
        set volume(value: number) {
          gain.gain.value = Math.min(1, Math.max(0, value));
        },
        media: element,
        play() {
          slot.wanted = true;
          host.resume();
          element.play().catch(() => {
            // Refused: this element has had no gesture after all. The next gesture starts a loop; a short sound's moment has gone.
            slot.blessed = false;
            const seconds = length();
            if (seconds > 0 && seconds <= LOOP_SECONDS) slot.wanted = false;
          });
        },
        pause() {
          slot.wanted = false;
          element.pause();
        },
        seekTo(seconds) {
          element.currentTime = seconds;
          return Promise.resolve();
        },
        remove() {
          slot.wanted = false;
          slot.used = false;
          element.pause();
          element.removeAttribute("src");
          element.load();
        },
      };
    },
  };
}

// The gestures that can give a user activation (the HTML standard's activation-triggering events).
const GESTURES = ["pointerup", "touchend", "click", "keydown"] as const;

/** The page as an AudioHost: one AudioContext, made when first asked for, and the window's gestures in the capture phase. `context` hands it to the sound effects (buffer-audio.ts). */
export function browserHost(win: Window & typeof globalThis): AudioHost & { context(): AudioContext } {
  let context: AudioContext | null = null;
  const audio = (): AudioContext => {
    context ??= new win.AudioContext();
    return context;
  };
  // The system stops the context when the page leaves the front; coming back asks for it again, which Safari allows once a gesture has started it.
  win.document.addEventListener("visibilitychange", () => {
    if (win.document.visibilityState === "visible" && context) void context.resume().catch(swallow);
  });
  return {
    context: audio,
    newElement() {
      const element = new win.Audio();
      element.preload = "auto";
      const gain = audio().createGain();
      audio().createMediaElementSource(element).connect(gain).connect(audio().destination);
      return { element, gain };
    },
    resume() {
      // Made here if nothing has made it: a page whose first sound is an effect has no element yet, and the gesture must start the context.
      if (audio().state !== "running") void audio().resume().catch(swallow);
    },
    onGesture(handler) {
      for (const gesture of GESTURES) win.addEventListener(gesture, handler, true);
    },
  };
}
