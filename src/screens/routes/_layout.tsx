import "react-native-gesture-handler";
import "../../../global.css";

import { useEffect, useRef, useState } from "react";
import { Appearance, Platform } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { colorScheme } from "nativewind";

import { DatabaseBoundary, DatabaseError } from "../database-error";
import { DatabaseProvider } from "../databases";
import { startImageDownloads } from "../images/queue";
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

  if (failure) return <DatabaseError message={failure} />;
  if (!databases) return null;

  return (
    <DatabaseBoundary>
      <DatabaseProvider databases={databases}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.night },
          }}
        />
      </DatabaseProvider>
    </DatabaseBoundary>
  );
}
