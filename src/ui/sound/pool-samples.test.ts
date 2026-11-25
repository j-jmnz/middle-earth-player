// The sample pool of Android's sound effects (pool-samples.ts): a slot's file is loaded once, a play starts its sample, and a play
// asked for before the file is found is played once it is, unless its moment has gone.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { samplePool } from "./pool-samples.ts";

// A file is found when the test says so: `found(uri)` answers the oldest ask.
function setup() {
  const asks: ((uri: string | null) => void)[] = [];
  const native = { load: vi.fn((_uri: string) => 7), play: vi.fn((_sample: number, _volume: number) => undefined) };
  const failed = vi.fn();
  const fileOf = vi.fn((_source: number) => new Promise<string | null>((resolve) => asks.push(resolve)));
  const found = async (uri: string | null) => {
    asks.shift()?.(uri);
    await Promise.resolve();
    await Promise.resolve();
  };
  return { native, failed, fileOf, found, pool: samplePool(native, fileOf, failed) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(50_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sample pool", () => {
  it("loads a primed slot once and plays nothing", async () => {
    const { pool, native, fileOf, found } = setup();
    pool.prime("ui.tab", 1);
    pool.prime("ui.tab", 1);
    await found("file:///cache/tab.m4a");
    expect(fileOf).toHaveBeenCalledTimes(1);
    expect(native.load).toHaveBeenCalledWith("file:///cache/tab.m4a");
    expect(native.play).not.toHaveBeenCalled();
  });

  it("plays a loaded slot's sample at the volume asked, each time", async () => {
    const { pool, native, found } = setup();
    pool.prime("ui.tab", 1);
    await found("file:///cache/tab.m4a");
    pool.play("ui.tab", 1, 0.8);
    vi.advanceTimersByTime(5000);
    pool.play("ui.tab", 1, 0.5);
    expect(native.play.mock.calls).toEqual([
      [7, 0.8],
      [7, 0.5],
    ]);
    expect(native.load).toHaveBeenCalledTimes(1);
  });

  it("plays a sound asked for before its file is found, once it is", async () => {
    const { pool, native, found } = setup();
    pool.play("ui.tab", 1, 0.8);
    expect(native.play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    await found("file:///cache/tab.m4a");
    expect(native.play.mock.calls).toEqual([[7, 0.8]]);
  });

  it("does not play a sound whose file is found after its moment has gone", async () => {
    const { pool, native, found } = setup();
    pool.play("ui.tab", 1, 0.8);
    vi.advanceTimersByTime(2000);
    await found("file:///cache/tab.m4a");
    expect(native.play).not.toHaveBeenCalled();
    // It is loaded now: the next play sounds.
    pool.play("ui.tab", 1, 0.8);
    expect(native.play).toHaveBeenCalledTimes(1);
  });

  it("asks again for a slot whose file was not found or did not load", async () => {
    const { pool, native, fileOf, found } = setup();
    pool.prime("ui.tab", 1);
    await found(null);
    expect(native.load).not.toHaveBeenCalled();
    native.load.mockReturnValueOnce(0);
    pool.prime("ui.tab", 1);
    await found("file:///cache/tab.m4a");
    pool.prime("ui.tab", 1);
    expect(fileOf).toHaveBeenCalledTimes(3);
  });

  it("reports a file that fails and asks again on the next play", async () => {
    const native = { load: vi.fn(() => 7), play: vi.fn() };
    const failed = vi.fn();
    const fileOf = vi.fn(() => Promise.reject(new Error("no file")));
    const pool = samplePool(native, fileOf, failed);
    pool.play("ui.tab", 1, 1);
    await Promise.resolve();
    await Promise.resolve();
    expect(failed).toHaveBeenCalledTimes(1);
    pool.play("ui.tab", 1, 1);
    expect(fileOf).toHaveBeenCalledTimes(2);
  });
});
