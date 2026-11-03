import { useSyncExternalStore } from "react";

// One short sentence at the foot of the screen saying what a tap just did ("Added Gandalf · 2 of 3"), or why it did
// nothing ("Gandalf: At most three copies."), with Undo when the change can be taken back. A new one replaces the last, so
// quick taps never stack. It lives outside the screens so an outcome ("Saved Hobbits") can follow the screen change after
// Save; any other toast goes when its screen loses focus, so an Undo never lands on a screen it was not shown for.

export type ToastTone = "bone" | "danger";

export type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
  undo: (() => void) | null;
  // Shown on the next screen too: the outcome of an action that leaves the screen (Saved, Imported).
  carry: boolean;
};

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: Toast | null): void {
  current = next;
  for (const listener of listeners) listener();
}

export function showToast(text: string, options: { tone?: ToastTone; undo?: () => void; carry?: boolean } = {}): Toast {
  const toast = { id: nextId, text, tone: options.tone ?? "bone", undo: options.undo ?? null, carry: options.carry ?? false };
  nextId += 1;
  publish(toast);
  return toast;
}

/** Hides the toast when it is still the one with this id. A newer one stays. */
export function dismissToast(id: number): void {
  if (current?.id === id) publish(null);
}

/** The screen that showed the toast lost focus: a toast that does not carry goes, and one that did has now carried. */
export function leaveToastScreen(): void {
  if (!current) return;
  if (current.carry) publish({ ...current, carry: false });
  else publish(null);
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

/** How long a toast stays: longer for a refusal or one with Undo, and ten seconds with a screen reader, as the armed bar does. */
export function toastDuration(toast: Pick<Toast, "tone" | "undo">, screenReader: boolean): number {
  if (screenReader) return 10000;
  if (toast.undo) return 5000;
  return toast.tone === "danger" ? 4500 : 3000;
}
