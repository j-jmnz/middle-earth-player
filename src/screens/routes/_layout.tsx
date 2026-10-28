import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../../../global.css";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Platform, StatusBar, View } from "react-native";
import { Stack } from "expo-router";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { colorScheme, rem, vars } from "nativewind";
import { useStore } from "zustand";

import { DatabaseBoundary, DatabaseError } from "../database-error";
import { DatabaseProvider } from "../databases";
import { bindTableSettings, readTableSettings } from "../settings-store";
import { startImageDownloads } from "../images/queue";
import { completeStarterInsert, insertStarterDecks } from "../starter-decks";
import { openDatabases, type AppDatabases } from "../open-databases";
import { palettes, themeVars } from "../palette.js";
import { tableSettings, type ThemeOption } from "../../play/table-settings";
import { ThemeContext, useResolvedTheme, type ThemeName } from "../../play/theme";
import { REM_BASE, UiScaleContext, uiFactor } from "../../play/ui-scale";

void SplashScreen.preventAutoHideAsync();

// One rem is 14 points times the UI scale, and every spacing, size, type and radius class is written in rem (user request, 2026-10-28;
// metro.config.js keeps rem from being inlined). Set here at import, with Medium, so the first frame is drawn at a known size before
// the stored choice is read; the layout sets it again whenever the choice changes. On the web it sets the page's root font size.
rem.set(REM_BASE * uiFactor("medium"));

// Dark, Light or System (user request, 2026-10-28). NativeWind hears the choice; System hands the scheme back to the phone, so
// useColorScheme (and the theme with it) keeps following the phone, where forcing the resolved name would pin it.
function applyColorScheme(setting: ThemeOption, resolved: ThemeName) {
  colorScheme.set(setting === "system" ? "system" : resolved);
}

function reportSplashHideFailure(error: unknown): void {
  const reason = error instanceof Error ? error : new Error("Splash screen failed to hide");
  console.warn(reason.message);
}

export default function RootLayout() {
  const [databases, setDatabases] = useState<AppDatabases | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const splashHidden = useRef(false);
  const themeSetting = useStore(tableSettings, (state) => state.settings.theme);
  const resolved = useResolvedTheme();
  const palette = palettes[resolved];
  const scaleSetting = useStore(tableSettings, (state) => state.settings.uiScale);
  const scale = uiFactor(scaleSetting);
  const themeStyle = useMemo(() => vars(themeVars(resolved)), [resolved]);

  // Before paint, so a changed scale never shows a frame at the old size.
  useLayoutEffect(() => {
    rem.set(REM_BASE * scale);
  }, [scale]);

  useEffect(() => {
    applyColorScheme(themeSetting, resolved);
  }, [themeSetting, resolved]);

  // Web only: the variables and the color scheme on <html>, so a Modal's portal, form controls and scrollbars follow the theme.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const root = document.documentElement;
    for (const [name, value] of Object.entries(themeVars(resolved))) root.style.setProperty(name, value);
    root.style.colorScheme = resolved;
  }, [resolved]);

  useEffect(() => {
    let cancelled = false;

    async function start(): Promise<void> {
      try {
        const opened = await openDatabases();
        if (cancelled) return;
        // The stored settings are read before the first screen mounts, so the first frame already has the chosen scale and theme.
        // A row that cannot be read leaves the defaults; the binding below reads again and warns too.
        try {
          tableSettings.getState().hydrate(readTableSettings(opened.user));
        } catch (error: unknown) {
          console.warn(`Table settings did not load (${error instanceof Error ? error.message : "unknown error"}); the defaults are used`);
        }
        setDatabases(opened);
      } catch (error: unknown) {
        if (cancelled) return;
        const reason = error instanceof Error ? error : new Error("Database open failed");
        setFailure(reason.message);
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (splashHidden.current) return;
    if (!databases && !failure) return;
    splashHidden.current = true;
    SplashScreen.hideAsync().catch(reportSplashHideFailure);
  }, [databases, failure]);

  useEffect(() => {
    if (!databases || Platform.OS === "web") return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        startImageDownloads(databases.user);
      } catch (error: unknown) {
        const reason = error instanceof Error ? error : new Error("Image downloads did not start");
        console.warn(reason.message);
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [databases]);

  // The table's settings (stops, free Responses always used, readability, the guide): loaded once, every change written back.
  useEffect(() => {
    if (!databases) return;
    return bindTableSettings(databases.user, (message) => console.warn(message));
  }, [databases]);

  useEffect(() => {
    if (!databases) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      completeStarterInsert(() => {
        insertStarterDecks(databases.user);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [databases]);

  // NativeWind fills pt-safe and pb-safe from a SafeAreaProvider rendered here. Expo Router's own provider
  // is compiled without NativeWind's JSX, so on a phone every inset would read 0 without this one.
  // On a phone the View under the providers sets the active theme's color variables for every class below it, a Modal's content
  // included, because variables travel by context there and not by the view tree. On the web a Modal is portaled into document.body,
  // outside that View, so the effect above writes the same variables (and the color scheme) onto the page's root. The status bar's
  // icons go light on Night and dark on Daylight.
  return (
    <ThemeContext.Provider value={resolved}>
    <UiScaleContext.Provider value={scale}>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.night }}>
      {/* iOS sets the status bar per screen (statusBarStyle below): the table hides it, which needs view-controller-based
          status bar appearance (app.json), and that turns this module into a no-op there. */}
      {Platform.OS === "ios" ? null : <StatusBar barStyle={resolved === "dark" ? "light-content" : "dark-content"} />}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View className="flex-1" style={themeStyle}>
          {failure ? (
            <DatabaseError message={failure} />
          ) : databases ? (
            <DatabaseBoundary>
              <DatabaseProvider databases={databases}>
                {/* Portrait everywhere but the table, which is played in landscape only. The card, booklet, glossary and rule screens
                    open from both, so they follow the phone and the table does not turn the phone back to read a card. */}
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: palette.night },
                    orientation: "portrait",
                    statusBarStyle: Platform.OS === "ios" ? (resolved === "dark" ? "light" : "dark") : undefined,
                  }}
                >
                  {/* The table hides the status bar for room, and turns off the edge swipe back: a drag from the hand's edge
                      must not leave the table. ‹ Path (‹ Scenarios for a standalone game) leaves it. */}
                  <Stack.Screen name="table/[saveId]" options={{ orientation: "landscape", statusBarHidden: true, gestureEnabled: false }} />
                  <Stack.Screen name="standalone/table/[gameId]" options={{ orientation: "landscape", statusBarHidden: true, gestureEnabled: false }} />
                  <Stack.Screen name="card/[code]" options={{ orientation: "all" }} />
                  <Stack.Screen name="booklet/[id]" options={{ orientation: "all" }} />
                  {/* The table's Rules opens the glossary, so it and a rule turn with the phone too. */}
                  <Stack.Screen name="glossary" options={{ orientation: "all" }} />
                  <Stack.Screen name="rule/[id]" options={{ orientation: "all" }} />
                </Stack>
              </DatabaseProvider>
            </DatabaseBoundary>
          ) : null}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </UiScaleContext.Provider>
    </ThemeContext.Provider>
  );
}
