import { Component, type ReactNode } from "react";

import { BodyText, Screen, ScreenTitle } from "./chrome";

export function DatabaseError({ message }: { message: string }) {
  return (
    <Screen>
      <ScreenTitle>Database</ScreenTitle>
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
