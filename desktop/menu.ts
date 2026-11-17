// The application menu: Undo, the text edits a field needs, Full screen and Quit, and About with the version and the licences. No item has an accelerator that the page
// also handles: the page takes Ctrl or Cmd+Z itself (src/play/canvas/table-keys.ts), and a menu accelerator on top would run Undo twice.
import { Menu, dialog, type BrowserWindow, type MenuItemConstructorOptions } from "electron";

import { APP_NAME } from "./identity.ts";
import { LICENCE_LINE, undoScript } from "./undo.ts";

function about(window: BrowserWindow | null, version: string): void {
  const options = { type: "info" as const, title: `About ${APP_NAME}`, message: APP_NAME, detail: `Version ${version}\n\nA fan-made app for playing The Lord of the Rings: The Card Game solo. It runs offline and keeps your saves on this computer.\n\n${LICENCE_LINE}`, buttons: ["OK"] };
  if (window) void dialog.showMessageBox(window, options);
  else void dialog.showMessageBox(options);
}

export function installMenu(platform: NodeJS.Platform, version: string, current: () => BrowserWindow | null): void {
  const mac = platform === "darwin";
  const edit: MenuItemConstructorOptions = {
    label: "Edit",
    submenu: [
      { label: "Undo", click: () => void current()?.webContents.executeJavaScript(undoScript(platform)) },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  };
  const view: MenuItemConstructorOptions = { label: "View", submenu: [{ role: "togglefullscreen" }] };
  const aboutItem: MenuItemConstructorOptions = { label: `About ${APP_NAME}`, click: () => about(current(), version) };
  const template: MenuItemConstructorOptions[] = mac
    ? [{ label: APP_NAME, submenu: [aboutItem, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, { type: "separator" }, { role: "quit" }] }, edit, view]
    : [{ label: "File", submenu: [{ role: "quit" }] }, edit, view, { label: "Help", submenu: [aboutItem] }];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
