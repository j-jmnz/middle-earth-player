// How the table peels its layers: the Android hardware Back and a hardware keyboard's Escape and Z (src/ui/key-shortcuts.ts). Back peels one
// layer at a time (src/play/chrome/back.ts) and only then leaves the table; Escape is the same peel without the leave, after the banner,
// which Back does not dismiss. Z is the dock's Undo button, run through the same handler, and only while that button is there and no
// layer is open over the table. Key events reach a View only on Android (key-shortcuts.ts); the table's root takes `onKeyDown`.
import { useEffect, useEffectEvent } from "react";
import { BackHandler } from "react-native";

import { backStep, playLayers, runBackStep } from "../../play/chrome/back-steps";
import type { DockExtra } from "../../play/choice/dock/buttons";
import type { QuestAdvanceState } from "../../play/readouts/use-quest-advance";
import type { TableStore } from "../../play/store/store";
import { keyAction, type KeyInput } from "../../ui/key-shortcuts";

export type TableBackArgs = {
  store: TableStore;
  advance: QuestAdvanceState;
  // The open layers the table's own state holds, and how each one closes.
  open: { menu: boolean; more: boolean; lines: boolean; preview: boolean; reading: boolean; overlay: boolean; panel: boolean };
  close: { menu: () => void; more: () => void; preview: () => void; reading: () => void; overlay: () => void; panel: () => void };
  banner: boolean;
  dismissBanner: () => void;
  // The dock's Undo button, or null when it is not there.
  undo: DockExtra | null;
  // Leaves the table (the last step of Back, never of Escape).
  leave: () => void;
};

// Carries out the topmost layer's close; true when a layer was closed (or the table was left), false when only leaving remained.
function peel(a: TableBackArgs, leaves: boolean): boolean {
  // The quest advance screen is on top: Back is its Progress, and does nothing while the stage asks.
  if (a.advance.shown) {
    if (!a.advance.asks) a.advance.close();
    return true;
  }
  const step = backStep({ ...playLayers(a.store), menuOpen: a.open.menu, moreOpen: a.open.more, linesOpen: a.open.lines, previewOpen: a.open.preview, readingOpen: a.open.reading, overlayOpen: a.open.overlay, panelOpen: a.open.panel });
  if (runBackStep(step, a.store)) return true;
  if (step === "closeMenu") a.close.menu();
  else if (step === "closeMore" || step === "closeLines") a.close.more();
  else if (step === "closePreview") a.close.preview();
  else if (step === "closeReading") a.close.reading();
  else if (step === "closeOverlay") a.close.overlay();
  else if (step === "foldPanel") a.close.panel();
  else if (leaves) a.leave();
  else return false;
  return true;
}

// Undo by key only when the touch path could press the button: it is on the dock and nothing is open over the table.
function undoByKey(a: TableBackArgs): void {
  const o = a.open;
  const layered = o.menu || o.more || o.lines || o.preview || o.reading || o.overlay || a.advance.shown != null;
  if (a.undo && !layered) a.undo.onPress();
}

function onKey(a: TableBackArgs, event: KeyInput): void {
  const action = keyAction(event);
  if (action === "escape") {
    if (a.banner) a.dismissBanner();
    else peel(a, false);
  } else if (action === "undo") undoByKey(a);
}

/** Registers the hardware Back and returns the root's `onKeyDown`. */
export function useTableBack(a: TableBackArgs): (event: { nativeEvent: KeyInput }) => void {
  // Read through an effect event: the handler is added once, so a later render does not move it above a layer's own Back handler (the card preview's).
  const back = useEffectEvent(() => peel(a, true));
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", back);
    return () => subscription.remove();
  }, []);
  return (event) => onKey(a, event.nativeEvent);
}
