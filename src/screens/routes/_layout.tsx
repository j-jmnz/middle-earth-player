import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../../../global.css";

import { useEffect, useRef, useState } from "react";
import { Appearance, Platform } from "react-native";
import { Stack } from "expo-router";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { colorScheme } from "nativewind";

import { DatabaseBoundary, DatabaseError } from "../database-error";
import { DatabaseProvider } from "../databases";
import { bindTableSettings } from "../settings-store";
import { startImageDownloads } from "../images/queue";
import { completeStarterInsert, insertStarterDecks } from "../starter-decks";
import { openDatabases, type AppDatabases } from "../open-databases";
import { palette } from "../palette.js";

void SplashScreen.preventAutoHideAsync();

// One theme. Both OS schemes map onto Night.
function applyColorScheme() {
  colorScheme.set("dark");
}

function reportSplashHideFailure(error: unknown): void {
  const reason = error instanceof Error ? error : new Error("Splash screen failed to hide");
  console.warn(reason.message);
}

export default function RootLayout() {
  const [databases, setDatabases] = useState<AppDatabases | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const splashHidden = useRef(false);

  useEffect(() => {
    applyColorScheme();
    const subscription = Appearance.addChangeListener(() => {
      applyColorScheme();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start(): Promise<void> {
      try {
        const opened = await openDatabases();
        if (cancelled) return;
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
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.night }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
