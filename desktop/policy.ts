// What the desktop app may reach and open (docs/architecture.md, Desktop, Policy: the only requests that leave the computer are the RingsDB deck import and the
// once-a-day update check). Pure, so
// desktop/policy.test.ts runs it; desktop/main.ts applies it to the session, to navigation, to new windows and to permission requests.
import { APP_HOST, APP_SCHEME } from "./identity.ts";

/** The RingsDB endpoints the deck import calls (src/screens/deck/import.ts, ringsDbUrl and the card lookup): the public API, and the deck load of a shared deck. */
export const RINGSDB_PATHS: readonly string[] = ["https://ringsdb.com/api/public/", "https://ringsdb.com/api/oauth2/deck/load/"];

/** The update check's one request (src/ui/update-offer.ts, LATEST_RELEASE_URL; desktop/ imports nothing from src/, so the test holds the two equal): this exact URL, no other GitHub API path. */
export const LATEST_RELEASE_URL = "https://api.github.com/repos/j-jmnz/middle-earth-player/releases/latest";

/** The development server `pnpm desktop dev` loads; allowed only then. */
export const DEV_ORIGIN = "http://localhost:8081";

// The two pages Settings opens in the browser (src/screens/settings/links.ts): the project's GitHub.
const GITHUB_HOST = "github.com";
const GITHUB_PROJECT = "/j-jmnz/middle-earth-player";

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

// Node's URL gives a custom scheme the origin "null", so the scheme and the host are compared themselves.
function isApp(url: URL): boolean {
  return url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST && url.username === "" && url.password === "";
}

/** Whether the page's own request may go out: the bundle, a data or blob URL (no network), a RingsDB deck endpoint, the update check, and in development the Metro server. */
export function allowRequest(url: string, dev: boolean): boolean {
  const parsed = parse(url);
  if (parsed === null) return false;
  if (parsed.protocol === "data:" || parsed.protocol === "blob:") return true;
  if (isApp(parsed)) return true;
  if (dev && (parsed.origin === DEV_ORIGIN || parsed.origin === DEV_ORIGIN.replace("http:", "ws:"))) return true;
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "") return false;
  return parsed.href === LATEST_RELEASE_URL || RINGSDB_PATHS.some((prefix) => parsed.href.startsWith(prefix));
}

/** Whether the window may navigate to a URL: only within the app's origin (and the dev server in development). */
export function allowNavigation(url: string, dev: boolean): boolean {
  const parsed = parse(url);
  return parsed !== null && (isApp(parsed) || (dev && parsed.origin === DEV_ORIGIN));
}

/** Whether a link the page opens in a new window goes to the system browser: https, on the project's GitHub page, with no credentials. */
export function allowExternal(url: string): boolean {
  const parsed = parse(url);
  if (parsed === null || parsed.protocol !== "https:" || parsed.hostname !== GITHUB_HOST || parsed.port !== "" || parsed.username !== "" || parsed.password !== "") return false;
  return parsed.pathname === GITHUB_PROJECT || parsed.pathname.startsWith(`${GITHUB_PROJECT}/`);
}

/** Every permission request (camera, microphone, notifications, geolocation, clipboard read, ...) is denied: nothing in the app asks for one. */
export function allowPermission(): boolean {
  return false;
}
