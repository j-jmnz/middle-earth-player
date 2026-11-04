// The table's screen lock (user request, 2026-10-28): each hold releases only its own tag, whatever order the requests settle in.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { holdAwake } from "./use-keep-awake.ts";

const lock = vi.hoisted(() => ({ tags: new Set<string>(), pending: [] as (() => void)[] }));
vi.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: (tag: string) =>
    new Promise<void>((resolve) => {
      lock.pending.push(() => {
        lock.tags.add(tag);
        resolve();
      });
    }),
  deactivateKeepAwake: (tag: string) => {
    lock.tags.delete(tag);
    return Promise.resolve();
  },
}));

const settle = async (index: number) => {
  lock.pending[index]?.();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  lock.tags.clear();
  lock.pending.length = 0;
});

describe("holdAwake", () => {
  it("holds the lock once the request settles", async () => {
    const release = holdAwake();
    await settle(0);
    expect(lock.tags.size).toBe(1);
    release();
    expect(lock.tags.size).toBe(0);
  });

  it("releases a lock that settles after an unmount", async () => {
    const release = holdAwake();
    release();
    await settle(0);
    expect(lock.tags.size).toBe(0);
  });

  it("keeps the second hold when the first settles late (on, off, on)", async () => {
    const first = holdAwake();
    first();
    const second = holdAwake();
    await settle(1);
    await settle(0);
    expect(lock.tags.size).toBe(1);
    second();
    expect(lock.tags.size).toBe(0);
  });
});
