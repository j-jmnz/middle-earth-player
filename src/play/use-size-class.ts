// The size class of the window, live (docs/design-system.md, Standard 8 and Tablets). The math is size-class.ts; this reads the window
// and the UI scale. Read it once per screen and branch on `size`, never on the device.
import { useEffect, useState } from "react";
import { Dimensions, useWindowDimensions, type ScaledSize } from "react-native";

import { isShortWindow, isTabletScreen, showsRail, sizeClass, type SizeClass } from "./size-class.ts";
import { useUiScale } from "./ui-scale.ts";

export type SizeInfo = { size: SizeClass; width: number; height: number; s: number; rail: boolean; short: boolean };

/** The window's size class with its width, height and scale; it changes as the window does (rotation, Split View, a fold). */
export function useSizeClass(): SizeInfo {
  const { width, height } = useWindowDimensions();
  const s = useUiScale();
  const size = sizeClass(width, s);
  return { size, width, height, s, rail: showsRail(size), short: isShortWindow(height, s) };
}

/** Whether the screen is a tablet (its shorter side is 600 points or more); it follows a foldable opening and closing. */
export function useIsTablet(): boolean {
  const [tablet, setTablet] = useState(() => {
    const { width, height } = Dimensions.get("screen");
    return isTabletScreen(width, height);
  });
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ screen }: { screen: ScaledSize }) => setTablet(isTabletScreen(screen.width, screen.height)));
    return () => subscription.remove();
  }, []);
  return tablet;
}
