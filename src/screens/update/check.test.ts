// The update check (src/screens/update/check.ts): when it asks, what one request sends, what an answer leaves in user.db and the update store,
// and that no network, a refusal or the setting turned off changes nothing the player sees.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import migrations from "../../../drizzle/migrations";
import { DEFAULT_SETTINGS, tableSettings } from "../../ui/table-settings";
import { CHECK_INTERVAL_MS, EMPTY_UPDATE, LATEST_RELEASE_URL, updateStore } from "../../ui/update-offer";
import { afterAnswer, dismissUpdate, readStoredUpdate, startUpdateChecks, writeStoredUpdate, type UpdateFetch } from "./check.ts";

vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove: () => undefined }) } }));

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return drizzle(sqlite);
}

const NOW = Date.parse("2026-11-17T12:00:00Z");

// A fetch that records each call and answers with `status` and `body`, or throws (offline) when `status` is null.
function stubFetch(status: number | null, body: unknown = null) {
  const calls: { url: string; init: unknown }[] = [];
  const fetcher: UpdateFetch = (url, init) => {
    calls.push({ url, init });
    if (status == null) return Promise.reject(new TypeError("Network request failed"));
    return Promise.resolve({ status, json: () => Promise.resolve(body) });
  };
  return { fetcher, calls };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  tableSettings.getState().hydrate(DEFAULT_SETTINGS);
  updateStore.getState().set(EMPTY_UPDATE);
});

describe("the update check", () => {
  it("asks once, a few seconds after the app opens, with nothing but the URL and a signal", async () => {
    const user = openUser();
    const { fetcher, calls } = stubFetch(200, { tag_name: "v0.5.0", published_at: "2026-11-15T10:00:00Z" });
    const stop = startUpdateChecks(user, { current: "0.4.2", fetch: fetcher, now: () => NOW, onActive: () => () => undefined, warn: () => undefined });
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(LATEST_RELEASE_URL);
    expect(Object.keys(calls[0].init as object)).toEqual(["signal"]);
    expect(updateStore.getState().stored).toEqual({ checkedAt: NOW, latest: { version: "0.5.0", publishedAt: "2026-11-15T10:00:00Z" }, dismissed: null });
    expect(readStoredUpdate(user)).toEqual(updateStore.getState().stored);
    stop();
  });

  it("does not ask again within a day, and asks on return to the app once a day has passed", async () => {
    const user = openUser();
    writeStoredUpdate(user, { checkedAt: NOW - 1000, latest: null, dismissed: null });
    let clock = NOW;
    let active: () => void = () => undefined;
    const { fetcher, calls } = stubFetch(404);
    const stop = startUpdateChecks(user, { current: "0.4.2", fetch: fetcher, now: () => clock, onActive: (listener) => ((active = listener), () => undefined), warn: () => undefined });
    await vi.advanceTimersByTimeAsync(3000);
    active();
    expect(calls).toHaveLength(0);
    clock = NOW + CHECK_INTERVAL_MS;
    active();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    expect(updateStore.getState().stored.checkedAt).toBe(clock);
    stop();
  });

  it("never asks from a development build, or while the setting is off until it is turned on", async () => {
    const user = openUser();
    const dev = stubFetch(200, { tag_name: "v0.5.0" });
    const stopDev = startUpdateChecks(user, { current: "0.0.0", fetch: dev.fetcher, now: () => NOW, onActive: () => () => undefined, warn: () => undefined });
    await vi.advanceTimersByTimeAsync(3000);
    expect(dev.calls).toHaveLength(0);
    stopDev();

    tableSettings.getState().update({ checkUpdates: false });
    const off = stubFetch(200, { tag_name: "v0.5.0" });
    const stop = startUpdateChecks(user, { current: "0.4.2", fetch: off.fetcher, now: () => NOW, onActive: () => () => undefined, warn: () => undefined });
    await vi.advanceTimersByTimeAsync(3000);
    expect(off.calls).toHaveLength(0);
    tableSettings.getState().update({ checkUpdates: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(off.calls).toHaveLength(1);
    stop();
  });

  it("leaves everything as it was when offline", async () => {
    const user = openUser();
    const known = { checkedAt: NOW - CHECK_INTERVAL_MS * 2, latest: { version: "0.5.0", publishedAt: null }, dismissed: null };
    writeStoredUpdate(user, known);
    const { fetcher, calls } = stubFetch(null);
    const stop = startUpdateChecks(user, { current: "0.4.2", fetch: fetcher, now: () => NOW, onActive: () => () => undefined, warn: () => undefined });
    await vi.advanceTimersByTimeAsync(3000);
    expect(calls).toHaveLength(1);
    expect(updateStore.getState().stored).toEqual(known);
    expect(readStoredUpdate(user)).toEqual(known);
    stop();
  });

  it("drops a request that does not answer in time and asks again later", async () => {
    const user = openUser();
    let clock = NOW;
    let active: () => void = () => undefined;
    const signals: AbortSignal[] = [];
    const hanging: UpdateFetch = (_url, init) => {
      signals.push(init.signal);
      return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
    };
    const stop = startUpdateChecks(user, { current: "0.4.2", fetch: hanging, now: () => clock, onActive: (listener) => ((active = listener), () => undefined), warn: () => undefined });
    await vi.advanceTimersByTimeAsync(3000 + 10000);
    expect(signals[0].aborted).toBe(true);
    expect(updateStore.getState().stored.checkedAt).toBeNull();
    clock += 1000;
    active();
    expect(signals).toHaveLength(2);
    expect(signals[1].aborted).toBe(false);
    stop();
    expect(signals[1].aborted).toBe(true);
  });

  it("keeps the closed version in user.db", () => {
    const user = openUser();
    const stop = startUpdateChecks(user, { current: "0.0.0", now: () => NOW, warn: () => undefined });
    dismissUpdate("0.5.0");
    expect(readStoredUpdate(user).dismissed).toBe("0.5.0");
    stop();
  });
});

describe("an answer", () => {
  const known = { checkedAt: 1, latest: { version: "0.5.0", publishedAt: null }, dismissed: "0.5.0" };

  it("replaces the release on a 200, clears it on a 404 and keeps it on a refusal", () => {
    expect(afterAnswer(known, 200, { tag_name: "v0.6.0" }, 9)).toEqual({ checkedAt: 9, latest: { version: "0.6.0", publishedAt: null }, dismissed: "0.5.0" });
    expect(afterAnswer(known, 404, null, 9)).toEqual({ checkedAt: 9, latest: null, dismissed: "0.5.0" });
    expect(afterAnswer(known, 403, null, 9)).toEqual({ ...known, checkedAt: 9 });
  });
});
