// The Electron main process: serves the web export over app://, opens the one window and enforces desktop/policy.ts. Everything that can be decided without Electron
// is in the pure modules beside it (serve, policy, bounds, identity). Dev mode (`pnpm desktop dev`, MIDDLE_EARTH_PLAYER_DEV=1, never in a packaged app) loads the Metro server instead.
import path from "node:path";

import { app, BrowserWindow, ipcMain, screen, session, shell } from "electron";

import { registerAppScheme, serveApp } from "./app-protocol.ts";
import { APP_NAME, APP_URL, CHANNEL_CHANGED, CHANNEL_GET, MIN_HEIGHT, MIN_WIDTH, USER_DATA_DIR } from "./identity.ts";
import { installMenu } from "./menu.ts";
import { allowExternal, allowNavigation, allowPermission, allowRequest, DEV_ORIGIN } from "./policy.ts";
import { loadWindowState, saveWindowState } from "./window-state.ts";

const dev = !app.isPackaged && process.env["MIDDLE_EARTH_PLAYER_DEV"] === "1";

// The name and the profile folder are fixed (desktop/identity.ts: OPFS holds the saves under them). A test passes --user-data-dir to use its own profile.
app.setName(APP_NAME);
if (!app.commandLine.hasSwitch("user-data-dir")) app.setPath("userData", path.join(app.getPath("appData"), USER_DATA_DIR));

registerAppScheme();

// The export sits beside the bundle in a checkout (desktop/build/web; the smoke test points MIDDLE_EARTH_PLAYER_WEB_ROOT at its seeded one), and in resources/web in an
// installed app (electron-builder's extraResources), which nothing overrides.
const webRoot = app.isPackaged ? path.join(process.resourcesPath, "web") : (process.env["MIDDLE_EARTH_PLAYER_WEB_ROOT"] ?? path.join(__dirname, "..", "web"));

let window: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const userData = app.getPath("userData");
  const { maximized, ...place } = loadWindowState(userData, screen.getAllDisplays().map((display) => display.workArea));
  const created = new BrowserWindow({
    ...place,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: APP_NAME,
    show: false,
    backgroundColor: "#030405",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: dev,
      spellcheck: false,
    },
  });
  if (maximized) created.maximize();
  created.once("ready-to-show", () => created.show());
  created.on("close", () => {
    const bounds = created.getNormalBounds();
    saveWindowState(userData, { ...bounds, maximized: created.isMaximized() });
  });
  created.on("closed", () => {
    if (window === created) window = null;
  });
  void created.loadURL(dev ? DEV_ORIGIN : APP_URL);
  return created;
}

// Every web contents the app ever makes follows the same rules: no navigation away from the app, no window of its own, links to the project's pages go to the system browser.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (allowExternal(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  const refuse = (event: { preventDefault: () => void }, url: string) => {
    if (!allowNavigation(url, dev)) event.preventDefault();
  };
  contents.on("will-navigate", (event, url) => refuse(event, url));
  contents.on("will-redirect", (event, url) => refuse(event, url));
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

function applySessionPolicy(): void {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, callback) => callback({ cancel: !allowRequest(details.url, dev) }));
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(allowPermission()));
  ses.setPermissionCheckHandler(() => allowPermission());
  ses.setDevicePermissionHandler(() => allowPermission());
  // The backup file (Settings) is a Blob download: the player picks where it goes, and the name the page gave is the one offered.
  ses.on("will-download", (_event, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath("documents"), item.getFilename()), filters: [{ name: "Backup", extensions: ["backup"] }, { name: "All files", extensions: ["*"] }] });
  });
}

function wireAccessibility(): void {
  // Only the app's own page may ask.
  ipcMain.on(CHANNEL_GET, (event) => {
    const asker = event.senderFrame?.url ?? "";
    event.returnValue = allowNavigation(asker, dev) ? app.isAccessibilitySupportEnabled() : false;
  });
  app.on("accessibility-support-changed", (_event, enabled) => window?.webContents.send(CHANNEL_CHANGED, enabled));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  app.on("window-all-closed", () => app.quit());
  void app.whenReady().then(() => {
    if (!dev) serveApp(webRoot);
    applySessionPolicy();
    wireAccessibility();
    installMenu(process.platform, app.getVersion(), () => window);
    window = createWindow();
  });
}
