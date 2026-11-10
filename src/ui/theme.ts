// The theme the app draws in (docs/design-system.md, Settings; user request, 2026-10-28). The setting is Dark,
// Light or System; System follows the phone's own scheme. Dark is the default, so nothing changes for a player who never opens Settings.
import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";
import { useStore } from "zustand";

import { tableSettings, type ThemeOption } from "./table-settings.ts";

export type ThemeName = "dark" | "light";

/** The theme to draw: the chosen one, or for System the phone's scheme (Dark when the phone reports none). */
export function resolveTheme(setting: ThemeOption, osScheme: "light" | "dark" | "unspecified" | null | undefined): ThemeName {
  if (setting === "system") return osScheme === "light" ? "light" : "dark";
  return setting;
}

/** Reads the setting and the phone's scheme. The root layout calls it and hands the answer down through ThemeContext; so does each page (`Screen`, chrome-frame.tsx), for a screen React Activity holds hidden. */
export function useResolvedTheme(): ThemeName {
  const setting = useStore(tableSettings, (state) => state.settings.theme);
  return resolveTheme(setting, useColorScheme());
}

/** The resolved theme, provided once at the root so a list row pays one context read, not a store selector and a scheme listener. Without a provider (tests, isolated renders) it is Dark. */
export const ThemeContext = createContext<ThemeName>("dark");

/** The resolved theme name. Read it once per component and pick the palette or the table tokens from it. */
export function useTheme(): ThemeName {
  return useContext(ThemeContext);
}
