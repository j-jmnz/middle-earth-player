// The paper panels that slide in from the right of the landscape table: a choice whose options are not cards on the table
// (an either/or of an effect, a seat, a card out of play), a discard pile's cards, and this round's log
// (docs/design-system.md, Table). A panel's tiles are picked the same way as cards on the table, and its buttons are the
// dock's: one that sends with nothing picked asks for a second tap.
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import { DockButtons, type DockExtra } from "./dock-buttons.tsx";
import type { LogLine } from "./log.ts";
import type { Readout } from "./readout.ts";
import { ChromeButton, SheetFrame, Stats, Tile } from "./sheet-paper.tsx";
import type { Sheet, SheetOption, SheetStat } from "./sheet-types.ts";
import { tableTokens as t } from "./tokens.ts";
import { headerOf, marked, shareFor, type Choice, type Dock, type DockButton } from "./table-choice.ts";
import type { ScenarioState } from "./store.ts";
import type { TableSettings } from "./table-settings.ts";
import { LineMark } from "./table-chrome.tsx";
import { ReadoutView } from "./table-dock.tsx";

type TileRow = { id: string; label: string; detail: string | null; stats: readonly SheetStat[] };

// The tiles of a sheet: each option; a trigger by its ability, with its timing and printed line.
function tilesOf(sheet: Sheet): TileRow[] {
  const plain = (item: SheetOption): TileRow => ({ id: item.id, label: item.label, detail: null, stats: item.stats ?? [] });
  switch (sheet.kind) {
    case "pick":
    case "multi":
    case "distribute":
      return sheet.options.map(plain);
    case "trigger":
      return sheet.options.map((item) => ({ id: item.id, label: `${item.label} · ${item.timing}`, detail: item.text, stats: [] }));
    case "window":
    case "outcome":
      return [];
  }
}

/**
 * A choice on paper: its tiles, picked like cards on the table, and the dock's buttons. Only the step, the moment and the
 * buttons are pinned; the sentence, the threat and the tiles scroll together, so a short phone still shows the options.
 */
