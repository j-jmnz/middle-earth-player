// The bottom inset a pinned bar keeps clear of (bottom-inset.ts), remembered across screens since launch.
import { useEffect } from "react";
import { useWindowDimensions } from "react-native";
import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";

import { bottomInset } from "./bottom-inset";

const launch = initialWindowMetrics;
const memory = { portrait: launch && launch.frame.height > launch.frame.width ? launch.insets.bottom : 0 };

export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { inset, seen } = bottomInset(insets.bottom, window.height > window.width, memory.portrait);
  useEffect(() => {
    memory.portrait = seen;
  }, [seen]);
  return inset;
}
