import { useCallback, useSyncExternalStore } from "react";

export type CachedImage = {
  uri: string;
  width: number;
  height: number;
};

type ImageSnapshotView = {
  count: number;
  revision: number;
};

// Changed in place: each download adds one file, and the start adds every stored file one by one, so copying the whole store on each
// add grew with the square of the files kept.
// Each code's entry is replaced, never mutated, so a reader of one code still sees a new value when its file changes.
const files = new Map<string, CachedImage>();
const emptySnapshotView: ImageSnapshotView = { count: 0, revision: 0 };
let snapshotView: ImageSnapshotView = emptySnapshotView;
const listeners = new Map<string, Set<() => void>>();
const snapshotListeners = new Set<() => void>();

function subscribeImage(code: string, listener: () => void): () => void {
  const group = listeners.get(code) ?? new Set<() => void>();
  group.add(listener);
  listeners.set(code, group);
  return () => {
    group.delete(listener);
    if (group.size === 0) listeners.delete(code);
  };
}

export function cachedImage(code: string): CachedImage | null {
  return files.get(code) ?? null;
}

export function publishCachedImage(code: string, image: CachedImage): void {
  const current = files.get(code);
  if (current?.uri === image.uri && current.width === image.width) return;
  files.set(code, image);
  snapshotView = { count: files.size, revision: snapshotView.revision + 1 };
  const group = listeners.get(code);
  if (group) {
    for (const listener of group) listener();
  }
  for (const listener of snapshotListeners) {
    try {
      listener();
    } catch (error: unknown) {
      const reason = error instanceof Error ? error : new Error("Image snapshot listener failed");
      console.warn(reason.message);
    }
  }
}

export function subscribeImageSnapshot(listener: () => void): () => void {
  snapshotListeners.add(listener);
  return () => {
    snapshotListeners.delete(listener);
  };
}

export function imageSnapshotView(): ImageSnapshotView {
  return snapshotView;
}

export function useImageSnapshot(): ImageSnapshotView {
  return useSyncExternalStore(subscribeImageSnapshot, imageSnapshotView, () => emptySnapshotView);
}

/**
 * The revision of the image cache while `active`, else 0: a reader that is not showing a picture is not told of the files that land, so it
 * does not render for them. Turning `active` on reads the revision as it is then.
 */
export function useImageRevision(active: boolean): number {
  const revision = useCallback(() => (active ? snapshotView.revision : 0), [active]);
  return useSyncExternalStore(subscribeImageSnapshot, revision, () => 0);
}

function serverImage(): CachedImage | null {
  return null;
}

export function useCachedImage(code: string): CachedImage | null {
  const subscribe = useCallback((listener: () => void) => subscribeImage(code, listener), [code]);
  const getSnapshot = useCallback(() => cachedImage(code), [code]);
  return useSyncExternalStore(subscribe, getSnapshot, serverImage);
}
