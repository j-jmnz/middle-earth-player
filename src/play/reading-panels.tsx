// The reading panels (docs/design-system.md, Table, Panels; phase 21): a discard pile's cards, this round's log, the threat
// panel from a dial and the table settings from the menu. They open in one place, the same tray frame (tray-frame.tsx), one at a
// time: a new one replaces the last (reading.ts). Each has a labeled Close and closes on a tap outside. They stay on paper:
// they are what gets read and recorded. The settings panel is the exception, on night like the Settings tab. Text, switches and
// tiles that show a card large; nothing here sends an intent.
import { ScrollView, View } from "react-native";

import type { LogLine } from "./log.ts";
import { ChromeButton, Tile } from "./sheet-paper.tsx";
import { LineMark } from "./table-chrome.tsx";
import { SettingsRows, SettingTextButton } from "./setting-rows.tsx";
import type { TableSettings } from "./table-settings.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/**
 * A discard pile's cards, the one on top first. A tap shows a card large. A card the open window lets the seat play from the
 * pile (Elven-light) says so, and a tap on it opens its play, as a tap on a hand card does; a long press still shows it large.
 */
export function PileList({
  title,
  cards,
  playable = [],
  onRead,
  onPlay,
  onClose,
}: {
  title: string;
  cards: readonly { id: string; label: string }[];
  playable?: readonly string[];
  onRead: (cardId: string) => void;
  onPlay?: (cardId: string) => void;
  onClose: () => void;
}) {
  return (
    <View testID="pile-list" collapsable={false} style={{ flexShrink: 1 }}>
      <Text className="text-center font-display text-eyebrow uppercase text-inkLabel">{`${cards.length} ${cards.length === 1 ? "card" : "cards"}`}</Text>
      <Text accessibilityRole="header" className="mt-1 text-center font-display text-title text-ink">
        {title}
      </Text>
      <ScrollView className="mt-3" style={{ flexShrink: 1 }}>
        {cards.length === 0 ? <Text className="text-center text-body text-inkMuted">The pile is empty.</Text> : null}
        {cards.map((card) =>
          playable.includes(card.id) && onPlay ? (
            <Tile key={card.id} label={card.label} detail="Can be played from here now. Tap to play it." selected testID={`pile-card-${card.id}`} onPress={() => onPlay(card.id)} onLongPress={() => onRead(card.id)} />
          ) : (
            <Tile key={card.id} label={card.label} selected={false} testID={`pile-card-${card.id}`} onPress={() => onRead(card.id)} />
          ),
        )}
      </ScrollView>
      <View className="items-center pt-1">
        <ChromeButton label={"\u2715 Close"} accessibilityLabel="Close" testID="pile-list-close" tone="ink" onPress={onClose} />
      </View>
    </View>
  );
}

/** This round's engine steps and their causes, on paper. Text only: it is how a player checks a number against its source. */
export function LogPanel({ round, lines, onClose }: { round: number; lines: readonly LogLine[]; onClose: () => void }) {
  const t = useTableTokens();
  return (
    <View testID="log-sheet" collapsable={false} style={{ flexShrink: 1 }}>
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
        <ChromeButton label={"\u2715 Close"} accessibilityLabel="Close" testID="log-close" tone="ink" onPress={onClose} />
      </View>
    </View>
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
  const t = useTableTokens();
  return (
    <View testID="threat-panel" collapsable={false} style={{ flexShrink: 1 }}>
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
        <ChromeButton label={"\u2715 Close"} accessibilityLabel="Close" testID="threat-panel-close" tone="ink" onPress={onClose} />
      </View>
    </View>
  );
}

/**
 * The table's settings, a night side panel from the menu's Table settings (user request, 2026-10-28): the Settings tab's own grouped rows
 * (setting-rows.tsx) under a left-aligned title, minus Stops on, which the rail's carousel carries. At the foot, All settings opens the
 * Settings tab (the game is saved) and Close closes the panel. Text and switches only; nothing here sends an intent.
 */
export function SettingsPanel({
  settings,
  always,
  onChange,
  onAllSettings,
  onClose,
}: {
  settings: TableSettings;
  // The free Responses set to Always, by name: tap to have the table ask again.
  always: readonly { effectId: string; label: string }[];
  onChange: (change: Partial<TableSettings>) => void;
  onAllSettings: () => void;
  onClose: () => void;
}) {
  return (
    <View testID="settings-panel" collapsable={false} style={{ flexShrink: 1 }}>
      <Text accessibilityRole="header" className="font-display text-title text-bone">
        Table settings
      </Text>
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator persistentScrollbar>
        <SettingsRows settings={settings} onChange={onChange} always={always} testPrefix="settings" first />
      </ScrollView>
      <View className="flex-row items-center justify-between pt-2">
        <View className="-ml-3">
          <SettingTextButton label="All settings" accessibilityLabel="All settings. Opens the Settings tab and leaves the table" testID="settings-all" onPress={onAllSettings} />
        </View>
        <ChromeButton label={"\u2715 Close"} accessibilityLabel="Close" testID="settings-close" tone="bone" onPress={onClose} />
      </View>
    </View>
  );
}
