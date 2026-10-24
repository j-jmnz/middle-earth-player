import { count, eq, inArray } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useState, useSyncExternalStore } from "react";
import { ScrollView, View } from "react-native";

import { CATALOG_VERSION } from "../../catalog/version";
import { cards, campaigns, packs } from "../../catalog/schema";
import campaignJson from "../../../data/campaigns/fellowship-of-the-ring.json";
import shadowScenarioJson from "../../../data/scenarios/a-shadow-of-the-past.json";
import { campaignDataSchema, parseScenarioData, scenarioCards } from "../../catalog/scenario-data";
import { BackButton, BodyText, ListRow, Screen, ScreenTitle, TextButton } from "../chrome";
import {
  DEBUG_CAMPAIGN_ID,
  DEBUG_HERO_CODE,
  DEBUG_SAMPLE_CODES,
  debugSentences,
  type DebugImageSample,
} from "../debug-checks";
import { useDatabases } from "../databases";
import { enqueueImageDownloads, imageQueueStatus, readImageQueueStatus, subscribeImageQueue } from "../images/queue";
import { isRemoteImageUri, ringsdbImageUrl, type ImageDownloadRequest, type ImageQueueStatus } from "../images/policy";
import { RowCardImage } from "../images/picture";
import { scanAssets } from "../images/scan-map";
import { useImageSnapshot } from "../images/store";
import type { AppDatabases } from "../open-databases";
import { decks, imageFiles, meta, saves } from "../user-schema";

const shadowScenario = parseScenarioData(shadowScenarioJson);
const fellowshipCampaign = campaignDataSchema.parse(campaignJson);

type DebugView = {
  sentences: readonly string[];
  pictures: Readonly<Record<string, string | null>>;
  pack: { code: string; name: string } | null;
  jobs: ImageDownloadRequest[];
};

function sampleCodeFor(sentence: string): (typeof DEBUG_SAMPLE_CODES)[number] | null {
  for (const code of DEBUG_SAMPLE_CODES) {
    if (
      sentence.startsWith(`${code} has no imagesrc.`) ||
      sentence.startsWith(`${code} is not cached.`) ||
      sentence.startsWith(`${code} is a `)
    ) {
      return code;
    }
  }
  return null;
}

function tableCount(query: { get(): { value: unknown } | undefined }): number {
  return Number(query.get()?.value ?? 0);
}

