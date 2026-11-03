import { describe, expect, it } from "vitest";

import { createSessionCache, fingerprintOf, sessionCacheOf } from "./cache.ts";

type Session = { name: string };

describe("the session cache", () => {
  it("returns a session only for the exact fingerprint it was kept under", () => {
    const cache = createSessionCache<Session>();
    const opened = { name: "opened" };
    cache.set("save-1", "a", opened);
    expect(cache.get("save-1", "a")).toBe(opened);
    expect(cache.get("save-1", "b")).toBeNull();
    expect(cache.get("save-2", "a")).toBeNull();
  });

  it("tells one save from the same save with an intent more, an Undo, or another intent at the same count", () => {
    const save = (intents: string[], loadout = "x") => fingerprintOf({ id: "s", active: { seed: 1, intents }, loadout }, 7);
    expect(save(["a", "b"])).toBe(save(["a", "b"]));
    expect(save(["a", "b"])).not.toBe(save(["a", "b", "c"]));
    expect(save(["a", "b"])).not.toBe(save(["a"]));
    expect(save(["a", "b"])).not.toBe(save(["a", "c"]));
    expect(save(["a"], "x")).not.toBe(save(["a"], "y"));
    expect(fingerprintOf({ id: "s" }, 1)).not.toBe(fingerprintOf({ id: "s" }, 2));
  });

  it("asks a followed table for its game when the save it wrote is asked for, and for nothing else", () => {
    const cache = createSessionCache<Session>();
    let written = "after 3 intents";
    let asked = 0;
    cache.follow("save-1", () => {
      asked += 1;
      return { fingerprint: written, session: { name: `game at ${written}` } };
    });
    expect(asked).toBe(0);
    expect(cache.get("save-1", "some other save")).toBeNull();
    expect(cache.get("save-1", written)?.name).toBe("game at after 3 intents");
    // An Undo and a new intent at the same count wrote another save: the old one is not served.
    written = "after 3 other intents";
    expect(cache.get("save-1", "after 3 intents")?.name).toBe("game at after 3 intents");
    expect(cache.get("save-1", written)?.name).toBe("game at after 3 other intents");
  });

  it("keeps the last few saves and drops the one used longest ago", () => {
    const cache = createSessionCache<Session>(2);
    cache.set("a", "1", { name: "a" });
    cache.set("b", "1", { name: "b" });
    expect(cache.get("a", "1")?.name).toBe("a");
    cache.set("c", "1", { name: "c" });
    expect(cache.size()).toBe(2);
    expect(cache.get("b", "1")).toBeNull();
    expect(cache.get("a", "1")?.name).toBe("a");
    expect(cache.get("c", "1")?.name).toBe("c");
  });

  it("has one cache for each database and kind", () => {
    const user = {};
    expect(sessionCacheOf(user, "save")).toBe(sessionCacheOf(user, "save"));
    expect(sessionCacheOf(user, "save")).not.toBe(sessionCacheOf(user, "standalone"));
    expect(sessionCacheOf(user, "save")).not.toBe(sessionCacheOf({}, "save"));
  });
});