export function SidePanel({
  sheet,
  game,
  choice,
  dock,
  readout,
  threat,
  refusal,
  resetKey,
  onTile,
  onButton,
  onFold,
  onRead,
  undo = null,
}: {
  sheet: Sheet;
  game: ScenarioState;
  choice: Choice;
  dock: Dock;
  readout: Readout | null;
  threat: string;
  refusal: string | null;
  // Changes with the moment and the pick: an armed button goes back to unarmed.
  resetKey: string;
  // A tap on a tile: the same as a tap on that card on the table (a trigger's tile names its ability).
  onTile: (id: string) => void;
  onButton: (button: DockButton) => void;
  // Folds the panel so the table under it can be read; the dock brings it back.
  onFold: () => void;
  // Shows a card large, for a tile or the card the moment is about.
  onRead: ((cardId: string) => void) | null;
  // The dock's Undo, at the panel's foot too: on a short phone the panel covers the top bar.
  undo?: DockExtra | null;
}) {
  const head = headerOf(sheet, game);
  const marks = marked(sheet, choice);
  const unavailable = sheet.kind === "pick" ? (sheet.unavailable ?? []) : [];
  const about = sheet.kind === "pick" ? (sheet.about ?? []) : sheet.kind === "trigger" && sheet.sourceId ? [sheet.sourceId] : [];
  const tiles = tilesOf(sheet);
  return (
    <SheetFrame testID="sheet" edge="right" paddingTop={8}>
      <View className="items-center">
        <Text testID="sheet-step" numberOfLines={1} className="font-display text-eyebrow uppercase text-inkLabel">
          {head.step}
        </Text>
        <Text testID="sheet-title" accessibilityRole="header" numberOfLines={2} className="text-center font-display text-title text-ink">
          {head.title}
        </Text>
      </View>
      <ScrollView className="mt-1" contentContainerClassName="pb-1" style={{ flexShrink: 1 }}>
        <View className="items-center">
          {head.stats.length > 0 ? <Stats stats={head.stats} testID="sheet-stats" /> : null}
          {head.note ? (
            <Text testID="sheet-note" className="mt-1 text-center text-body text-inkMuted">
              {head.note}
            </Text>
          ) : null}
          <Text testID="sheet-threat" className="mt-1 font-display text-label text-inkLabel">
            {threat}
          </Text>
          {onRead && about[0] ? <ChromeButton label="Read the card" testID="sheet-inspect" tone="ink" onPress={() => about[0] && onRead(about[0])} /> : null}
        </View>
        <View className="mt-1">
          {tiles.map((tile) => {
            const share = shareFor(sheet, choice, tile.id);
            const selected = sheet.kind === "trigger" ? choice.ids.includes(tile.id) : (marks.get(tile.id) ?? 0) > 0;
            return (
              <Tile
                key={tile.id}
                label={sheet.kind === "distribute" ? `${tile.label} · ${share}` : tile.label}
                detail={tile.detail}
                stats={tile.stats}
                selected={selected}
                testID={sheet.kind === "trigger" ? `sheet-trigger-${tile.id.split("|")[0] ?? tile.id}` : `sheet-option-${tile.id}`}
                onPress={() => onTile(tile.id)}
              />
            );
          })}
          {/* What the rules refuse now, and why (Weathertop's Travel cost): text, not a choice. */}
          {unavailable.map((item) => (
            <View key={item.id} testID={`sheet-unavailable-${item.id}`} accessible accessibilityLabel={`${item.label}. ${item.reason}`} className="mb-2 rounded-tile border border-dashed border-inkLine px-4 py-2">
              <Text className="text-body text-inkMuted">{item.label}</Text>
              <Text className={`mt-0.5 ${tiles.length === 0 ? "text-body" : "text-label"} text-inkMuted`}>{item.reason}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {readout ? (
        <View className="mt-1">
          <ReadoutView readout={readout} surface="paper" />
        </View>
      ) : null}
      {refusal ? (
        <Text testID="sheet-refusal" numberOfLines={3} className="text-center text-label text-danger">
          {refusal}
        </Text>
      ) : null}
      <DockButtons key={resetKey} dock={dock} surface="paper" onButton={onButton} extras={[...(undo ? [undo] : []), { label: "Look at the table", testID: "sheet-collapse", onPress: onFold }]} />
    </SheetFrame>
  );
}

/** A discard pile's cards, the one on top first. A tap shows a card large; nothing here changes the game. */
export function PileList({ title, cards, onRead, onClose }: { title: string; cards: readonly { id: string; label: string }[]; onRead: (cardId: string) => void; onClose: () => void }) {
  return (
    <SheetFrame testID="pile-list" edge="right">
      <Text className="text-center font-display text-eyebrow uppercase text-inkLabel">{`${cards.length} ${cards.length === 1 ? "card" : "cards"}`}</Text>
      <Text accessibilityRole="header" className="mt-1 text-center font-display text-title text-ink">
        {title}
      </Text>
      <ScrollView className="mt-3" style={{ flexShrink: 1 }}>
        {cards.length === 0 ? <Text className="text-center text-body text-inkMuted">The pile is empty.</Text> : null}
        {cards.map((card) => (
          <Tile key={card.id} label={card.label} selected={false} testID={`pile-card-${card.id}`} onPress={() => onRead(card.id)} />
        ))}
      </ScrollView>
      <View className="items-center pt-1">
        <ChromeButton label="Close" testID="pile-list-close" tone="ink" onPress={onClose} />
      </View>
    </SheetFrame>
  );
}

/** This round's engine steps and their causes, on paper. Text only: it is how a player checks a number against its source. */
export function LogPanel({ round, lines, onClose }: { round: number; lines: readonly LogLine[]; onClose: () => void }) {
  return (
    <SheetFrame testID="log-sheet" edge="right">
      <View className="items-center">
        <Text className="font-display text-eyebrow uppercase text-inkLabel">Log</Text>
        <Text accessibilityRole="header" className="mt-1 font-display text-title text-ink">{`Round ${round}`}</Text>
      </View>
      <ScrollView className="mt-3" style={{ flexGrow: 0, flexShrink: 1 }}>
        {lines.length === 0 ? <Text className="text-center text-body text-inkMuted">Nothing has happened this round yet.</Text> : null}
        {lines.map((line) => (
          <View key={line.key} testID={`log-line-${line.key}`} className="border-b py-2" style={{ borderColor: t.inkLine }}>
            <View className="flex-row items-center gap-2">
              <LineMark mark={line.mark} />
              <Text className="shrink text-body text-ink">{line.text}</Text>
            </View>
            {line.cause ? <Text className="mt-0.5 text-label text-inkMuted">{line.cause}</Text> : null}
          </View>
        ))}
      </ScrollView>
      <View className="items-center pt-2">
        <ChromeButton label="Close" testID="log-close" tone="ink" onPress={onClose} />
      </View>
    </SheetFrame>
  );
}

/**
 * The threat panel a tap on the dial opens: the seat's threat against the elimination level, each enemy in staging with its
 * engagement cost and whether the engagement checks engage it at this threat, and what the round still adds (rr.engagement-check,
 * rr.refresh-phase, rr.threat-elimination-level). Text only.
 */
export function ThreatPanel({
  seatLabel,
  threat,
  rows,
  onClose,
}: {
  seatLabel: string;
  threat: number;
  rows: readonly { id: string; name: string; cost: number; verdict: { word: string; engages: boolean } }[];
  onClose: () => void;
}) {
  return (
    <SheetFrame testID="threat-panel" edge="right">
      <View className="items-center">
        <Text className="font-display text-eyebrow uppercase text-inkLabel">{seatLabel}</Text>
        <Text accessibilityRole="header" className="mt-1 font-display text-title text-ink">{`Threat ${threat} of 50`}</Text>
      </View>
      <ScrollView className="mt-3" style={{ flexGrow: 0, flexShrink: 1 }}>
        <Text className="text-body text-inkMuted">At the engagement checks, each enemy in staging whose engagement cost is at or below your threat engages you. At 50 you are eliminated.</Text>
        {rows.length === 0 ? <Text className="mt-2 text-body text-inkMuted">No enemy is in staging.</Text> : null}
        {rows.map((row) => (
          <View
            key={row.id}
            testID={`threat-row-${row.id}`}
            accessible
            accessibilityLabel={`${row.name}, engagement cost ${row.cost}, ${row.verdict.word}`}
            className="flex-row items-center justify-between border-b py-2 pl-2"
            // An enemy that engages you is marked by a threat-red rule at its left; its word stays ink, readable on paper.
            style={{ borderColor: t.inkLine, borderLeftWidth: 3, borderLeftColor: row.verdict.engages ? t.threat : "transparent" }}
          >
            <Text className="shrink text-body text-ink">{row.name}</Text>
            <Text className={`font-display text-body ${row.verdict.engages ? "text-ink" : "text-inkMuted"}`}>{`${row.cost} · ${row.verdict.word}`}</Text>
          </View>
        ))}
        <Text className="mt-2 text-label text-inkMuted">The refresh phase raises your threat by 1 at the end of the round; a failed quest raises it by what it falls short.</Text>
      </ScrollView>
      <View className="items-center pt-2">
        <ChromeButton label="Close" testID="threat-panel-close" tone="ink" onPress={onClose} />
      </View>
    </SheetFrame>
  );
}

// A labelled switch on paper: the whole row, at least 44 pt tall, is the control, and a screen reader hears it as a switch
// with its detail as the hint. The tracks hold 3:1 against paper (inkMuted off, ink on).
function PaperSwitch({ label, detail, value, onChange, testID }: { label: string; detail?: string; value: boolean; onChange: (value: boolean) => void; testID: string }) {
  return (
    <Pressable
      testID={`${testID}-row`}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 4, backgroundColor: pressed ? t.paperPressed : "transparent" })}
    >
      <View className="shrink" importantForAccessibility="no-hide-descendants">
        <Text className="text-body text-ink">{label}</Text>
        {detail ? <Text className="text-label text-inkMuted">{detail}</Text> : null}
      </View>
      <Switch
        testID={testID}
        accessible={false}
        importantForAccessibility="no"
        value={value}
        onValueChange={onChange}
        trackColor={{ false: t.inkMuted, true: t.ink }}
        thumbColor={t.paper}
        ios_backgroundColor={t.inkMuted}
      />
    </Pressable>
  );
}

