// Copy game state (docs/design-system-table.md, Table menu): the table menu's debug row, shown while Debug tools is on. It reads the game the store holds
// and the intents the session has saved when the row is tapped, writes them as text (src/play/store/debug-snapshot.ts) and puts the text on the
// clipboard, then says whether it did. Nothing is sent anywhere: the player pastes it where they choose (PRIVACY.md). The phone build holds no
// clipboard module (clipboard.ts), so there the copy answers false and the alert says so.
import { Alert, Platform } from "react-native";

import { debugText, type DebugInput } from "../../play/store/debug-snapshot";
import type { TableStore } from "../../play/store/store";
import { APP_VERSION } from "../update/offer";
import { copyText } from "./clipboard";

/** Where the copied state is read from: the table's store, a card's name by its code, and the intents saved so far (null with no open scenario). */
export type GameStateSource = { store: TableStore; nameOf: (code: string) => string; intents: () => DebugInput["intents"] };

export const COPIED = "Game state copied";
export const COPIED_LINE = "Paste it into a bug report. It holds hidden cards and the order of every deck.";
export const NOT_COPIED = "Could not copy the game state";
export const NOT_COPIED_LINE = "This device gave the app no clipboard to write to.";

// The web build has no Alert (react-native-web's does nothing), so it uses the browser's own.
function tell(title: string, line: string): void {
  if (Platform.OS !== "web") {
    Alert.alert(title, line);
    return;
  }
  (globalThis as { alert?: (message: string) => void }).alert?.(`${title}. ${line}`);
}

/** Copies the game as text and tells the player whether it is on the clipboard. */
export async function copyGameState(source: GameStateSource): Promise<void> {
  const { game, roundSteps } = source.store.getState();
  const text = debugText(game, { build: { app: APP_VERSION, platform: Platform.OS }, nameOf: source.nameOf, intents: source.intents(), roundSteps });
  const copied = await copyText(text);
  tell(copied ? COPIED : NOT_COPIED, copied ? COPIED_LINE : NOT_COPIED_LINE);
}
