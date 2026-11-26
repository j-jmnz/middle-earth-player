// The web app's sound effects (src/ui/web/buffer-audio.ts): one decode for each file, a new source for each play, the place kept across a pause, and no
// sound held for later while the context does not sound.
import { describe, expect, it } from "vitest";

import { bufferAudio, type BufferHost } from "./buffer-audio.ts";

function setup(running = true) {
  const state = { now: 0, running, decodes: [] as string[], started: [] as { offset: number; volume: number; stopped: boolean; end: () => void }[], resumes: 0 };
  const host: BufferHost = {
    decode: async (uri) => {
      state.decodes.push(uri);
      if (uri.includes("broken")) throw new Error("no such file");
      return { duration: 2 };
    },
    newGain: () => ({ gain: { value: 1 } }),
    start: (_sound, gain, offset, ended) => {
      const source = { offset, volume: gain.gain.value, stopped: false, end: ended };
      state.started.push(source);
      return { stop: () => void (source.stopped = true) };
    },
    now: () => state.now,
    running: () => state.running,
    resume: () => void (state.resumes += 1),
  };
  return { audio: bufferAudio(host), state };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the web app's sound effects", () => {
  it("decodes a file once for all its players and starts a source for each play", async () => {
    const { audio, state } = setup();
    const first = audio.create("/tick.m4a");
    const second = audio.create("/tick.m4a");
    await settle();
    expect(state.decodes).toEqual(["/tick.m4a"]);
    expect(first.isLoaded).toBe(true);
    expect(first.duration).toBe(2);
    first.volume = 0.5;
    first.play();
    second.play();
    expect(state.started.map((source) => source.volume)).toEqual([0.5, 1]);
    expect(first.playing).toBe(true);
    expect(first.media.paused).toBe(false);
  });

  it("plays a sound asked for before its decode is done, once it is", async () => {
    const { audio, state } = setup();
    const player = audio.create("/tick.m4a");
    player.play();
    expect(state.started).toHaveLength(0);
    await settle();
    expect(state.started).toHaveLength(1);
  });

  it("keeps its place across a pause, and starts again from the start once it has ended", async () => {
    const { audio, state } = setup();
    const player = audio.create("/tick.m4a");
    await settle();
    player.play();
    state.now = 0.5;
    expect(player.currentTime).toBe(0.5);
    player.pause();
    expect(state.started[0]!.stopped).toBe(true);
    expect(player.playing).toBe(false);
    state.now = 3;
    player.play();
    expect(state.started[1]!.offset).toBe(0.5);
    // It reaches its end by itself.
    state.started[1]!.end();
    expect(player.playing).toBe(false);
    expect(player.currentTime).toBe(2);
    player.play();
    expect(state.started[2]!.offset).toBe(0);
  });

  it("seeks a waiting player with no sound, and a playing one by starting it there", async () => {
    const { audio, state } = setup();
    const player = audio.create("/tick.m4a");
    await settle();
    await player.seekTo(1);
    expect(state.started).toHaveLength(0);
    player.play();
    expect(state.started[0]!.offset).toBe(1);
    await player.seekTo(0);
    expect(state.started[0]!.stopped).toBe(true);
    expect(state.started[1]!.offset).toBe(0);
  });

  it("asks the context to start, and loses a sound played while it does not sound", async () => {
    const { audio, state } = setup(false);
    const player = audio.create("/tick.m4a");
    await settle();
    player.play();
    expect(state.resumes).toBe(1);
    expect(state.started).toHaveLength(0);
    state.running = true;
    await settle();
    expect(state.started).toHaveLength(0);
  });

  it("plays nothing for a file that does not decode, and nothing after it is removed", async () => {
    const { audio, state } = setup();
    const broken = audio.create("/broken.m4a");
    const removed = audio.create("/tick.m4a");
    await settle();
    broken.play();
    expect(broken.isLoaded).toBe(false);
    removed.remove();
    removed.play();
    expect(state.started).toHaveLength(0);
  });
});
