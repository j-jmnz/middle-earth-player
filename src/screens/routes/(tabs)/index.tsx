import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { campaignPath } from "../../../campaign/path";
import type { Save } from "../../../campaign/save";
import { FELLOWSHIP_ID } from "../../../campaign/save";
import { BodyText, Eyebrow, Label, Panel, PrimaryButton, RingMark, Screen, ScreenTitle, TextButton } from "../../chrome";
import { campaignListQueries } from "../../campaign-list";
import { campaignOf } from "../../campaign-data";
import { createSave, listSaves } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { palette } from "../../palette.js";

type Seats = 1 | 2;

function SeatTile({ seats, selected, onPress }: { seats: Seats; selected: boolean; onPress: () => void }) {
  const label = seats === 1 ? "True solo" : "Two-handed";
  return (
    <Pressable
      testID={`seats-${seats}`}
      collapsable={false}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-14 flex-1 items-center justify-center gap-2 rounded-tile bg-raised px-3 py-3"
      style={{ borderWidth: selected ? 1.5 : 1, borderColor: selected ? palette.gold : palette.hairline }}
    >
      <View className="flex-row">
        <RingMark size={18} state={selected ? "current" : "locked"} />
        {seats === 2 ? (
          <View style={{ marginLeft: -6 }}>
            <RingMark size={18} state={selected ? "current" : "locked"} />
          </View>
        ) : null}
      </View>
      <Text className={selected ? "text-body font-semibold text-bone" : "text-body text-muted"}>{label}</Text>
    </Pressable>
  );
}

function ProgressLine({ done, total }: { done: number; total: number }) {
  return (
    <View className="mt-3 flex-row items-center gap-2">
      {Array.from({ length: total }, (_, index) => (
        <RingMark key={index} size={12} state={index < done ? "done" : index === done ? "current" : "locked"} />
      ))}
    </View>
  );
}

export default function CampaignList() {
  const router = useRouter();
  const { catalog, user } = useDatabases();
  const [saves, setSaves] = useState<Save[]>([]);
  const [starting, setStarting] = useState(false);
  const [seats, setSeats] = useState<Seats>(1);
  const campaigns = campaignListQueries(catalog, user).campaigns.all();
  const nameOf = (id: string) => campaigns.find((campaign) => campaign.id === id)?.name ?? id;

  useFocusEffect(
    useCallback(() => {
      setSaves(listSaves(user));
    }, [user]),
  );

  function openBooklet(id: string): void {
    router.push({ pathname: "/booklet/[id]", params: { id } });
  }

  function start(): void {
    const save = createSave(user, FELLOWSHIP_ID, seats);
    setSaves(listSaves(user));
    setStarting(false);
    router.push({ pathname: "/path/[saveId]", params: { saveId: save.id } });
  }

  const showStart = saves.length === 0 || starting;
  const fellowship = campaignOf(FELLOWSHIP_ID);

  return (
    <Screen testID="campaign-list" scene="dusk">
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-6">
        <View className="-mx-2 flex-row items-center justify-end">
          <TextButton label="Learn to Play" testID="booklet-open-learn-to-play" tone="gold" onPress={() => openBooklet("learn-to-play")} />
          <TextButton label="Fellowship booklet" testID="booklet-open" tone="gold" onPress={() => openBooklet(FELLOWSHIP_ID)} />
        </View>
        <ScreenTitle>Campaigns</ScreenTitle>
        {/* The scene's light sits above the cards. */}
        <View className="mt-40 gap-3">
          {saves.map((save, index) => {
            const done = fellowship ? campaignPath(fellowship, {}, save.log).filter((node) => node.status === "completed").length : 0;
            return (
              <Pressable
                key={save.id}
                testID={`save-${save.id}`}
                collapsable={false}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/path/[saveId]", params: { saveId: save.id } })}
              >
                {({ pressed }) => (
                  <Panel current={index === 0} pressed={pressed}>
                    {saves.length > 1 && index === 0 ? <Eyebrow>Current</Eyebrow> : null}
                    <Text className="mt-1 font-display text-title text-bone">{nameOf(save.campaignId)}</Text>
                    <Label>{save.seatCount === 1 ? "True solo" : "Two-handed"}</Label>
                    <ProgressLine done={done} total={fellowship?.scenarios.length ?? 6} />
                  </Panel>
                )}
              </Pressable>
            );
          })}
          {saves.length === 0 ? <BodyText tone="muted">No playthrough exists</BodyText> : null}
          {showStart ? (
            <Panel>
              <Text className="font-display text-title text-bone">{nameOf(FELLOWSHIP_ID)}</Text>
              <View className="mt-4 flex-row gap-3">
                <SeatTile seats={1} selected={seats === 1} onPress={() => setSeats(1)} />
                <SeatTile seats={2} selected={seats === 2} onPress={() => setSeats(2)} />
              </View>
              <View className="mt-4 gap-3">
                <Label>Chosen once for this campaign</Label>
                <PrimaryButton label="Start Fellowship" testID="start-fellowship" onPress={start} />
              </View>
            </Panel>
          ) : (
            <View className="items-start">
              <TextButton label="New playthrough" testID="new-playthrough" tone="gold" onPress={() => setStarting(true)} />
            </View>
          )}
        </View>
      </ScrollView>
      <View className="items-start pb-safe">
        <TextButton label="Debug" testID="debug" tone="gold" onPress={() => router.push("/debug")} />
      </View>
    </Screen>
  );
}
