// The palette of the theme in force (user request, 2026-10-28). A component that sets a color in a style object reads it here; a class
// name needs no hook, because the root layout swaps the variables the classes read.
import { useTheme } from "../../ui/theme";
import { palettes, type Palette } from "./palette.js";

export function usePalette(): Palette {
  return palettes[useTheme()];
}
