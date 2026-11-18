// The table's one way to put text on the clipboard, for Copy game state (copy-state.ts): the browser's clipboard on the web and the desktop build (the
// desktop policy allows the write and nothing else, desktop/policy.ts). The phone build holds no clipboard module, so there it answers false and the
// caller says so. Writing only: the app never reads the clipboard (PRIVACY.md).

type WebClipboard = { writeText?: (text: string) => Promise<void> };

/** Copies `text`; resolves true once it is on the clipboard, false where there is no clipboard to write to or the write is refused. */
export async function copyText(text: string): Promise<boolean> {
  const clipboard = (globalThis as { navigator?: { clipboard?: WebClipboard } }).navigator?.clipboard;
  if (typeof clipboard?.writeText !== "function") return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
