import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { printedMap, type CatalogRow } from "../../../campaign/cards";
import { cards } from "../../../catalog/schema";
import { inArray } from "drizzle-orm";
import { BodyText, Column, Eyebrow, IconButton, NavBar, PrimaryButton, Screen } from "../../chrome";
import { bookletParams, campaignOf, scenarioNames } from "../../campaign-data";
import { carryWords } from "../../carry-words";
import { poolCardWords, usedOnceWords } from "../../log-facts";
import { useDatabases } from "../../databases";
import { goBack } from "../../go-back";
import { usePalette } from "../../palette-hook";
import { routeCode } from "../../route-code";
import { useSave } from "../../use-save";
import { GameIcon } from "../../../play/game-icon";
import type { IconName } from "../../../play/icon-map";
import { parchmentSurface } from "../../../play/surfaces";
import { withAlphaHex } from "../../../play/tokens";
import { useTableTokens } from "../../../play/use-table-tokens";
import { useUiScale } from "../../../play/ui-scale";
import { useSizeClass } from "../../../play/use-size-class";
import { seatWord } from "../../seats";
import { Text, TextInput } from "../../../play/text";

// A rule between the log's rows: a faint line of the ink, as on the printed sheet.
const RULE = 0.28;

function Row({ label, value, testID, icon }: { label: string; value: string; testID: string; icon?: IconName }) {
  const s = useUiScale();
  const palette = usePalette();
  return (
    <View className="py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: withAlphaHex(palette.inkLine, RULE) }}>
      <View className="flex-row items-center gap-1">
        {icon ? <GameIcon name={icon} size={12 * s} tint="inkLabel" /> : null}
        <Text className="font-bold text-eyebrow uppercase text-inkLabel">{label}</Text>
      </View>
      <Text testID={testID} className="mt-0.5 text-body text-ink">
        {value}
      </Text>
    </View>
  );
}

