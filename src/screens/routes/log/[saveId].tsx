import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { printedMap, type CatalogRow } from "../../../campaign/cards";
import { scoreBaseName } from "../../../campaign/continue";
import { returnOfTheKingRows } from "../../../campaign/log-return-of-the-king";
import { keepsSagaColumns } from "../../../campaign/saga";
import { blackGateEnemies, marshesLines, SEARCHING_EYE, threatWords } from "../../../campaign/two-towers-view";
import { copiesMark, encounterSpeech, keepsWilderlandLog, wilderlandView } from "../../../campaign/wilderland-view";
import { MODE_CARD_NAME, type ModeCard } from "../../../campaign/xp";
import { markedRows, markedSpeech, xpWords } from "../../../campaign/xp-view";
import { cards } from "../../../catalog/schema";
import { inArray } from "drizzle-orm";
import { BodyText, Column, Eyebrow, IconButton, NavBar, PrimaryButton, Screen } from "../../kit/chrome";
import { bookletParams, campaignOf, scenarioNames } from "../../data/campaign-data";
import { CardLines } from "../../campaign/card-lines";
import { carryLine, cardSegment, namesLine, poolCardLine, type Line } from "../../campaign/log-facts";
import { useListPreview } from "../../pool/list-preview";
import { useDatabases } from "../../data/databases";
import { goBack } from "../../nav/go-back";
import { usePalette } from "../../kit/palette-hook";
import { routeCode } from "../../nav/route-code";
import { useSave } from "../../data/use-save";
import { GameIcon } from "../../../ui/game-icon";
import type { IconName } from "../../../ui/icon-map";
import { parchmentSurface } from "../../../ui/surfaces";
import { withAlphaHex } from "../../../ui/tokens";
import { useTableTokens } from "../../../ui/use-table-tokens";
import { useUiScale } from "../../../ui/ui-scale";
import { useSizeClass } from "../../../ui/use-size-class";
import { seatWord } from "../../data/seats";
import { Text, TextInput } from "../../../ui/text";

// A rule between the log's rows: a faint line of the ink, as on the printed sheet.
const RULE = 0.28;

// `speech`: what a screen reader hears for the value when the text alone says too little (the squares of a card's boxes). A row of
// `lines` names cards: a tap on a name opens its preview (`onCard`), and no lines read "None".
function Row({ label, value, lines, onCard, testID, icon, speech }: { label: string; value?: string; lines?: readonly Line[]; onCard?: (code: string) => void; testID: string; icon?: IconName; speech?: string }) {
  const s = useUiScale();
  const palette = usePalette();
  return (
    <View className="py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: withAlphaHex(palette.inkLine, RULE) }}>
      <View className="flex-row items-center gap-1">
        {icon ? <GameIcon name={icon} size={12 * s} tint="inkLabel" /> : null}
        <Text className="shrink font-bold text-eyebrow uppercase text-inkLabel">{label}</Text>
      </View>
      {lines && onCard ? (
        <CardLines lines={lines} empty="None" onCard={onCard} testID={testID} className="mt-0.5 text-body text-ink" {...(speech ? { speech } : {})} />
      ) : (
        <Text testID={testID} className="mt-0.5 text-body text-ink" {...(speech ? { accessibilityLabel: speech } : {})}>
          {value}
        </Text>
      )}
    </View>
  );
}

// One card on each line (the treasures, each a name that opens its card).
function namesOnLines(codes: readonly string[], nameOf: (code: string) => string): Line[] {
  return codes.map((code): Line => [cardSegment(code, nameOf)]);
}

