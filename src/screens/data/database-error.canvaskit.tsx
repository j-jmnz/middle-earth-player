// The database failure screen on the web and the desktop (database-error.tsx is the phone's, unchanged; metro.config.js serves this file in its place on the web platform only).
// A saves database that does not open there (the sync worker timing out under load, a file the browser would not hand over) says what failed in a player's words and offers
// Retry, which reloads the page and so opens the databases again; the reason the browser gave stays below as a muted line for a bug report. The boundary is the phone's text.
import { Component, type ReactNode } from "react";
import { View } from "react-native";

import { BodyText, Screen, ScreenTitle } from "../kit/chrome";
import { PrimaryButton } from "../../ui/buttons";

export function DatabaseError({ message }: { message: string }) {
  return (
    <Screen>
      <View className="pt-6">
        <ScreenTitle>Your saves</ScreenTitle>
      </View>
      <BodyText testID="database-error" tone="danger" className="mt-6">
        Your saves could not be read just now.
      </BodyText>
      <BodyText tone="muted" className="mt-2">
        Nothing was changed. Try again in a moment.
      </BodyText>
      <View className="mt-6 flex-row">
        <PrimaryButton label="Retry" testID="database-retry" onPress={() => window.location.reload()} />
      </View>
      <BodyText testID="database-error-reason" tone="muted" className="mt-6">
        {message}
      </BodyText>
    </Screen>
  );
}

export class DatabaseBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: unknown): { message: string } {
    const failure = error instanceof Error ? error : new Error("Database query failed");
    return { message: failure.message };
  }

  render() {
    if (this.state.message) return <DatabaseError message={this.state.message} />;
    return this.props.children;
  }
}
