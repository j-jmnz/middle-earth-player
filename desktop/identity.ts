// What names the desktop app to the system and to the page. Every value here is permanent once a release ships (.claude/rules/release-standards.md, Tags and releases says
// why: the saves live under the origin and the profile folder). APP_ID is the installer's and the OS's name for the app (an update installs over the last one by it).
// desktop/identity.test.ts pins them.
export const APP_SCHEME = "app";
export const APP_HOST = "middle-earth-player";
/** The page's origin, without a trailing slash. */
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
/** The page the window opens: the export is served from the origin's root, so its absolute `/assets/...` paths resolve. */
export const APP_URL = `${APP_ORIGIN}/`;
export const APP_NAME = "Middle-Earth Player";
/** The folder under the OS's application-data folder that holds the profile (Electron's `userData`). */
export const USER_DATA_DIR = "Middle-Earth Player";
export const APP_ID = "com.middleearth.player";

/** The smallest window: the smallest landscape size the phone's compact class gives the table (docs/architecture.md, Desktop, Window). */
export const MIN_WIDTH = 844;
export const MIN_HEIGHT = 390;

/** The name of the object the preload puts on `window`; src/ui/web/accessibility.canvaskit.ts reads it. */
export const DESKTOP_API = "middleEarthDesktop";
/** The two channels between the preload and the main process. */
export const CHANNEL_GET = "desktop:accessibility-support";
export const CHANNEL_CHANGED = "desktop:accessibility-support-changed";
