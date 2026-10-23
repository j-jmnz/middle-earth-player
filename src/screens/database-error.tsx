import { Component, type ReactNode } from "react";
import { View } from "react-native";

import { BodyText, Screen, ScreenTitle } from "./chrome";

export function DatabaseError({ message }: { message: string }) {
  return (
    <Screen>
      <View className="pt-6">
        <ScreenTitle>Database</ScreenTitle>
      </View>
      <BodyText testID="database-error" className="mt-6">
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