function usableImagesrc(imagesrc: string | null | undefined): string | null {
  if (imagesrc == null) return null;
  const trimmed = imagesrc.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function readDebugView(
  catalog: AppDatabases["catalog"],
  user: AppDatabases["user"],
  snapshotCount: number,
  queue: ImageQueueStatus,
): DebugView {
  const packCount = tableCount(catalog.select({ value: count() }).from(packs));
  const cardCount = tableCount(catalog.select({ value: count() }).from(cards));
  const deckCount = tableCount(user.select({ value: count() }).from(decks));
  const saveCount = tableCount(user.select({ value: count() }).from(saves));
  const imageFileCount = tableCount(user.select({ value: count() }).from(imageFiles));
  const fellowship =
    catalog
      .select({ id: campaigns.id, name: campaigns.name })
      .from(campaigns)
      .where(eq(campaigns.id, DEBUG_CAMPAIGN_ID))
      .get() ?? null;
  const applied =
    user.select({ appliedCatalogVersion: meta.appliedCatalogVersion }).from(meta).get()?.appliedCatalogVersion ?? null;
  const sampleCards = catalog
    .select({
      code: cards.code,
      deckLegal: cards.deckLegal,
      imagesrc: cards.imagesrc,
      packCode: cards.packCode,
    })
    .from(cards)
    .where(inArray(cards.code, [...DEBUG_SAMPLE_CODES]))
    .all();
  const hero = sampleCards.find((card) => card.code === DEBUG_HERO_CODE);
  const fixtureCodes = [...new Set(scenarioCards(shadowScenario).map((card) => card.code))];
  const presentCardCodes =
    fixtureCodes.length === 0
      ? []
      : catalog
          .select({ code: cards.code })
          .from(cards)
          .where(inArray(cards.code, fixtureCodes))
          .all()
          .map((card) => card.code);
  const storedImages = user
    .select({
      code: imageFiles.code,
      path: imageFiles.path,
      width: imageFiles.width,
      height: imageFiles.height,
      mediaType: imageFiles.mediaType,
    })
    .from(imageFiles)
    .where(inArray(imageFiles.code, [...DEBUG_SAMPLE_CODES]))
    .all();
  const pictures: Record<string, string | null> = {};
  const samples: DebugImageSample[] = DEBUG_SAMPLE_CODES.map((code) => {
    const card = sampleCards.find((row) => row.code === code);
    const file = storedImages.find((row) => row.code === code);
    const stored =
      file?.path &&
      !isRemoteImageUri(file.path) &&
      file.width != null &&
      file.height != null &&
      file.mediaType != null &&
      file.mediaType.trim() !== ""
        ? { uri: file.path, width: file.width, height: file.height, mediaType: file.mediaType }
        : null;
    const remote = usableImagesrc(card?.imagesrc);
    pictures[code] = stored?.uri ?? (remote ? ringsdbImageUrl(remote) : null);
    return {
      code,
      imagesrc: usableImagesrc(card?.imagesrc),
      width: stored?.width ?? null,
      height: stored?.height ?? null,
      mediaType: stored?.mediaType ?? null,
    };
  });
  const packCode = hero?.packCode ?? null;
  const packRow = packCode
    ? catalog.select({ code: packs.code, name: packs.name }).from(packs).where(eq(packs.code, packCode)).get()
    : undefined;
  const jobs = samples.flatMap((sample) =>
    sample.imagesrc ? [{ code: sample.code, imagesrc: sample.imagesrc, first: true }] : [],
  );
  return {
    sentences: debugSentences({
      bundledVersion: CATALOG_VERSION,
      appliedVersion: applied,
      packCount,
      cardCount,
      fellowship,
      deckCount,
      saveCount,
      hero: {
        present: hero != null,
        deckLegal: hero?.deckLegal ?? false,
        imagesrc: usableImagesrc(hero?.imagesrc),
      },
      scenario: shadowScenario,
      campaign: fellowshipCampaign,
      presentCardCodes,
      imageFileCount,
      snapshotCount,
      pauseEntryCount: queue.pauseEntries,
      samples,
      scansPacked: Object.keys(scanAssets).length > 0,
      queue,
    }),
    pictures,
    pack: packCode ? { code: packCode, name: packRow?.name ?? packCode } : null,
    jobs,
  };
}

export default function DebugScreen() {
  const router = useRouter();
  const { catalog, user } = useDatabases();
  const snapshot = useImageSnapshot();
  const queue = useSyncExternalStore(subscribeImageQueue, imageQueueStatus, imageQueueStatus);
  const [, setRefreshTick] = useState(0);
  const view = readDebugView(catalog, user, snapshot.count, queue);

  return (
    <Screen testID="debug-screen">
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-4">
        <ScreenTitle>Debug</ScreenTitle>
        {view.sentences.map((sentence, index) => {
          const code = sampleCodeFor(sentence);
          const uri = code ? view.pictures[code] : null;
          if (code && uri) {
            return (
              <View key={`${index}-${sentence}`} className="mt-4 flex-row items-center">
                <View style={{ width: 32, height: 44 }}>
                  <RowCardImage code={code} source={{ uri }} />
                </View>
                <View className="ml-3 flex-1">
                  <BodyText>{sentence}</BodyText>
                </View>
              </View>
            );
          }
          return (
            <BodyText key={`${index}-${sentence}`} className="mt-4">
              {sentence}
            </BodyText>
          );
        })}
        <View className="mt-6">
          <ListRow
            testID="debug-card"
            label={DEBUG_HERO_CODE}
            leading={
              view.pictures[DEBUG_HERO_CODE] ? (
                <View style={{ width: 32, height: 44 }}>
                  <RowCardImage code={DEBUG_HERO_CODE} source={{ uri: view.pictures[DEBUG_HERO_CODE] }} />
                </View>
              ) : undefined
            }
            onPress={() => {
              router.push({ pathname: "/card/[code]", params: { code: DEBUG_HERO_CODE } });
            }}
          />
          {view.pack ? (
            <ListRow
              testID="debug-pack"
              label={view.pack.name}
              onPress={() => {
                const packCode = view.pack?.code;
                if (!packCode) return;
                router.push({ pathname: "/pack/[code]", params: { code: packCode } });
              }}
            />
          ) : null}
        </View>
      </ScrollView>
      <TextButton
        label="Fetch sample"
        testID="fetch-sample"
        onPress={() => {
          enqueueImageDownloads(view.jobs);
        }}
      />
      <TextButton
        label="Refresh"
        testID="refresh"
        onPress={() => {
          readImageQueueStatus();
          setRefreshTick((value) => value + 1);
        }}
      />
      <BackButton testID="back" onPress={() => router.back()} />
    </Screen>
  );
}
