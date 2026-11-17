import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../../../global.css";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Platform, StatusBar, View } from "react-native";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { colorScheme, rem, vars } from "nativewind";
import { useStore } from "zustand";

import { DatabaseBoundary, DatabaseError } from "../data/database-error";
import { DatabaseProvider } from "../data/databases";
import { bindTableSettings, readTableSettings } from "../settings/store";
import { bindCollection } from "../collection/store";
import { startImageDownloads } from "../images/queue";
import { completeStarterInsert, insertStarterDecks } from "../deck/starter-decks";
import { openDatabases, type AppDatabases } from "../data/open-databases";
import { palettes, themeVars } from "../kit/palette.js";
import { tableSettings, type ThemeOption } from "../../ui/table-settings";
import { ThemeContext, useResolvedTheme, type ThemeName } from "../../ui/theme";
import { REM_BASE, UiScaleContext, uiFactor } from "../../ui/ui-scale";
import { useIsTablet } from "../../ui/use-size-class";
import { PicturesReady } from "../../ui/showcase/pictures-ready";
import { SplashGlow } from "../kit/splash-glow";

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

// The native splash hides once SplashGlow has drawn the same frame over it, or when the app has opened, whichever comes first.
function hideNativeSplash(hidden: { current: boolean }): void {
  if (hidden.current) return;
  hidden.current = true;
  SplashScreen.hideAsync().catch(reportSplashHideFailure);
}

// A try/catch cannot be compiled inside a component (React Compiler), so the two below live here.
async function openApp(cancelled: () => boolean, onOpen: (opened: AppDatabases) => void, onFail: (message: string) => void): Promise<void> {
  try {
    const opened = await openDatabases();
    if (cancelled()) return;
    // The stored settings are read before the first screen mounts, so the first frame already has the chosen scale and theme.
    // A row that cannot be read leaves the defaults; the binding below reads again and warns too.
    try {
      tableSettings.getState().hydrate(readTableSettings(opened.user));
    } catch (error: unknown) {
      console.warn(`Table settings did not load (${error instanceof Error ? error.message : "unknown error"}); the defaults are used`);
    }
    onOpen(opened);
  } catch (error: unknown) {
    if (cancelled()) return;
    const reason = error instanceof Error ? error : new Error("Database open failed");
    onFail(reason.message);
  }
}

function startDownloads(databases: AppDatabases): void {
  try {
    startImageDownloads(databases.user);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error : new Error("Image downloads did not start");
    console.warn(reason.message);
  }
}

export default function RootLayout() {
  const [databases, setDatabases] = useState<AppDatabases | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const splashHidden = useRef(false);
  // The drawn splash (SplashGlow) stays until its fade ends, over the first screen.
  const [splashDone, setSplashDone] = useState(false);
  const themeSetting = useStore(tableSettings, (state) => state.settings.theme);
  const resolved = useResolvedTheme();
  const palette = palettes[resolved];
  const scaleSetting = useStore(tableSettings, (state) => state.settings.uiScale);
  const scale = uiFactor(scaleSetting);
  const themeStyle = useMemo(() => vars(themeVars(resolved)), [resolved]);
  const tablet = useIsTablet();

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

    void openApp(() => cancelled, setDatabases, setFailure);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!databases && !failure) return;
    hideNativeSplash(splashHidden);
  }, [databases, failure]);

  useEffect(() => {
    if (!databases || Platform.OS === "web") return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (!cancelled) startDownloads(databases);
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

  // The player's collection (the packs they have switched off): loaded once, every change written back.
  useEffect(() => {
    if (!databases) return;
    return bindCollection(databases.user, (message) => console.warn(message));
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
  // outside that View, so the effect above writes the same variables (and the color scheme) onto the page's root.
  // The status bar is hidden on every screen, from launch (app.json, UIStatusBarHidden) and here twice over: StatusBar for the app's
  // window (and an Android Modal, which copies its flag) and the stack's statusBarHidden for each screen's view controller, so it stays
  // hidden whichever way iOS reads it. Screens keep their head clear of a notch with useTopInset (docs/design-system.md, Navigation).
  return (
    <ThemeContext.Provider value={resolved}>
    <UiScaleContext.Provider value={scale}>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.night }}>
      {/* The web page's title: a reader says it first, and the web accessibility check needs one. Rendered on the web only: on iOS
          Head publishes a Handoff activity whose URL needs an origin in the router config, and without one it raises an alert. */}
      {Platform.OS === "web" ? (
        <Head>
          <title>Middle-Earth Player</title>
        </Head>
      ) : null}
      <StatusBar hidden />
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View className="flex-1" style={themeStyle}>
          {failure ? (
            <DatabaseError message={failure} />
          ) : databases ? (
            <DatabaseBoundary>
              <DatabaseProvider databases={databases}>
                {/* A tablet (shorter side 600 points or more) turns every route but the table, which is landscape only. A phone is portrait
                    except on the table and on the card, booklet, glossary and rule screens, which are "all" on phones and tablets alike,
                    so a phone's landscape table is not turned back to read a card. */}
                {/* A screen two or more pushes down is hidden (React Activity: its effects stop and its renders wait, its state stays), so a
                    stack of screens does not keep rendering under the one on top. This is expo-router 58's freezeOnBlur, which it ignores. */}
                <Stack
                  activityEnabled
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: palette.night },
                    orientation: tablet ? "all" : "portrait",
                    statusBarHidden: true,
                  }}
                >
                  {/* The table turns off the edge swipe back: a drag from the hand's edge
                      must not leave the table. ‹ Path (‹ Scenarios for a standalone game) leaves it. */}
                  <Stack.Screen name="table/[saveId]" options={{ orientation: "landscape", gestureEnabled: false }} />
                  <Stack.Screen name="standalone/table/[gameId]" options={{ orientation: "landscape", gestureEnabled: false }} />
                  <Stack.Screen name="card/[code]" options={{ orientation: "all" }} />
                  <Stack.Screen name="booklet/[id]" options={{ orientation: "all" }} />
                  {/* The table's Rules opens the glossary, so it and a rule are "all" too. */}
                  <Stack.Screen name="glossary" options={{ orientation: "all" }} />
                  <Stack.Screen name="rule/[id]" options={{ orientation: "all" }} />
                </Stack>
                <PicturesReady />
              </DatabaseProvider>
            </DatabaseBoundary>
          ) : null}
        </View>
      </SafeAreaProvider>
      {splashDone ? null : <SplashGlow loading={!databases && !failure} onShown={() => hideNativeSplash(splashHidden)} onDone={() => setSplashDone(true)} />}
    </GestureHandlerRootView>
    </UiScaleContext.Provider>
    </ThemeContext.Provider>
  );
}
