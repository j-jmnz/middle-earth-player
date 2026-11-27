import { describe, expect, it } from "vitest";

import { SYNC_RESULT_BYTES, SYNC_WAIT_LIMIT_MS, giveBackSyncBuffers, syncWaitExpired, takeSyncBuffers } from "./sync-wait";

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

describe("takeSyncBuffers", () => {
  it("hands the same pair to each call that gave it back", () => {
    const first = takeSyncBuffers();
    expect(first.lockBuffer.byteLength).toBe(4);
    expect(first.resultBuffer.byteLength).toBe(SYNC_RESULT_BYTES);
    giveBackSyncBuffers(first);
    const second = takeSyncBuffers();
    expect(second.resultBuffer).toBe(first.resultBuffer);
    expect(second.lockBuffer).toBe(first.lockBuffer);
    giveBackSyncBuffers(second);
  });
  it("makes a new pair after a call that never gave its pair back (a timeout: the worker may still write there)", () => {
    const lost = takeSyncBuffers();
    const next = takeSyncBuffers();
    expect(next.resultBuffer).not.toBe(lost.resultBuffer);
    expect(next.lockBuffer).not.toBe(lost.lockBuffer);
    giveBackSyncBuffers(next);
  });
});
