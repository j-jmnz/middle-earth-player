import { FlashList } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { cards, packs } from "../../../catalog/schema";
import { BodyText, ListRow, NavBar, Screen, ScreenTitle } from "../../chrome";
import { useDatabases } from "../../databases";
import { enqueueImageDownloads } from "../../images/queue";
import { ringsdbImageUrl, shownCardImage } from "../../images/policy";
import { RowCardImage } from "../../images/picture";
import { routeCode } from "../../route-code";
import { scanAssets } from "../../images/scan-map";
import { useCachedImage } from "../../images/store";
import { goBack } from "../../go-back";
import { useListPreview } from "../../list-preview";
import type { PictureSource } from "../../../play/table-canvas-types";

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
  const cached = useCachedImage(item.code);
  const { source } = shownCardImage({
    cached,
    imagesrc: item.imagesrc,
    bundled: scanAssets[item.code] ?? null,
  });
  const remote = !source && item.imagesrc ? ringsdbImageUrl(item.imagesrc) : null;
  const preview = source ?? (remote ? { uri: remote } : null);
  return (
    <ListRow
      testID={`card-${item.code}`}
      label={item.name}
      detail={item.code}
      leading={
        <View className="overflow-hidden rounded bg-raised" style={{ width: 32, height: 44 }}>
          {preview ? <RowCardImage code={item.code} source={preview} /> : null}
        </View>
      }
      onPress={onPress}
      onLongPress={() => onPreview(item.code, item.name, preview)}
    />
  );
}

export default function PackCards() {
  const router = useRouter();
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
      <View className="pt-2">
        <ScreenTitle>{pack?.name ?? "Pack"}</ScreenTitle>
      </View>
      {!pack ? (
        <BodyText className="mt-6">{`Pack ${code} is not in the catalog.`}</BodyText>
      ) : rows.length === 0 ? (
        <BodyText tone="muted" className="mt-6">
          This pack has no cards.
        </BodyText>
      ) : (
        <View className="mt-4 flex-1">
          <FlashList
            data={rows}
            keyExtractor={(item) => item.code}
            style={{ flex: 1 }}
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
