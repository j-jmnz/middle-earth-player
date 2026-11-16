// The one thing the page gets from the shell: whether the platform's screen reader (or any assistive technology) is on, and when that changes. The page cannot ask a
// browser this, and "Follow screen reader" (Settings) turns the table into a list for it (src/ui/web/accessibility.canvaskit.ts reads this object). Nothing else is exposed:
// no Node, no file, no IPC channel. The preload runs sandboxed, so it imports only Electron's renderer modules and ./identity.ts (bundled in).
import { contextBridge, ipcRenderer } from "electron";

import { CHANNEL_CHANGED, CHANNEL_GET, DESKTOP_API } from "./identity.ts";

let enabled = ipcRenderer.sendSync(CHANNEL_GET) === true;
const listeners = new Set<(value: boolean) => void>();
ipcRenderer.on(CHANNEL_CHANGED, (_event, value: unknown) => {
  enabled = value === true;
  for (const listener of [...listeners]) listener(enabled);
});

contextBridge.exposeInMainWorld(DESKTOP_API, {
  accessibilitySupportEnabled: (): boolean => enabled,
  /** Calls `listener` when the flag changes; returns the way to stop. */
  onAccessibilitySupportChanged: (listener: (value: boolean) => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
});
