import { Pressable, View } from "react-native";

import { copyCapRule } from "../catalog/deck-save";
import { usePalette } from "./palette-hook";
import { dropShadowOf } from "../ui/surfaces";
import { withAlphaHex } from "../ui/tokens";
import { useTableTokens } from "../ui/use-table-tokens";
import { Text } from "../ui/text";

/** Whether one more copy would break the copy limit (rr.deckbuilding). */
export function stepperFull(count: number, deckLimit: number | null): boolean {
  return copyCapRule(count + 1, deckLimit) !== null;
}

/**
 * − count + for one card in a deck, on the deck editor and the card pool. + on a card that cannot take another copy looks
 * spent and, tapped, says why. The count is accent while the deck holds the card.
 */
export function CountStepper({
  code,
  name,
  count,
  full,
  onChange,
  minus = true,
  ids: given,
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
  const ids = given ?? { dec: `count-dec-${code}`, count: `count-${code}`, inc: `count-inc-${code}` };
  const palette = usePalette();
  const t = useTableTokens();
  return (
    <View className="flex-row items-center rounded-control" style={{ backgroundColor: withAlphaHex(palette.night, 0.92), boxShadow: dropShadowOf(t, 6, 14, 0.85) }}>
      {minus ? (
        <Pressable
          testID={ids.dec}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={count <= 1 ? `Remove ${name}` : `Remove a copy of ${name}`}
          onPress={() => onChange(-1)}
        >
          {/* The pressed fill is on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
          {({ pressed }) => (
            <View className="min-h-touch min-w-touch items-center justify-center rounded-control" style={pressed ? { backgroundColor: t.pressed } : undefined}>
              <Text className="text-title text-muted">−</Text>
            </View>
          )}
        </Pressable>
      ) : null}
      {count > 0 || minus ? (
        <Text
          testID={ids.count}
          accessibilityLabel={`${count} in the deck`}
          className={`min-w-6 text-center font-display text-body ${count > 0 ? "text-accentHigh" : "text-faint"}`}
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
      >
        {({ pressed }) => (
          <View className="min-h-touch min-w-touch items-center justify-center rounded-control" style={pressed ? { backgroundColor: t.pressed } : undefined}>
            <Text className={`text-title ${full ? "text-faint" : "text-bone"}`}>+</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}
