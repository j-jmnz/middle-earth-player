import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { CardDetailPane } from "../../pool/card-detail";
import { CardPool, CardPoolBody } from "../../pool/card-pool";
import { BodyText, HubHeader, PillButton, Screen } from "../../kit/chrome";
import { useListPreview } from "../../pool/list-preview";
import { ToastView } from "../../kit/toast-view";
import { useSizeClass } from "../../../ui/use-size-class";

// The detail pane beside the pool on a tablet in landscape.
const DETAIL = 360;

// Every deck-legal player card, searched and filtered. The Collection, and through it the packs with their encounter cards, is one tap away. On a tablet in landscape
// the pool fills the left and a tap fills the card's detail in a pane on the right, with the picked card ringed in the grid; elsewhere a
// tap opens the card screen (docs/design-system.md, Card pool).
export default function Cards() {
  const router = useRouter();
  const { size, s } = useSizeClass();
  const [picked, setPicked] = useState<string | null>(null);
  const preview = useListPreview();
  const header = (
    <HubHeader title="Cards">
      <PillButton label="Collection" testID="collection-open" accessibilityHint="Choose the cycles you own, or browse the cards by pack" onPress={() => router.push("/collection")} />
    </HubHeader>
  );
  if (size !== "expanded") return <CardPool adding={false} header={header} />;
  return (
    <Screen scene="calm">
      {header}
      <View className="min-h-0 flex-1 flex-row" style={{ gap: 28 * s }}>
        <View className="min-w-0 flex-1">
          <CardPoolBody adding={false} onPreview={preview.open} onOpen={setPicked} selected={picked} />
        </View>
        <View style={{ width: DETAIL * s }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12 * s, paddingBottom: 32 * s }}>
            {picked ? (
              <CardDetailPane code={picked} width={DETAIL * s} />
            ) : (
              <BodyText tone="muted" className="mt-6 text-center">
                Tap a card to read it here.
              </BodyText>
            )}
          </ScrollView>
        </View>
      </View>
      <ToastView />
      {preview.overlay}
    </Screen>
  );
}
