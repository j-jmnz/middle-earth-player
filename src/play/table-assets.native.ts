// The files the table canvas and the combat spotlight's layer draw with, loaded once for the app. Skia's own useImage and useFont read and
// decode their file for each component that calls them, so the canvas, its token layer and the spotlight's full-screen layer each did it again
// (the same damage token, the same two card backs, the same Marcellus file). Here each image and each typeface is loaded on first use and kept,
// and every reader shares it; a Font is made once for each file and size. They are small (icons, three font files) and the table uses them
// whenever it is open, so they are not released.
import { loadData, Skia, type DataSourceParam, type SkData, type SkFont, type SkImage, type SkTypeface } from "@shopify/react-native-skia";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { BackImages, TokenImages } from "./canvas-pieces.native.tsx";
import { CARD_BACK_FILES, ICON_FILES } from "./icons/files.generated.ts";

// A file being loaded or loaded: `value` is null until then.
type Slot<T> = { value: T | null; started: boolean; listeners: Set<() => void> };

const IMAGES = new Map<DataSourceParam, Slot<SkImage>>();
const TYPEFACES = new Map<DataSourceParam, Slot<SkTypeface>>();
const FONTS = new Map<string, SkFont>();

function slotOf<T>(cache: Map<DataSourceParam, Slot<T>>, source: DataSourceParam): Slot<T> {
  const held = cache.get(source);
  if (held) return held;
  const made: Slot<T> = { value: null, started: false, listeners: new Set() };
  cache.set(source, made);
  return made;
}

// Starts loading once; a file that does not load is tried again the next time a reader subscribes.
function load<T>(slot: Slot<T>, source: DataSourceParam, factory: (data: SkData) => T | null): void {
  if (slot.started) return;
  slot.started = true;
  loadData(source, factory)
    .then((value) => {
      if (!value) {
        slot.started = false;
        return;
      }
      slot.value = value;
      for (const listener of [...slot.listeners]) listener();
    })
    .catch(() => {
      slot.started = false;
    });
}

function useLoaded<T>(cache: Map<DataSourceParam, Slot<T>>, source: DataSourceParam, factory: (data: SkData) => T | null): T | null {
  const slot = slotOf(cache, source);
  const subscribe = useCallback(
    (listener: () => void) => {
      slot.listeners.add(listener);
      load(slot, source, factory);
      return () => {
        slot.listeners.delete(listener);
      };
    },
    [slot, source, factory],
  );
  const snapshot = useCallback(() => slot.value, [slot]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

const imageOf = (data: SkData) => Skia.Image.MakeImageFromEncoded(data);
const typefaceOf = (data: SkData) => Skia.Typeface.MakeFreeTypeFaceFromData(data);

/** The image of an asset, shared by every reader; null while its file loads. */
export function useSharedImage(source: DataSourceParam): SkImage | null {
  return useLoaded(IMAGES, source, imageOf);
}

/** The five token icons a card draws, as one object that keeps its identity until an image arrives (a hook call cannot sit inside an object the compiler memoizes). */
export function useTokenImages(): TokenImages {
  const resource = useSharedImage(ICON_FILES.resource);
  const damage = useSharedImage(ICON_FILES.damage);
  const progress = useSharedImage(ICON_FILES.progress);
  const questPoints = useSharedImage(ICON_FILES.questPoints);
  const engagementCost = useSharedImage(ICON_FILES.engagementCost);
  return { resource, damage, progress, questPoints, engagementCost };
}

/** The two printed card backs, as one object that keeps its identity until an image arrives. */
export function useBackImages(): BackImages {
  const player = useSharedImage(CARD_BACK_FILES.player);
  const encounter = useSharedImage(CARD_BACK_FILES.encounter);
  return { player, encounter };
}

/** A font of a font asset at a size, shared by every reader; null while its file loads. */
export function useSharedFont(source: DataSourceParam, size: number): SkFont | null {
  const typeface = useLoaded(TYPEFACES, source, typefaceOf);
  return useMemo(() => {
    if (!typeface) return null;
    const key = `${String(source)}@${size}`;
    const held = FONTS.get(key);
    if (held) return held;
    const made = Skia.Font(typeface, size);
    FONTS.set(key, made);
    return made;
  }, [typeface, source, size]);
}
