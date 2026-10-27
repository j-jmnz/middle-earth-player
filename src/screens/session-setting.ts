import { useSyncExternalStore } from "react";

// A setting kept while the app is open and shared by every screen that reads it (a list's view): one value, its readers told when
// it changes. Not stored; a relaunch starts from `initial`.
export type SessionSetting<T> = { get: () => T; set: (next: T) => void; useValue: () => T };

export function sessionSetting<T>(initial: T): SessionSetting<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  const get = () => value;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    get,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    // A hook: call it in a component's body, unconditionally, like any hook.
    useValue: () => useSyncExternalStore(subscribe, get, get),
  };
}
