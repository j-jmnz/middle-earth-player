import { useSyncExternalStore } from "react";

// One short sentence at the foot of the screen saying what a tap just did ("Added Gandalf · 2 of 3"), or why it did
// nothing ("Gandalf At most three copies."), with Undo when the change can be taken back. A new one replaces the last, so
// quick taps never stack. It lives outside the screens so a sentence survives the screen change after Save.

export type ToastTone = "bone" | "danger";

export type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
  undo: (() => void) | null;
};

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: Toast | null): void {
  current = next;
  for (const listener of listeners) listener();
}

export function showToast(text: string, options: { tone?: ToastTone; undo?: () => void } = {}): Toast {
  const toast = { id: nextId, text, tone: options.tone ?? "bone", undo: options.undo ?? null };
  nextId += 1;
  publish(toast);
  return toast;
}

/** Hides the toast when it is still the one with this id. A newer one stays. */
export function dismissToast(id: number): void {
  if (current?.id === id) publish(null);
}

export function getToast(): Toast | null {
  return current;
}

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useToast(): Toast | null {
  return useSyncExternalStore(subscribeToast, getToast, getToast);
}

/** How long a toast stays: longer for a refusal, and ten seconds with a screen reader, as the armed bar does. */
export function toastDuration(tone: ToastTone, screenReader: boolean): number {
  if (screenReader) return 10000;
  return tone === "danger" ? 4500 : 3000;
}