export default function Log() {
  const palette = usePalette();
  const t = useTableTokens();
  const { size, s } = useSizeClass();
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
    if (save.log.prisoner) codes.add(save.log.prisoner);
    for (const card of save.log.carryOver) codes.add(card.code);
    for (const code of save.log.usedOnce) codes.add(code);
    if (codes.size === 0) return [];
    return catalog.select().from(cards).where(inArray(cards.code, [...codes])).all();
  }, [catalog, save]);

  const printed = useMemo(() => printedMap(rows), [rows]);
  const nameOf = (code: string) => rows.find((row) => row.code === code)?.name ?? code;

  const changed = save !== null && edited !== null && edited !== save.log.notes;
  // Typed notes are written when the field loses focus and when the player goes back, never dropped silently.
  function saveNotes(): void {
    if (!save || edited === null || edited === save.log.notes) return;
    update({ ...save, log: { ...save.log, notes: edited } });
    setEdited(null);
  }
  const back = <NavBar onBack={() => { saveNotes(); goBack(router, save ? { pathname: "/path/[saveId]", params: { saveId: save.id } } : "/"); }} backTestID="log-back" backLabel="Path" right={save ? <IconButton icon="lore" label="Open the booklet" testID="booklet-open" onPress={() => router.push({ pathname: "/booklet/[id]", params: bookletParams(save.campaignId) })} /> : undefined} />;
  if (!loaded) return <Screen testID="log" scene="ember">{back}<BodyText tone="muted">Loading</BodyText></Screen>;
  const campaign = save ? campaignOf(save.campaignId) : null;
  if (!save || !campaign) {
    return (
      <Screen testID="log" scene="ember">
        {back}
        <BodyText tone="danger">That playthrough is not on this phone.</BodyText>
      </Screen>
    );
  }

  const { log } = save;
  const seats = Array.from({ length: save.seatCount }, (_, index) => index);
  const bySeat = (lists: readonly (readonly string[])[]) => (lists.every((list) => list.length === 0) ? "None" : seats.map((seat) => `${save.seatCount > 1 ? `Player ${seat + 1}: ` : ""}${(lists[seat] ?? []).map(nameOf).join(", ") || "None"}`).join("\n"));
  const pool = (kind: "boon" | "burden") => {
    const picked = log.campaignPool.filter((card) => printed.get(card.code)?.campaignKind === kind);
    // A boon stuck to a hero names that hero, and in two-handed play the seat that took it (141044:B:1).
    const seatOf = (card: (typeof picked)[number]) => (save.seatCount > 1 && card.attachedTo && card.seat != null ? `Player ${card.seat + 1}: ` : "");
    return picked.length === 0 ? "None" : picked.map((card) => `${seatOf(card)}${poolCardWords(card, log.usedOnce, nameOf)}`).join("\n");
  };
  const names = scenarioNames(campaign);
  const notes = edited ?? log.notes;

  return (
    <Screen testID="log" scene="ember">
      {back}
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-safe" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Column>
        {/* Weathered parchment on the ember fog (docs/design-system.md, Campaign log): the same sheet on both themes. */}
        <View className="mb-6 mt-2 rounded-chip px-5 py-5" style={parchmentSurface(t)}>
          <View>
            <Eyebrow tone="inkLabel">{`${campaign.name} · ${seatWord(save.seatCount)}`}</Eyebrow>
            <Text accessibilityRole="header" className="mt-1 font-display text-ink" style={{ fontSize: (size === "compact" ? 30 : 38) * s, lineHeight: (size === "compact" ? 36 : 46) * s }}>
              Campaign Log
            </Text>
          </View>
          {/* A double rule under the title, as the printed log sheet has. */}
          <View className="mt-3 gap-0.5">
            <View className="h-px bg-inkLine" />
            <View className="h-px bg-inkLine" />
          </View>
          <Row label="Heroes" value={bySeat(log.heroesBySeat)} testID="log-heroes" />
          <Row label="Fallen Heroes" value={bySeat(log.fallenHeroesBySeat)} testID="log-fallen" />
          <Row label="Threat Modifiers" value={log.threatPenalty === 0 ? "None" : `+${log.threatPenalty}`} testID="log-threat" icon="threat" />
          <Row label="Boons" value={pool("boon")} testID="log-boons" />
          <Row label="Burdens" value={pool("burden")} testID="log-burdens" />
          <Row
            label="Captives"
            value={log.captives.length === 0 ? "None" : log.captives.map((captive) => `${nameOf(captive.hero)}${save.seatCount > 1 ? ` (Player ${captive.seat + 1})` : ""}`).join("\n")}
            testID="log-captives"
          />
          {/* The hero Journey Along the Anduin's Resolution took prisoner (01130:B:1), taken at the start of Escape from Dol Guldur; the row goes once that scenario is completed (the hero is rescued or the scenario is over). */}
          {log.prisoner && !log.completed.includes("escape-from-dol-guldur") ? <Row label="Prisoner" value={nameOf(log.prisoner)} testID="log-prisoner" /> : null}
          {/* Once-per-campaign uses ("Record in Campaign Log when used", the Adaptations of The Oath, 41044:A:3 to 41047:A:3). */}
          {log.usedOnce.length > 0 ? <Row label="Used this campaign" value={usedOnceWords(log.usedOnce, nameOf)} testID="log-used-once" /> : null}
          {/* The cards a Resolution keeps for the next campaign, not this one (Escape from Dol Guldur's Mendor, 01131:B:2). */}
          {log.carryOver.length > 0 ? <Row label="Next Campaign" value={carryWords(log.carryOver, nameOf)} testID="log-carry-over" /> : null}
          <View className="py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: withAlphaHex(palette.inkLine, RULE) }}>
            <Text className="font-bold text-eyebrow uppercase text-inkLabel">Scenarios Completed</Text>
            {campaign.scenarios.map((id) => {
              const score = log.scenarios[id];
              return (
                <View key={id} testID={`log-scenario-${id}`} className="mt-1 flex-row items-baseline gap-1.5">
                  <Text className={score ? "text-body text-ink" : "text-body text-inkMuted"}>{names[id] ?? id}</Text>
                  {/* Dotted leaders to the score, as a printed log ruled by hand. */}
                  <View className="min-w-3 flex-1" style={{ borderBottomWidth: 1.5, borderStyle: "dotted", borderColor: withAlphaHex(palette.inkLine, 0.4), marginBottom: 4 * s }} />
                  <Text className={score ? "font-display text-label text-ink" : "text-label text-inkMuted"}>{score ? `${score.rounds} rounds · ${score.score}` : "Not completed"}</Text>
                </View>
              );
            })}
          </View>
          <Row label="Campaign Total" value={String(log.score)} testID="log-score" />
          <View className="py-3">
            <Text className="font-bold text-eyebrow uppercase text-inkLabel">Notes</Text>
            <TextInput
              testID="log-notes"
              multiline
              value={notes}
              onChangeText={setEdited}
              onBlur={saveNotes}
              placeholder="Write a note"
              placeholderTextColor={palette.inkMuted}
              className="mt-1 min-h-24 text-body italic text-ink"
              textAlignVertical="top"
            />
          </View>
        </View>
        {changed ? (
          <View className="mt-4">
            <PrimaryButton
              label="Save notes"
              testID="log-save-notes"
              onPress={saveNotes}
            />
          </View>
        ) : null}
        </Column>
      </ScrollView>
    </Screen>
  );
}
