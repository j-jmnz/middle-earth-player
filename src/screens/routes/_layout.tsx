import "react-native-gesture-handler";
import "../../../global.css";

import { useEffect, useRef, useState } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { colorScheme } from "nativewind";

import { DatabaseBoundary, DatabaseError } from "../database-error";
import { DatabaseProvider } from "../databases";
import { openDatabases, type AppDatabases } from "../open-databases";

void SplashScreen.preventAutoHideAsync();

function applyColorScheme(scheme: ColorSchemeName | null) {
  colorScheme.set(scheme === "dark" ? "dark" : "light");
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
    applyColorScheme(Appearance.getColorScheme());
    const subscription = Appearance.addChangeListener(({ colorScheme: scheme }) => {
      applyColorScheme(scheme);
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

  if (failure) return <DatabaseError message={failure} />;
  if (!databases) return null;

  return (
    <DatabaseBoundary>
      <DatabaseProvider databases={databases}>
        <Stack screenOptions={{ headerShown: false }} />
      </DatabaseProvider>
    </DatabaseBoundary>
  );
}
