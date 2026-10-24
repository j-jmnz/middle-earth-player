import { bookletPdfAvailable } from "booklet-pdf";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { BodyText, PrimaryButton, RingMark, Screen, TextButton } from "../../chrome";
import { bookletName, isBookletId, startPage } from "../../booklets/books";
import { BookletPdf } from "../../booklets/reader-view";
import { bookletUri, importBooklet } from "../../booklets/store";
import { readBooklet, writeLastPage, type BookletRow } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { palette } from "../../palette.js";
import { routeCode } from "../../route-code";

// Full-screen reader for one stored PDF. It opens from the campaign list, the path, the briefing and the log, and Close
// returns to the screen that opened it. The engine never reads the file, and a missing file blocks nothing.
function CloseBar({ onClose }: { onClose: () => void }) {
  return (
    <View className="items-center pb-safe pt-1">
      <TextButton label="Close" testID="booklet-close" onPress={onClose} />
    </View>
  );
}

export default function Booklet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; page?: string }>();
  const id = routeCode(params.id);
  const { user } = useDatabases();
  const [row, setRow] = useState<BookletRow | null>(() => (id ? readBooklet(user, id) : null));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  if (!id || !isBookletId(id)) {
    return (
      <Screen testID="booklet" scene="plain">
        <View className="flex-1 justify-center gap-3">
          <BodyText tone="danger">That booklet is not one this app knows.</BodyText>
        </View>
        <CloseBar onClose={close} />
      </Screen>
    );
  }

  const scenarioPage = Number(routeCode(params.page));
  const uri = row ? bookletUri(row) : null;

  if (row && uri && BookletPdf) {
    const first = startPage(Number.isFinite(scenarioPage) && scenarioPage >= 1 ? scenarioPage : null, row.lastPage, row.pageCount);
    return (
      <Screen testID="booklet" scene="plain" inset={false}>
        <View testID="booklet-reader" className="min-h-0 flex-1" collapsable={false}>
          <BookletPdf
            testID="booklet-pdf"
            uri={uri}
            page={first}
            style={{ flex: 1 }}
            onPageChange={(event) => {
              writeLastPage(user, id, event.nativeEvent.page);
            }}
          />
        </View>
        <CloseBar onClose={close} />
      </Screen>
    );
  }

  const missing = row && uri ? "This build cannot show PDFs." : "This booklet is not on this phone. Scenarios still play without it.";

  async function add(): Promise<void> {
    if (!id || busy) return;
    setBusy(true);
    setMessage(null);
    const result = await importBooklet(user, id);
    setBusy(false);
    if (result.ok) setRow(result.row);
    else if (result.reason !== "cancelled") setMessage(result.message);
  }

  return (
    <Screen testID="booklet" scene="plain">
      <View testID="booklet-empty" className="flex-1 items-center justify-center gap-4 px-2">
        <View className="h-32 w-24 items-center justify-center rounded-tile" style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: palette.gold }}>
          <RingMark size={28} state="current" />
        </View>
        <Text accessibilityRole="header" testID="booklet-name" className="text-center font-display text-title text-bone">
          {bookletName(id)}
        </Text>
        <BodyText tone="muted" className="text-center">
          {missing}
        </BodyText>
        {message ? (
          <BodyText tone="danger" testID="booklet-error" className="text-center">
            {message}
          </BodyText>
        ) : null}
        <PrimaryButton label={busy ? "Adding" : "Add booklet"} testID="booklet-add" disabled={busy || !bookletPdfAvailable()} onPress={() => void add()} />
      </View>
      <CloseBar onClose={close} />
    </Screen>
  );
}