/**
 * The table's settings, a paper side panel from the menu's Table settings: Strong outlines, the First-game guide and the
 * Responses used every time. (The round's phases and the Stops switches are the carousel behind the rail, phase-carousel.tsx.)
 * Text and switches only; nothing here sends an intent.
 */
export function SettingsPanel({
  settings,
  always,
  onChange,
  onClose,
}: {
  settings: TableSettings;
  // The free Responses set to Always, by name: tap to have the table ask again.
  always: readonly { effectId: string; label: string }[];
  onChange: (change: Partial<TableSettings>) => void;
  onClose: () => void;
}) {
  return (
    <SheetFrame testID="settings-panel" edge="right">
      <View className="items-center">
        <Text className="font-display text-eyebrow uppercase text-inkLabel">Table</Text>
        <Text accessibilityRole="header" className="mt-1 font-display text-title text-ink">
          Table settings
        </Text>
      </View>
      <ScrollView className="mt-2" style={{ flexGrow: 0, flexShrink: 1 }}>
        <PaperSwitch label="Strong outlines" detail="Effect marks and token counts drawn with heavier outlines." value={settings.highContrast} onChange={(highContrast) => onChange({ highContrast })} testID="settings-contrast" />
        <PaperSwitch label="First-game guide" detail="A line under the dock's title the first two times each step comes up." value={settings.guide} onChange={(guide) => onChange({ guide, ...(guide ? { guideSeen: {} } : {}) })} testID="settings-guide" />
        {always.length > 0 ? <Text className="mt-2 text-label text-inkMuted">Responses used every time:</Text> : null}
        {always.map((item) => (
          <ChromeButton key={item.effectId} label={item.label} testID={`settings-always-${item.effectId}`} tone="ink" onPress={() => onChange({ alwaysUse: settings.alwaysUse.filter((id) => id !== item.effectId) })} />
        ))}
      </ScrollView>
      <View className="items-center pt-2">
        <ChromeButton label="Close" testID="settings-close" tone="ink" onPress={onClose} />
      </View>
    </SheetFrame>
  );
}
