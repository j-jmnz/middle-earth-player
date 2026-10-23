import { useCallback, useSyncExternalStore } from "react";

export type CachedImage = {
  uri: string;
  width: number;
  height: number;
};

type ImageSnapshot = {
  files: Readonly<Record<string, CachedImage>>;
};

type ImageSnapshotView = {
  count: number;
  revision: number;
};

let snapshot: ImageSnapshot = { files: {} };
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
  return snapshot.files[code] ?? null;
}

export function publishCachedImage(code: string, image: CachedImage): void {
  if (snapshot.files[code]?.uri === image.uri && snapshot.files[code]?.width === image.width) return;
  snapshot = { files: { ...snapshot.files, [code]: image } };
  snapshotView = { count: Object.keys(snapshot.files).length, revision: snapshotView.revision + 1 };
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

function serverImage(): CachedImage | null {
  return null;
}

export function useCachedImage(code: string): CachedImage | null {
  const subscribe = useCallback((listener: () => void) => subscribeImage(code, listener), [code]);
  const getSnapshot = useCallback(() => cachedImage(code), [code]);
  return useSyncExternalStore(subscribe, getSnapshot, serverImage);
}
