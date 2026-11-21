// The phone build's clipboard write for Copy game state (copy-state.ts), through expo-clipboard; the web and the desktop build use the browser's
// clipboard (clipboard.ts). Writing only: the app never reads the clipboard (PRIVACY.md). Writing needs no Android or iOS permission.
import { setStringAsync } from "expo-clipboard";

/** Copies `text`; resolves true once it is on the clipboard, false when the write is refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    return await setStringAsync(text);
  } catch {
    return false;
  }
}
