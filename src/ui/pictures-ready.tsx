// The showcase build's marker that every picture on screen has drawn (picture-loads.ts): a 1 pt element with testID `pictures-ready`, shown
// once no picture has been held for SETTLE ms, which each capture flow waits for (.maestro/showcase/). Its alpha is 0.01, not 0, so the
// test driver finds it, as `table-area` is. Every other build renders nothing.
import { useEffect, useState, useSyncExternalStore } from "react";
import { View } from "react-native";

import { pictureSnapshot, SHOWCASE, subscribePictures } from "./picture-loads.ts";

const SETTLE = 800;

export function PicturesReady() {
  const snapshot = useSyncExternalStore(subscribePictures, pictureSnapshot, pictureSnapshot);
  // The snapshot that has stayed idle for SETTLE ms: a newer hold or release makes it stale until the next wait ends.
  const [settled, setSettled] = useState(-2);
  useEffect(() => {
    if (!SHOWCASE || snapshot < 0) return;
    const timer = setTimeout(() => setSettled(snapshot), SETTLE);
    return () => clearTimeout(timer);
  }, [snapshot]);
  if (!SHOWCASE || snapshot < 0 || settled !== snapshot) return null;
  return <View testID="pictures-ready" accessible accessibilityLabel="Pictures ready" pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, opacity: 0.01 }} />;
}
