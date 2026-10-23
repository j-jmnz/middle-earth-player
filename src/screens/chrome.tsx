import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { Tabs } from "expo-router";

import { palette } from "./palette.js";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export function Screen({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} collapsable={false} className="flex-1 bg-paper px-6 pt-safe">
      {children}
    </View>
  );
}

export function ScreenTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" className="font-semibold text-display text-ink">
      {children}
    </Text>
  );
}

export function BodyText({
  children,
  tone = "ink",
  testID,
  className,
}: {
  children: string;
  tone?: "ink" | "muted";
  testID?: string;
  className?: string;
}) {
  const toneClass = tone === "muted" ? "text-muted" : "text-ink";
  return (
    <Text testID={testID} className={className ? `text-body ${toneClass} ${className}` : `text-body ${toneClass}`}>
      {children}
    </Text>
  );
}

export function ListRow({
  label,
  onPress,
  testID,
  leading,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  leading?: ReactNode;
}) {
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-11 justify-center"
      style={({ pressed }) => (pressed ? { backgroundColor: palette.pressed } : undefined)}
    >
      {leading ? (
        <View className="flex-row items-center">
          {leading}
          <Text className="ml-3 flex-1 text-body text-ink">{label}</Text>
        </View>
      ) : (
        <Text className="text-body text-ink">{label}</Text>
      )}
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-11 justify-center"
      style={({ pressed }) => (pressed ? { backgroundColor: palette.pressed } : undefined)}
    >
      <Text className="font-semibold text-body text-ink">{label}</Text>
    </Pressable>
  );
}

export function BackButton({
  label = "Back",
  onPress,
  testID,
}: {
  label?: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <View className="pb-safe">
      <Pressable
        testID={testID}
        collapsable={false}
        accessibilityRole="button"
        onPress={onPress}
        className="min-h-11 justify-center"
        style={({ pressed }) => (pressed ? { backgroundColor: palette.pressed } : undefined)}
      >
        <Text className="font-semibold text-body text-ink">{label}</Text>
      </Pressable>
    </View>
  );
}

export function PaperTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  return (
    <View accessibilityRole="tablist" className="flex-row border-t border-line bg-paper pb-safe">
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            testID={options.tabBarButtonTestID}
            collapsable={false}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={() => {
              const event = emitter.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigateToTab(route.key);
              }
            }}
            className="min-h-11 flex-1 items-center justify-center"
            style={({ pressed }) => (pressed ? { backgroundColor: palette.pressed } : undefined)}
          >
            <Text className={focused ? "font-semibold text-label text-ink" : "text-label text-muted"}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
