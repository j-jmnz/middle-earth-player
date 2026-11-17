// The height the update ribbon takes above the root stack (src/screens/update/ribbon.tsx), 0 while it is hidden. The stack under it tells its
// screens a top inset of 0, so a piece that sizes itself from the window (the card preview) takes this off as well. In src/ui so src/play reads it.
import { createContext, useContext } from "react";

export const RibbonRoom = createContext(0);

/** The ribbon's height in points, or 0. */
export function useRibbonRoom(): number {
  return useContext(RibbonRoom);
}
