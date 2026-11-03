import { FlashList } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { cards, packs } from "../../../catalog/schema";
import { BodyText, Column, ListRow, NavBar, Screen, ScreenTitle } from "../../kit/chrome";
import { useListGutter } from "../../nav/list-gutter";
import { useDatabases } from "../../data/databases";
import { enqueueImageDownloads } from "../../images/queue";
import { cardImageUrl, shownCardImage } from "../../images/policy";
import { cardCorner } from "../../../ui/card-corner";
import { RowCardImage } from "../../images/picture";
import { routeCode } from "../../nav/route-code";
import { scanAssets } from "../../images/scan-map";
import { useCachedImage } from "../../images/store";
import { goBack } from "../../nav/go-back";
import { useListPreview } from "../../pool/list-preview";
import type { PictureSource } from "../../../play/canvas/table-canvas-types";
import { useUiScale } from "../../../ui/ui-scale";

type PackCard = {
  code: string;
  name: string;
  imagesrc: string | null;
};

const viewabilityConfig = { itemVisiblePercentThreshold: 10 };

function onViewableItemsChanged({ viewableItems }: { viewableItems: { item: PackCard | null }[] }) {
  const jobs = [];
  for (const token of viewableItems) {
    const item = token.item;
    if (!item?.imagesrc) continue;
    jobs.push({ code: item.code, imagesrc: item.imagesrc });
  }
  if (jobs.length > 0) enqueueImageDownloads(jobs);
}

function PackCardRow({ item, onPress, onPreview }: { item: PackCard; onPress: () => void; onPreview: (code: string, name: string, source: PictureSource | null) => void }) {
  const s = useUiScale();
  const cached = useCachedImage(item.code);
  const { source } = shownCardImage({
    cached,
    imagesrc: item.imagesrc,
    bundled: scanAssets[item.code] ?? null,
  });
  const remote = !source && item.imagesrc ? cardImageUrl(item.imagesrc) : null;
  const preview = source ?? (remote ? { uri: remote } : null);
  return (
    <ListRow
      testID={`card-${item.code}`}
      label={item.name}
      detail={item.code}
      leading={
        <View className="overflow-hidden bg-raised" style={{ width: 32 * s, height: 44 * s, borderRadius: cardCorner(32 * s, 44 * s) }}>
          {preview ? <RowCardImage code={item.code} source={preview} width={32 * s} height={44 * s} /> : null}
        </View>
      }
      onPress={onPress}
      onLongPress={() => onPreview(item.code, item.name, preview)}
    />
  );
}

export default function PackCards() {
  const router = useRouter();
  const list = useListGutter();
  const params = useLocalSearchParams<{ code: string }>();
  const code = routeCode(params.code);
  const { catalog } = useDatabases();
  const preview = useListPreview();
  const pack = useMemo(() => {
    if (!code) return undefined;
    return catalog
      .select({ code: packs.code, name: packs.name })
      .from(packs)
      .where(eq(packs.code, code))
      .get();
  }, [catalog, code]);
  const rows = useMemo(() => {
    if (!code) return [];
    return catalog
      .select({ code: cards.code, name: cards.name, imagesrc: cards.imagesrc })
      .from(cards)
      .where(eq(cards.packCode, code))
      .orderBy(cards.position)
      .all();
  }, [catalog, code]);

  if (!code) throw new Error("Missing route code");

  return (
    <Screen>
      <NavBar backTestID="pack-back" backLabel="Packs" onBack={() => goBack(router, "/packs")} />
      <Column>
        <View className="pt-2">
          <ScreenTitle size="title">{pack?.name ?? "Pack"}</ScreenTitle>
        </View>
      </Column>
      {!pack ? (
        <Column>
          <BodyText className="mt-6">{`Pack ${code} is not in the catalog.`}</BodyText>
        </Column>
      ) : rows.length === 0 ? (
        <Column>
          <BodyText tone="muted" className="mt-6">
            This pack has no cards.
          </BodyText>
        </Column>
      ) : (
        <View className="mt-4 flex-1" onLayout={list.onLayout}>
          <FlashList
            data={rows}
            keyExtractor={(item) => item.code}
            style={{ flex: 1 }}
            contentContainerStyle={list.contentContainerStyle}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            ListFooterComponent={<View className="pb-safe" />}
            renderItem={({ item }) => (
              <PackCardRow
                item={item}
                onPress={() => {
                  router.push({ pathname: "/card/[code]", params: { code: item.code } });
                }}
                onPreview={preview.open}
              />
            )}
          />
        </View>
      )}
      {preview.overlay}
    </Screen>
  );
}
