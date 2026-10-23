import { Component, type ReactNode } from "react";
import { Text, View } from "react-native";

export function DatabaseError({ message }: { message: string }) {
  return (
    <View collapsable={false} className="flex-1 bg-white px-6 pt-safe dark:bg-black">
      <Text className="text-4xl font-semibold text-black dark:text-white">Database</Text>
      <Text
        testID="database-error"
        className="mt-6 text-2xl leading-8 text-neutral-800 dark:text-neutral-200"
      >
        {message}
      </Text>
    </View>
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
