import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { printedMap, type CatalogRow } from "../../../campaign/cards";
import { cards } from "../../../catalog/schema";
import { inArray } from "drizzle-orm";
import { BodyText, NavBar, PrimaryButton, Screen, TextButton } from "../../chrome";
import { campaignOf, scenarioNames } from "../../campaign-data";
import { useDatabases } from "../../databases";
import { palette } from "../../palette.js";
import { routeCode } from "../../route-code";
import { useSave } from "../../use-save";

function Row({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View className="border-b border-inkLine py-3">
      <Text className="text-label text-inkLabel">{label}</Text>
      <Text testID={testID} className="mt-0.5 text-body text-ink">
        {value}
      </Text>
    </View>
  );
}

export default function Log() {
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string }>();
  const saveId = routeCode(params.saveId);
  const { catalog } = useDatabases();
  const { save, loaded, update } = useSave(saveId ?? undefined);
  // The text being typed; null until the player types, so the saved notes show.
  const [edited, setEdited] = useState<string | null>(null);

  const rows = useMemo<CatalogRow[]>(() => {
    if (!save) return [];
    const codes = new Set<string>();
    for (const code of save.log.heroesBySeat.flat()) codes.add(code);
    for (const code of save.log.fallenHeroesBySeat.flat()) codes.add(code);
    for (const card of save.log.campaignPool) {
      codes.add(card.code);
      if (card.attachedTo) codes.add(card.attachedTo);
    }
    for (const captive of save.log.captives) codes.add(captive.hero);
    if (codes.size === 0) return [];
    return catalog.select().from(cards).where(inArray(cards.code, [...codes])).all();
  }, [catalog, save]);

  const printed = useMemo(() => printedMap(rows), [rows]);
  const nameOf = (code: string) => rows.find((row) => row.code === code)?.name ?? code;

  const back = <NavBar onBack={() => router.back()} backTestID="log-back" right={<TextButton label="Booklet" testID="booklet-open" tone="gold" onPress={() => router.push({ pathname: "/booklet/[id]", params: { id: save?.campaignId ?? "fellowship-of-the-ring" } })} />} />;
  if (!loaded) return <Screen testID="log" scene="plain">{back}<BodyText tone="muted">Loading</BodyText></Screen>;
  const campaign = save ? campaignOf(save.campaignId) : null;
  if (!save || !campaign) {
    return (
      <Screen testID="log" scene="plain">
        {back}
        <BodyText tone="danger">That playthrough is not on this phone.</BodyText>
      </Screen>
    );
  }

  const { log } = save;
  const seats = Array.from({ length: save.seatCount }, (_, index) => index);
  const bySeat = (lists: readonly (readonly string[])[]) => (lists.every((list) => list.length === 0) ? "None" : seats.map((seat) => `${save.seatCount > 1 ? `Seat ${seat + 1}: ` : ""}${(lists[seat] ?? []).map(nameOf).join(", ") || "None"}`).join("\n"));
  const pool = (kind: "boon" | "burden") => {
    const picked = log.campaignPool.filter((card) => printed.get(card.code)?.campaignKind === kind);
    return picked.length === 0 ? "None" : picked.map((card) => (card.attachedTo ? `${nameOf(card.code)} on ${nameOf(card.attachedTo)}` : nameOf(card.code))).join("\n");
  };
  const names = scenarioNames(campaign);
  const notes = edited ?? log.notes;
  const changed = edited !== null && edited !== log.notes;

  return (
    <Screen testID="log" scene="plain">
      {back}
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-4" keyboardShouldPersistTaps="handled">
        <View className="mt-3 rounded-card bg-paper px-5 py-4">
          <Text accessibilityRole="header" className="font-display text-title text-ink">
            Campaign Log
          </Text>
          <Row label="Heroes" value={bySeat(log.heroesBySeat)} testID="log-heroes" />
          <Row label="Fallen Heroes" value={bySeat(log.fallenHeroesBySeat)} testID="log-fallen" />
          <Row label="Threat Modifiers" value={log.threatPenalty === 0 ? "None" : `+${log.threatPenalty}`} testID="log-threat" />
          <Row label="Boons" value={pool("boon")} testID="log-boons" />
          <Row label="Burdens" value={pool("burden")} testID="log-burdens" />
          <Row
            label="Captives"
            value={log.captives.length === 0 ? "None" : log.captives.map((captive) => `${nameOf(captive.hero)}${save.seatCount > 1 ? ` (seat ${captive.seat + 1})` : ""}`).join("\n")}
            testID="log-captives"
          />
          <View className="border-b border-inkLine py-3">
            <Text className="text-label text-inkLabel">Scenarios Completed</Text>
            {campaign.scenarios.map((id) => {
              const score = log.scenarios[id];
              return (
                <View key={id} testID={`log-scenario-${id}`} className="mt-1 flex-row items-baseline justify-between">
                  <Text className={score ? "flex-1 text-body text-ink" : "flex-1 text-body text-inkMuted"}>{names[id] ?? id}</Text>
                  <Text className="text-label text-inkMuted">{score ? `${score.rounds} rounds · ${score.score}` : "Not completed"}</Text>
                </View>
              );
            })}
          </View>
          <Row label="Campaign Total" value={String(log.score)} testID="log-score" />
          <View className="py-3">
            <Text className="text-label text-inkLabel">Notes</Text>
            <TextInput
              testID="log-notes"
              multiline
              value={notes}
              onChangeText={setEdited}
              placeholder="Write a note"
              placeholderTextColor={palette.inkMuted}
              className="mt-1 min-h-24 font-display text-body text-ink"
              textAlignVertical="top"
            />
          </View>
        </View>
        {changed ? (
          <View className="mt-4">
            <PrimaryButton
              label="Save notes"
              testID="log-save-notes"
              onPress={() => {
                update({ ...save, log: { ...log, notes } });
                setEdited(null);
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