// "5 XP · Hard": under a won scenario's name, the XP its Resolution gave and the Hard/Expert Mode card it was played with; empty where there is neither.
function extrasWords(xp: number | undefined, mode: ModeCard | undefined): string {
  return [xp != null ? `${xp} XP` : null, mode ? MODE_CARD_NAME[mode] : null].filter(Boolean).join(" · ");
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
  const preview = useListPreview();

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
    for (const code of save.log.treasures) codes.add(code);
    for (const code of Object.keys(save.log.encounterPool)) codes.add(code);
    for (const code of Object.keys(save.log.blackGate)) codes.add(code);
    if (save.log.marshesChoice.includes("searchingEye")) codes.add(SEARCHING_EYE);
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
  // Each seat's heroes on a line ("Player 1: " in two-handed play); no lines when no seat has any.
  const bySeat = (lists: readonly (readonly string[])[]): Line[] =>
    lists.every((list) => list.length === 0) ? [] : seats.map((seat) => [{ text: save.seatCount > 1 ? `Player ${seat + 1}: ` : "" }, ...((lists[seat] ?? []).length > 0 ? namesLine(lists[seat] ?? [], nameOf) : [{ text: "None" }])]);
  const pool = (kind: "boon" | "burden"): Line[] => {
    const picked = log.campaignPool.filter((card) => printed.get(card.code)?.campaignKind === kind);
    // A boon stuck to a hero names that hero, and in two-handed play the seat that took it (141044:B:1).
    const seatOf = (card: (typeof picked)[number]) => (save.seatCount > 1 && card.attachedTo && card.seat != null ? `Player ${card.seat + 1}: ` : "");
    return picked.map((card) => [{ text: seatOf(card) }, ...poolCardLine(card, log.usedOnce, nameOf)]);
  };
  // The Dream-chaser's marked cards, each with its boxes.
  const marked = (kind: "scalable" | "upgradable"): Line[] => markedRows(log, kind).map((row) => [{ text: row.name, code: row.code }, { text: ` ${row.boxes}` }]);
  const card = preview.openCode;
  // The Ered Mithrin columns (emce.campaign-log): treasures, the allies' lines, Beldis's boxes, the pool's encounter cards.
  const wilderland = keepsWilderlandLog(campaign) ? wilderlandView(log, save.seatCount) : null;
  // The Two Towers columns: each seat's own threat penalty, the Marshes choices and the enemies under The Black Gate, shown with the notes.
  const sagaColumns = keepsSagaColumns(campaign);
  const marshes = sagaColumns ? marshesLines(log, save.seatCount, nameOf) : [];
  const blackGate = sagaColumns ? blackGateEnemies(log) : [];
  const sagaNotes = sagaColumns ? returnOfTheKingRows(log) : [];
  const names = scenarioNames(campaign);
  const notes = edited ?? log.notes;

  return (
    <Screen testID="log" scene="ember">
      {back}
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-safe" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Column>
        {/* Weathered parchment on the ember fog (docs/design-system.md, Campaign log): the same sheet on both themes. */}
        <View className="mb-6 mt-2 rounded-container px-5 py-5" style={parchmentSurface(t)}>
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
          {/* A card's name in a row opens its preview (user request, 2026-11-01). */}
          <Row label="Heroes" lines={bySeat(log.heroesBySeat)} onCard={card} testID="log-heroes" />
          <Row label="Fallen Heroes" lines={bySeat(log.fallenHeroesBySeat)} onCard={card} testID="log-fallen" />
          <Row label="Threat Modifiers" value={sagaColumns ? threatWords(log, save.seatCount) : log.threatPenalty === 0 ? "None" : `+${log.threatPenalty}`} testID="log-threat" icon="threat" />
          {/* Dream-chaser: the XP the Resolutions gave and what is unspent, and the boxes marked beside the scalable and upgradable cards (MEC111 p31). */}
          {campaign.xp ? <Row label="XP" value={xpWords(log)} testID="log-xp" /> : null}
          {campaign.xp ? <Row label="Scalable Cards" lines={marked("scalable")} onCard={card} speech={markedSpeech(log, "scalable")} testID="log-scalable" /> : null}
          {campaign.xp ? <Row label="Upgradable Cards" lines={marked("upgradable")} onCard={card} speech={markedSpeech(log, "upgradable")} testID="log-upgradable" /> : null}
          <Row label="Boons" lines={pool("boon")} onCard={card} testID="log-boons" />
          <Row label="Burdens" lines={pool("burden")} onCard={card} testID="log-burdens" />
          {wilderland ? <Row label="Treasures" lines={namesOnLines(wilderland.treasures, nameOf)} onCard={card} testID="log-treasures" /> : null}
          {wilderland ? <Row label="Unique Allies Protecting Wilderland" lines={wilderland.lines.map((words): Line => [{ text: words }])} onCard={card} testID="log-ally-lines" /> : null}
          {wilderland ? <Row label="Beldis" lines={wilderland.beldis.map((row): Line => [{ text: `${row.prefix}${row.boxes}` }])} onCard={card} speech={wilderland.beldis.map((row) => row.speech).join(". ")} testID="log-beldis" /> : null}
          {wilderland ? <Row label="Encounter cards in the Campaign Pool" lines={wilderland.encounter.map((entry): Line => [cardSegment(entry.code, nameOf), { text: copiesMark(entry.copies) }])} onCard={card} speech={encounterSpeech(wilderland.encounter, nameOf)} testID="log-pool-encounter" /> : null}
          <Row
            label="Captives"
            lines={log.captives.map((captive) => [cardSegment(captive.hero, nameOf), { text: save.seatCount > 1 ? ` (Player ${captive.seat + 1})` : "" }])}
            onCard={card}
            testID="log-captives"
          />
          {/* The hero Journey Along the Anduin's Resolution took prisoner (01130:B:1), taken at the start of Escape from Dol Guldur; the row goes once that scenario is completed (the hero is rescued or the scenario is over). */}
          {log.prisoner && !log.completed.includes("escape-from-dol-guldur") ? <Row label="Prisoner" lines={[[cardSegment(log.prisoner, nameOf)]]} onCard={card} testID="log-prisoner" /> : null}
          {/* Once-per-campaign uses ("Record in Campaign Log when used", the Adaptations of The Oath, 41044:A:3 to 41047:A:3). */}
          {log.usedOnce.length > 0 ? <Row label="Used this campaign" lines={[...new Set(log.usedOnce)].map((code) => [cardSegment(code, nameOf)])} onCard={card} testID="log-used-once" /> : null}
          {/* The cards a Resolution keeps for the next campaign, not this one (Escape from Dol Guldur's Mendor, 01131:B:2). */}
          {log.carryOver.length > 0 ? <Row label="Next Campaign" lines={[carryLine(log.carryOver, nameOf)]} onCard={card} testID="log-carry-over" /> : null}
          <View className="py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: withAlphaHex(palette.inkLine, RULE) }}>
            <Text className="font-bold text-eyebrow uppercase text-inkLabel">Scenarios Completed</Text>
            {campaign.scenarios.map((id) => {
              const score = log.scenarios[id];
              const extras = extrasWords(log.xpGained[id], log.modes[id]);
              return (
                <View key={id} testID={`log-scenario-${id}`} className="mt-1">
                  <View className="flex-row items-baseline gap-1.5">
                    <Text className={score ? "shrink text-body text-ink" : "shrink text-body text-inkMuted"}>{names[id] ?? id}</Text>
                    {/* Dotted leaders to the score, as a printed log ruled by hand. */}
                    <View className="min-w-3 flex-1" style={{ borderBottomWidth: 1.5, borderStyle: "dotted", borderColor: withAlphaHex(palette.inkLine, 0.4), marginBottom: 4 * s }} />
                    <Text className={score ? "font-display text-label text-ink" : "text-label text-inkMuted"}>{score ? `${score.rounds} rounds · ${score.score}` : "Not completed"}</Text>
                  </View>
                  {score && extras ? <Text testID={`log-extras-${id}`} className="text-label text-inkMuted">{extras}</Text> : null}
                </View>
              );
            })}
          </View>
          {marshes.length > 0 ? <Row label="The Passage of the Marshes" lines={marshes} onCard={card} testID="log-marshes" /> : null}
          {/* A continued save's total carries on from the finished campaign's: its score is a line of its own so the total adds up. */}
          {log.scoreBase > 0 ? (
            <View testID="log-score-base" className="flex-row items-baseline gap-1.5 py-2">
              <Text className="shrink text-body text-ink">{scoreBaseName(log, save.campaignId, (id) => campaignOf(id)?.name ?? null)}</Text>
              <View className="min-w-3 flex-1" style={{ borderBottomWidth: 1.5, borderStyle: "dotted", borderColor: withAlphaHex(palette.inkLine, 0.4), marginBottom: 4 * s }} />
              <Text className="font-display text-label text-ink">{log.scoreBase}</Text>
            </View>
          ) : null}
          <Row label="Campaign Total" value={String(log.score)} testID="log-score" />
          {/* Journey to the Cross-roads' Resolution: "the name and quantity of each enemy underneath The Black Gate" goes in the notes section. */}
          {blackGate.length > 0 ? <Row label="Enemies under The Black Gate" lines={blackGate.map((enemy): Line => [{ text: `${enemy.count} \u00d7 ` }, cardSegment(enemy.code, nameOf)])} onCard={card} testID="log-black-gate" /> : null}
          {/* The Return of the King's records: the resources on The Corsair Fleet, the resource tokens on The Black Gate and how the saga ended, each once recorded. */}
          {sagaNotes.map((row) => <Row key={row.id} label={row.label} value={row.value} testID={row.id} />)}
          <View className="py-3">
            <Text className="font-bold text-eyebrow uppercase text-inkLabel">Notes</Text>
            <TextInput
              testID="log-notes"
              accessibilityLabel="Notes"
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
      {preview.overlay}
    </Screen>
  );
}
