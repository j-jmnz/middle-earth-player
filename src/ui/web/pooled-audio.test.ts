// The web app's audio players (src/ui/web/pooled-audio.ts): every element gets its play() inside a gesture, spares are kept blessed, a removed
// player's element is used again, and a refused loop starts at the next gesture.
import { describe, expect, it } from "vitest";

import { musicMode, pooledAudio, type AudioHost, type PoolElement } from "./pooled-audio.ts";

type Fake = PoolElement & { plays: number; allowed: boolean; gain: { gain: { value: number } }; heard: number[] };

function setup(spares = 2, sample: string | null = "/tick.m4a") {
  const elements: Fake[] = [];
  let gesture: () => void = () => undefined;
  let resumes = 0;
  let inGesture = false;
  const host: AudioHost = {
    newElement() {
      const gain = { gain: { value: 1 } };
      const element: Fake = {
        src: "",
        paused: true,
        ended: false,
        currentTime: 0,
        duration: Number.NaN,
        readyState: 0,
        plays: 0,
        allowed: false,
        gain,
        heard: [],
        // Safari's rule: a play() inside a gesture is allowed and remembered; outside one, only a remembered element plays.
        play() {
          if (inGesture) element.allowed = true;
          if (!element.allowed) return Promise.reject(new Error("NotAllowedError"));
          element.plays += 1;
          (element as { paused: boolean }).paused = false;
          element.heard.push(gain.gain.value);
          return Promise.resolve();
        },
        pause() {
          (element as { paused: boolean }).paused = true;
        },
        load() {},
        removeAttribute() {
          element.src = "";
        },
      };
      elements.push(element);
      return { element, gain };
    },
    // The file's own address, as soon as asked.
    source: async (uri) => uri,
    resume() {
      resumes += 1;
    },
    onGesture(handler) {
      gesture = handler;
    },
  };
  const tap = () => {
    inGesture = true;
    gesture();
    inGesture = false;
  };
  return { pool: pooledAudio(host, spares, sample), host, elements, tap, resumes: () => resumes };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the web app's audio players", () => {
  it("blesses a player made before any gesture without sounding it, and it then plays from a timer", async () => {
    const { pool, elements, tap } = setup();
    const sound = pool.create("/tick.m4a");
    sound.volume = 0.8;
    await settle();
    tap();
    expect(elements[0]!.allowed).toBe(true);
    expect(elements[0]!.paused).toBe(true);
    expect(elements[0]!.heard).toEqual([0]);
    expect(sound.volume).toBe(0.8);
    sound.play();
    await settle();
    expect(sound.playing).toBe(true);
  });

  it("starts a loop that was refused at the next gesture", async () => {
    const { pool, elements, tap } = setup();
    const music = pool.create("/menu.m4a");
    music.play();
    await settle();
    expect(music.playing).toBe(false);
    tap();
    expect(music.playing).toBe(true);
    expect(elements[0]!.plays).toBe(1);
  });

  it("does not play a refused short sound late", async () => {
    const { pool, elements, tap } = setup();
    const sound = pool.create("/tick.m4a");
    (elements[0] as { duration: number }).duration = 0.4;
    sound.play();
    await settle();
    tap();
    expect(sound.playing).toBe(false);
  });

  it("keeps blessed spares, so a player made between gestures plays at once", async () => {
    const { pool, elements, tap } = setup(2);
    pool.create("/tick.m4a");
    await settle();
    tap();
    // One new spare for each gesture.
    expect(elements).toHaveLength(2);
    tap();
    expect(elements).toHaveLength(3);
    expect(elements.slice(1).every((each) => each.allowed && each.paused && each.src === "/tick.m4a")).toBe(true);
    const next = pool.create("/shire.m4a");
    expect(next.media).toBe(elements[1]);
    await settle();
    expect(elements[1]!.src).toBe("/shire.m4a");
    next.play();
    await settle();
    expect(next.playing).toBe(true);
    // The next gesture makes one more spare.
    tap();
    expect(elements.filter((each) => each.allowed)).toHaveLength(4);
    tap();
    expect(elements).toHaveLength(4);
  });

  it("gives a spare the sample, never a player's own file, and makes no spare with no sample", async () => {
    const withSample = setup(2, "/tick.m4a");
    withSample.pool.create("/menu-music.m4a");
    await settle();
    withSample.tap();
    expect(withSample.elements.map((each) => each.src)).toEqual(["/menu-music.m4a", "/tick.m4a"]);
    const none = setup(2, null);
    none.pool.create("/menu-music.m4a");
    none.tap();
    none.tap();
    expect(none.elements).toHaveLength(1);
  });

  it("uses a removed player's element again, at full volume", async () => {
    const { pool, elements, tap } = setup(0);
    const first = pool.create("/a.m4a");
    first.volume = 0.2;
    await settle();
    tap();
    first.remove();
    expect(elements[0]!.src).toBe("");
    const second = pool.create("/b.m4a");
    expect(second.media).toBe(elements[0]);
    expect(second.volume).toBe(1);
    expect(elements).toHaveLength(1);
  });

  it("keeps the volume between 0 and 1, reports a length of 0 until it is known, and asks the context on each play", async () => {
    const { pool, elements, resumes } = setup();
    const player = pool.create("/a.m4a");
    player.volume = 3;
    expect(player.volume).toBe(1);
    player.volume = -1;
    expect(player.volume).toBe(0);
    expect(player.duration).toBe(0);
    expect(player.isLoaded).toBe(false);
    await settle();
    await player.seekTo(2);
    expect(elements[0]!.currentTime).toBe(2);
    player.play();
    await settle();
    expect(resumes()).toBe(1);
  });

  it("waits for its file before it plays, and gives a late file to no later player of the element", async () => {
    let arrive: (address: string) => void = () => undefined;
    const elements: Fake[] = [];
    const base = setup(0);
    // A host whose file comes when the test says.
    const pool = pooledAudio(
      {
        newElement: () => {
          const made = base.host.newElement() as { element: Fake; gain: { gain: { value: number } } };
          elements.push(made.element);
          return made;
        },
        source: () => new Promise<string>((resolve) => (arrive = resolve)),
        resume: () => undefined,
        onGesture: () => undefined,
      },
      0,
    );
    const first = pool.create("/menu.m4a");
    first.play();
    expect(elements[0]!.src).toBe("");
    const late = arrive;
    first.remove();
    const second = pool.create("/shire.m4a");
    late("blob:menu");
    await settle();
    expect(elements[0]!.src).toBe("");
    arrive("blob:shire");
    await settle();
    expect(second.media.src).toBe("blob:shire");
  });

  it("reads the music's mode from the address before the stored one, and takes any other word as blob", () => {
    expect(musicMode("?music=stream", null)).toBe("stream");
    expect(musicMode("", "direct")).toBe("direct");
    expect(musicMode("?music=blob", "direct")).toBe("blob");
    expect(musicMode("?music=loud", null)).toBe("blob");
    expect(musicMode("", null)).toBe("blob");
  });
});
