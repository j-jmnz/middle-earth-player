// The update check (docs/architecture.md, Update check; user request, 2026-11-17): once a day, while Check for new versions is on and the build is a
// release, one GET of GitHub's latest-release endpoint, with no header, cookie or identifier of the app's own. The answer's version and date are kept
// in user.db (`settings`, key "update") with the time of the answer and the version whose ribbon was closed; the offer itself is src/ui/update-offer.ts.
// It runs a few seconds after the app opens and again when the app comes back to the foreground, each time only when a check is due. No network, a
// refused request or an odd answer changes nothing the player sees.
import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { AppState } from "react-native";

import { settings, type StoredJson } from "../data/user-schema";
import { tableSettings } from "../../ui/table-settings";
import { checkDue, checksFor, LATEST_RELEASE_URL, parseLatestRelease, parseStoredUpdate, updateStore, type StoredUpdate } from "../../ui/update-offer";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

const UPDATE_KEY = "update";
// The first check waits this long after the databases open, so it never competes with the first screen.
export const FIRST_CHECK_DELAY_MS = 3000;
// A request that has not answered by then is dropped; the next launch or return to the app asks again.
export const REQUEST_TIMEOUT_MS = 10000;

/** What the check needs of `fetch`: the status and the body. */
export type UpdateFetch = (url: string, init: { signal: AbortSignal }) => Promise<{ status: number; json: () => Promise<unknown> }>;

export function readStoredUpdate<TRun>(user: Db<TRun>): StoredUpdate {
  const row = user.select({ value: settings.value }).from(settings).where(eq(settings.key, UPDATE_KEY)).get();
  return parseStoredUpdate(row?.value ?? null);
}

export function writeStoredUpdate<TRun>(user: Db<TRun>, value: StoredUpdate): void {
  const json = value as unknown as StoredJson;
  user.insert(settings).values({ key: UPDATE_KEY, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } }).run();
}

/**
 * The stored row after one answer: a 200 names the latest release (or none, for a body that is not one), a 404 says the repository has none yet, and
 * any other status (a rate limit, a server error) keeps what was known. Every answer counts as the day's check, so a refusal is not asked again at once.
 */
export function afterAnswer(stored: StoredUpdate, status: number, body: unknown, now: number): StoredUpdate {
  if (status === 200) return { ...stored, checkedAt: now, latest: parseLatestRelease(body) };
  if (status === 404) return { ...stored, checkedAt: now, latest: null };
  return { ...stored, checkedAt: now };
}

// The answer's status and body, or null when the request did not complete (offline, a timeout, a refused host) or a 200's body could not be read
// whole (cut off by the timeout, not JSON): that is no answer, so what was known stays and the next launch or return asks again.
async function ask(fetcher: UpdateFetch, signal: AbortSignal): Promise<{ status: number; body: unknown } | null> {
  try {
    const response = await fetcher(LATEST_RELEASE_URL, { signal });
    const body: unknown = response.status === 200 ? await response.json() : null;
    return { status: response.status, body };
  } catch {
    return null;
  }
}

/** Closes the ribbon for `version`: it stays closed until a later version is found. */
export function dismissUpdate(version: string): void {
  const { stored, set } = updateStore.getState();
  set({ ...stored, dismissed: version });
}

export type UpdateCheckOptions = {
  // The running app's version (expo-constants); a development build's 0.0.0 never asks.
  current: string;
  fetch?: UpdateFetch;
  now?: () => number;
  // Calls `listener` when the app comes back to the foreground; returns the unsubscribe. AppState by default.
  onActive?: (listener: () => void) => () => void;
  firstDelayMs?: number;
  warn: (message: string) => void;
};

function appActive(listener: () => void): () => void {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") listener();
  });
  return () => subscription.remove();
}

const defaultFetch: UpdateFetch = (url, init) => fetch(url, init);

/**
 * Loads the stored row into the update store, writes each later change back, and checks whenever one is due: a few seconds after this call, when the
 * app comes back to the foreground and when Check for new versions is turned on. Returns the stop, which also drops a request in flight.
 */
export function startUpdateChecks<TRun>(user: Db<TRun>, options: UpdateCheckOptions): () => void {
  const fetcher = options.fetch ?? defaultFetch;
  const now = options.now ?? Date.now;
  try {
    updateStore.getState().set(readStoredUpdate(user));
  } catch (error: unknown) {
    options.warn(`The update check's row did not load (${error instanceof Error ? error.message : "unknown error"}); it checks again`);
  }
  const unwrite = updateStore.subscribe((state, previous) => {
    if (state.stored === previous.stored) return;
    try {
      writeStoredUpdate(user, state.stored);
    } catch (error: unknown) {
      options.warn(`The update check's row was not saved (${error instanceof Error ? error.message : "unknown error"})`);
    }
  });
  if (!checksFor(options.current)) return unwrite;

  // The request in flight, if any: one at a time, each with its own controller, so a timed-out request never cancels the next.
  let inFlight: AbortController | null = null;
  let stopped = false;
  const check = (): void => {
    if (stopped || inFlight || !tableSettings.getState().settings.checkUpdates) return;
    if (!checkDue(updateStore.getState().stored.checkedAt, now())) return;
    const controller = new AbortController();
    inFlight = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    void ask(fetcher, controller.signal).then((answer) => {
      clearTimeout(timeout);
      inFlight = null;
      if (stopped || !answer) return;
      const { stored, set } = updateStore.getState();
      set(afterAnswer(stored, answer.status, answer.body, now()));
    });
  };

  const first = setTimeout(check, options.firstDelayMs ?? FIRST_CHECK_DELAY_MS);
  const unactive = (options.onActive ?? appActive)(check);
  const unsetting = tableSettings.subscribe((state, previous) => {
    if (state.settings.checkUpdates && !previous.settings.checkUpdates) check();
  });
  return () => {
    stopped = true;
    clearTimeout(first);
    inFlight?.abort();
    unactive();
    unsetting();
    unwrite();
  };
}
