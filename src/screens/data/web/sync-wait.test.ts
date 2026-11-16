import { describe, expect, it } from "vitest";

import { SYNC_WAIT_LIMIT_MS, syncWaitExpired } from "./sync-wait";

describe("syncWaitExpired", () => {
  it("waits out the limit on the clock, not on a count", () => {
    expect(syncWaitExpired(1000, 1000)).toBe(false);
    expect(syncWaitExpired(1000, 1000 + SYNC_WAIT_LIMIT_MS - 1)).toBe(false);
    expect(syncWaitExpired(1000, 1000 + SYNC_WAIT_LIMIT_MS)).toBe(true);
  });
  it("takes a limit of its own", () => {
    expect(syncWaitExpired(0, 99, 100)).toBe(false);
    expect(syncWaitExpired(0, 100, 100)).toBe(true);
  });
  it("is about fifteen seconds, far past a slow OPFS flush", () => {
    expect(SYNC_WAIT_LIMIT_MS).toBe(15_000);
  });
});
