// What the briefing's card rows and the campaign setup's share (scenario-cards.tsx, campaign-cards.tsx): a card's name and picture read once from the
// catalog for its row, and the in-place spoiler question that stands before cards which show what a scenario or a campaign holds.
import { eq } from "drizzle-orm";
import { useMemo } from "react";
import { View } from "react-native";

import { cards } from "../../catalog/schema";
import { Text } from "../../ui/text";
import { TextButton } from "../kit/chrome";
import { useDatabases } from "../data/databases";

/** The name and picture a row shows for this card, or null while it has none (no code, or a code the catalog lacks). */
export function useCardFacts(code: string | undefined): { name: string; imagesrc: string | null } | null {
  const { catalog } = useDatabases();
  return useMemo(() => (code ? (catalog.select({ name: cards.name, imagesrc: cards.imagesrc }).from(cards).where(eq(cards.code, code)).get() ?? null) : null), [catalog, code]);
}

/** The ask under a row that shows spoilers: `<testID>` is the block, `<testID>-show` and `<testID>-cancel` its two buttons. */
export function SpoilerAsk({ testID, text, showLabel, onShow, onCancel }: { testID: string; text: string; showLabel: string; onShow: () => void; onCancel: () => void }) {
  return (
    <View testID={testID} className="mt-2 gap-1">
      <Text className="text-label text-danger">{text}</Text>
      <View className="flex-row gap-4">
        <TextButton label={showLabel} testID={`${testID}-show`} tone="accent" onPress={onShow} />
        <TextButton label="Not now" testID={`${testID}-cancel`} onPress={onCancel} />
      </View>
    </View>
  );
}
