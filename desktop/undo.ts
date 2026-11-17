// What the menu sends and says that needs no Electron, so desktop/undo.test.ts runs it (desktop/menu.ts installs the menu).

export const LICENCE_LINE = "Electron and Chromium licences are in the app's folder (LICENSE.electron.txt and LICENSES.chromium.html); the other third-party notices are in THIRD_PARTY_NOTICES.md beside them.";

/**
 * The script Undo runs in the page: a text field keeps its own undo, and anything else gets the keydown the table relays (Cmd+Z on macOS, Ctrl+Z elsewhere), the same
 * event the keyboard makes.
 */
export function undoScript(platform: NodeJS.Platform): string {
  const mac = platform === "darwin";
  return `(() => {
  const target = document.activeElement ?? document.body;
  if (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA") { document.execCommand("undo"); return; }
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: ${!mac}, metaKey: ${mac}, bubbles: true, cancelable: true }));
})()`;
}
