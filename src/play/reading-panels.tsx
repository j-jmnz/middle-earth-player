// The reading panels (docs/design-system-table.md, Reading panels; phase 21): a discard pile's cards, this round's log, the threat
// panel from a dial and the table settings from the menu. They open in one place, the same tray frame (tray-frame.tsx), one at a
// time: a new one replaces the last (reading.ts). Each has a round ✕ labelled "Close" at its top right and closes on a tap outside. They
// stay on paper: they are what gets read and recorded. The settings panel is the exception, on night like the Settings tab. Text,
// switches and tiles that show a card large; nothing here sends an intent.
import { ScrollView, View } from "react-native";

import type { LogLine } from "./log.ts";
import { CloseButton, TextButton } from "./buttons.tsx";
import { Tile } from "./sheet-paper.tsx";
import { LineMark } from "./table-chrome.tsx";
import { SettingsRows } from "./setting-rows.tsx";
import type { TableSettings } from "./table-settings.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

// The round ✕ at a panel's top right, level with its title: a 44 pt target that sits in the frame's padding. The header keeps this much
// clear at each side so a long title never runs under it.
const CLOSE_CLEAR = 44;

function PanelClose({ testID, onPress, paper = true }: { testID: string; onPress: () => void; paper?: boolean }) {
  const s = useUiScale();
  return (
    <View style={{ position: "absolute", top: -6 * s, right: -6 * s }}>
      <CloseButton testID={testID} onPress={onPress} paper={paper} />
    </View>
  );
}

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
  const s = useUiScale();
  return (
    <View testID="pile-list" collapsable={false} style={{ flexShrink: 1 }}>
      <View style={{ paddingHorizontal: CLOSE_CLEAR * s }}>
        <Text className="text-center font-display text-eyebrow uppercase text-inkLabel">{`${cards.length} ${cards.length === 1 ? "card" : "cards"}`}</Text>
        <Text accessibilityRole="header" className="mt-1 text-center font-display text-title text-ink">
          {title}
        </Text>
      </View>
      <PanelClose testID="pile-list-close" onPress={onClose} />
      <ScrollView className="mt-3" style={{ flexShrink: 1 }}>
        {cards.length === 0 ? <Text className="text-center text-body text-inkMuted">The pile is empty.</Text> : null}
        {cards.map((card) =>
          playable.includes(card.id) && onPlay ? (
            <Tile key={card.id} label={card.label} detail="Playable now" hint="Tap to play it" selected testID={`pile-card-${card.id}`} onPress={() => onPlay(card.id)} onLongPress={() => onRead(card.id)} />
          ) : (
            <Tile key={card.id} label={card.label} selected={false} testID={`pile-card-${card.id}`} onPress={() => onRead(card.id)} />
          ),
        )}
      </ScrollView>
    </View>
  );
}

/** This round's engine steps and their causes, on paper. Text only: it is how a player checks a number against its source. */
export function LogPanel({ round, lines, onClose }: { round: number; lines: readonly LogLine[]; onClose: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View testID="log-sheet" collapsable={false} style={{ flexShrink: 1 }}>
      <View className="items-center" style={{ paddingHorizontal: CLOSE_CLEAR * s }}>
        <Text accessibilityRole="header" accessibilityLabel={`Log, round ${round}`} className="font-display text-title text-ink">
          Log
        </Text>
      </View>
      <PanelClose testID="log-close" onPress={onClose} />
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
  // "Player 2" in two-handed play, else null.
  seatLabel: string | null;
  threat: number;
  rows: readonly { id: string; name: string; cost: number; verdict: { word: string; engages: boolean } }[];
  onClose: () => void;
}) {
  const s = useUiScale();
  return (
    <View testID="threat-panel" collapsable={false} style={{ flexShrink: 1 }}>
      <View accessible accessibilityRole="header" accessibilityLabel={`${seatLabel ? `${seatLabel}, ` : ""}Threat ${threat} of 50`} className="items-center" style={{ paddingHorizontal: CLOSE_CLEAR * s }}>
        {seatLabel ? <Text className="font-display text-eyebrow uppercase text-inkLabel">{seatLabel}</Text> : null}
        <Text className="mt-1 font-display text-title text-ink">Threat</Text>
        <Text className="font-display text-heading text-inkMuted">{`${threat} of 50`}</Text>
      </View>
      <PanelClose testID="threat-panel-close" onPress={onClose} />
      <ScrollView className="mt-3" style={{ flexGrow: 0, flexShrink: 1 }}>
        <Text className="text-body text-inkMuted">At the engagement checks, each enemy in staging whose engagement cost is at or below your threat engages you. At 50 you are eliminated.</Text>
        {rows.length === 0 ? <Text className="mt-2 text-body text-inkMuted">No enemy is in staging.</Text> : null}
        {rows.map((row) => (
          <View
            key={row.id}
            testID={`threat-row-${row.id}`}
            accessible
            accessibilityLabel={`${row.name}, engagement cost ${row.cost}, ${row.verdict.word}`}
            className="flex-row items-center justify-between py-2"
          >
            <Text className="shrink text-body text-ink">{row.name}</Text>
            <Text className={`font-display text-body ${row.verdict.engages ? "text-ink" : "text-inkMuted"}`}>{`${row.cost} · ${row.verdict.word}`}</Text>
          </View>
        ))}
        <Text className="mt-2 text-label text-inkMuted">The refresh phase raises your threat by 1 at the end of the round; a failed quest raises it by what it falls short.</Text>
      </ScrollView>
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
  const s = useUiScale();
  return (
    <View testID="settings-panel" collapsable={false} style={{ flexShrink: 1 }}>
      <View style={{ paddingRight: CLOSE_CLEAR * s }}>
        <Text accessibilityRole="header" className="font-display text-title text-bone">
          Table settings
        </Text>
      </View>
      <PanelClose testID="settings-close" onPress={onClose} paper={false} />
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator persistentScrollbar>
        <SettingsRows settings={settings} onChange={onChange} always={always} testPrefix="settings" first />
      </ScrollView>
      <View className="-ml-3 items-start pt-2">
        <TextButton tone="accent" label="All settings" accessibilityLabel="All settings. Opens Settings and leaves the table" testID="settings-all" onPress={onAllSettings} />
      </View>
    </View>
  );
}
