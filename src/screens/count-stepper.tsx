import { Pressable, Text, View } from "react-native";

import { copyCapRule } from "../catalog/deck-save";
import { pressedNight } from "./chrome";
import { palette } from "./palette.js";

/** Whether one more copy would break the copy limit (rr.deckbuilding). */
export function stepperFull(count: number, deckLimit: number | null): boolean {
  return copyCapRule(count + 1, deckLimit) !== null;
}

/**
 * − count + for one card in a deck, on the deck editor and the card pool. + on a card that cannot take another copy looks
 * spent and, tapped, says why. The count is gold while the deck holds the card.
 */
export function CountStepper({
  code,
  name,
  count,
  full,
  onChange,
  minus = true,
  ids = { dec: `count-dec-${code}`, count: `count-${code}`, inc: `count-inc-${code}` },
}: {
  code: string;
  name: string;
  count: number;
  full: boolean;
  onChange: (delta: -1 | 1) => void;
  // The pool shows − only on a card the deck holds.
  minus?: boolean;
  ids?: { dec: string; count: string; inc: string };
}) {
  return (
    <View className="flex-row items-center rounded-tile" style={{ backgroundColor: palette.night, borderWidth: 1, borderColor: palette.hairline }}>
      {minus ? (
        <Pressable
          testID={ids.dec}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={count <= 1 ? `Remove ${name}` : `Remove a copy of ${name}`}
          onPress={() => onChange(-1)}
          className="min-h-11 min-w-10 items-center justify-center rounded-tile"
          style={({ pressed }) => (pressed ? pressedNight : undefined)}
        >
          <Text className="text-title text-muted">−</Text>
        </Pressable>
      ) : null}
      {count > 0 || minus ? (
        <Text
          testID={ids.count}
          accessibilityLabel={`${count} in the deck`}
          className={`min-w-6 text-center font-display-bold text-body ${count > 0 ? "text-goldHigh" : "text-faint"}`}
        >
          {String(count)}
        </Text>
      ) : null}
      <Pressable
        testID={ids.inc}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`Add ${count > 0 ? "a copy of " : ""}${name}`}
        accessibilityState={{ disabled: full }}
        onPress={() => onChange(1)}
        className="min-h-11 min-w-10 items-center justify-center rounded-tile"
        style={({ pressed }) => (pressed ? pressedNight : undefined)}
      >
        <Text className={`text-title ${full ? "text-faint" : "text-bone"}`}>+</Text>
      </Pressable>
    </View>
  );
}
