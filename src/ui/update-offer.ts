// A newer release of the app (docs/architecture.md, Update check; docs/design-system.md, Update ribbon): what the last check found, which version
// the player closed the ribbon for, and the pure rules over them. The request and user.db are src/screens/update/check.ts; this module store is
// here, in src/ui, so the table menu (src/play) and the screens read the same offer. Pure but for the store, so a test reads every rule.
import { createStore } from "zustand/vanilla";

/** The repository whose GitHub releases are the app's (the same one Settings' links name, src/screens/settings/links.ts). */
export const RELEASE_REPOSITORY = "j-jmnz/middle-earth-player";
/** The one request the check makes: the latest published release, neither a draft nor a prerelease, through GitHub's public API. */
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/latest`;
/** How long a check stands: a launch or a return to the app asks again only once a day has passed since the last answer. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const SEMVER = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export type Version = readonly [number, number, number];

/** A version or a `v` tag (`v0.5.0`) as its three numbers, or null when it is not plain semver (a dev build's "unknown", a prerelease tag). */
export function parseVersion(text: string): Version | null {
  const match = SEMVER.exec(text.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** Whether `a` is a later version than `b`. */
export function isNewer(a: Version, b: Version): boolean {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** A release as the check keeps it: its version without the `v`, and when GitHub published it (ISO 8601, or null when the answer had none). */
export type Release = { version: string; publishedAt: string | null };

/** The release in GitHub's answer to LATEST_RELEASE_URL, or null when the body is not a published, semver-tagged release. Only the tag and the date are read. */
export function parseLatestRelease(body: unknown): Release | null {
  if (body == null || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (value.draft === true || value.prerelease === true || typeof value.tag_name !== "string") return null;
  const version = parseVersion(value.tag_name);
  if (!version) return null;
  return { version: version.join("."), publishedAt: typeof value.published_at === "string" ? value.published_at : null };
}

/** The release page a Get it opens: built from the repository and the version, never from a URL in the answer, so the app opens only its own GitHub. */
export function releasePageUrl(version: string): string {
  return `https://github.com/${RELEASE_REPOSITORY}/releases/tag/v${version}`;
}

/** What user.db keeps (key "update"): when the last answer came, the release it named (null for none) and the version whose ribbon the player closed. */
export type StoredUpdate = { checkedAt: number | null; latest: Release | null; dismissed: string | null };

export const EMPTY_UPDATE: StoredUpdate = { checkedAt: null, latest: null, dismissed: null };

/** The stored row read back: a missing or malformed field is empty, so a bad row means one more check, never a crash. */
export function parseStoredUpdate(raw: unknown): StoredUpdate {
  const value = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const latest = value.latest != null && typeof value.latest === "object" ? (value.latest as Record<string, unknown>) : null;
  const version = latest && typeof latest.version === "string" && parseVersion(latest.version) ? latest.version : null;
  return {
    checkedAt: typeof value.checkedAt === "number" && Number.isFinite(value.checkedAt) ? value.checkedAt : null,
    latest: version ? { version, publishedAt: typeof latest?.publishedAt === "string" ? latest.publishedAt : null } : null,
    dismissed: typeof value.dismissed === "string" ? value.dismissed : null,
  };
}

/** Whether a check is due: never asked, a day or more since the last answer, or a clock set back past it. */
export function checkDue(checkedAt: number | null, now: number): boolean {
  return checkedAt == null || now - checkedAt >= CHECK_INTERVAL_MS || now < checkedAt;
}

/** Whether this build checks at all: a release build, whose version is plain semver above 0.0.0. A development build (app.json's 0.0.0) never asks. */
export function checksFor(current: string): boolean {
  const version = parseVersion(current);
  return version != null && isNewer(version, [0, 0, 0]);
}

/** The newer version to offer, or null: the check is on, this build checks, and the release found is later than the one running. */
export function offerOf(stored: StoredUpdate, current: string, enabled: boolean): string | null {
  if (!enabled || !stored.latest) return null;
  const running = parseVersion(current);
  const found = parseVersion(stored.latest.version);
  if (!running || !found || !checksFor(current)) return null;
  return isNewer(found, running) ? stored.latest.version : null;
}

/** The ribbon shows the offer until the player closes it for that version; a later version shows it again. */
export function ribbonShows(offer: string | null, dismissed: string | null): boolean {
  return offer != null && offer !== dismissed;
}

/** The words the ribbon, the table menu and Settings say. */
export const offerTitle = (version: string) => `Version ${version} is out`;
export const offerDetail = (current: string) => `You have ${current}. Your saves stay.`;
export const OFFER_LINK_HINT = "Opens the release page in your browser";
export const CHECK_LABEL = "Check for new versions";
export const CHECK_LINE = "Once a day, asks GitHub for the latest release. Nothing about you or your games is sent.";

/** The release date as Settings says it ("Released 15 November 2026"), or null without one. */
export function releasedLine(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `Released ${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export type UpdateState = { stored: StoredUpdate; set: (stored: StoredUpdate) => void };

/** The app's one update store: hydrated from user.db and set after each answer or a closed ribbon (src/screens/update/check.ts writes it back). */
export const updateStore = createStore<UpdateState>()((set) => ({
  stored: EMPTY_UPDATE,
  set: (stored) => set({ stored }),
}));
